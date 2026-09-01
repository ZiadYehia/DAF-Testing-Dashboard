---
title: >-
  [Commissioning] An empty epcList is accepted, and an empty-string EPC is
  misclassified as an SSCC
status: draft
jira_key: null
reported_at: null
feature: api-commission
priority: P2 – High
bug_type: Functional (Backend/API)
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-08-31T10:05:00.000Z'
---
Two related EPC-list defects:

**TC_COMM_004 — `epcList: []`.** A commissioning event carrying zero EPCs is accepted and reports *"Message processed successfully — all 1 event(s) completed"*. Tellingly the log omits the *"Commission (Items) event processed successfully"* line it emits for real work, so the platform knows it commissioned nothing yet still reports success.

**TC_COMM_004b — `epcList: [""]`.** An empty-string EPC is accepted **and misclassified**: the log reads *"Commission (**SSCCs**) event processed successfully"*. An empty string is being parsed as an SSCC rather than rejected as an invalid EPC. That is an EPC-parsing bug, not merely a missing length check, and it means a malformed EPC can be routed down the wrong processing path.

Note the same empty-eventList behaviour also exists one level up: a well-formed envelope whose `epcisBody.eventList` is `[]` is likewise accepted with 202 / I001.
---
**Covers test cases:** `TC_COMM_004`

**Steps to Reproduce:**
1. Authenticate as the manufacturer.
2. Build a valid commissioning document, then set the event's `epcList` to an empty array.
3. POST to /masar-service/api/v1/scp/SendEPCIS and poll MsgStatusQuery.
4. Observe the terminal state and the logList contents.
5. Repeat with `epcList: [""]` and read the logList carefully.
6. Separately, POST a valid envelope whose epcisBody.eventList is [] and observe the response.
---
**Expected Result:**
1. A commissioning event with no EPCs is rejected as having nothing to commission.
2. An empty-string EPC is rejected as an invalid EPC, and never classified as an SSCC.
3. An EPCIS document with an empty eventList is rejected.
---
**Actual Result:**
1. epcList [] is accepted; MsgStatusQuery reports "S - Successful" while omitting the Commission line.
2. epcList [""] is accepted and logged as "Commission (SSCCs) event processed successfully".
3. An empty eventList returns 202 with code I001 and is queued for processing.
---
**Request / Response (for debugging):**

Captured from the automated run. Credentials are masked; intermediate "still processing" polls are omitted so the submission and the verdict stand out.

<details><summary><code>TC_COMM_004</code> — the exact exchange</summary>

```http
POST https://192.168.225.195:8444/masar-service/api/v1/scp/SendEPCIS
Authorization: «masked, 448 chars»

{
  "@context": [
    "https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonld"
  ],
  "type": "EPCISDocument",
  "schemaVersion": "2.0",
  "creationDate": "2026-09-01T02:15:09+03:00",
  "sbdh": {
    "headerVersion": "1.3",
    "sender": {
      "identifier": "8435308300002"
    },
    "receiver": {
      "identifier": "8435308300002"
    },
    "documentIdentification": {
      "standard": "EPCGlobal",
      "typeVersion": "1.0",
      "instanceIdentifier": "ztg-mti1bkor2wy-0002",
      "type": "Events",
      "creationDateAndTime": "2026-09-01T02:15:09+03:00"
    }
  },
  "epcisBody": {
    "eventList": [
      {
        "type": "ObjectEvent",
        "eventTime": "2026-09-01T02:15:09+03:00",
        "eventTimeZoneOffset": "+03:00",
        "readPoint": {
          "id": "urn:epc:id:sgln:84353083.0000.0"
        },
        "bizLocation": {
          "id": "urn:epc:id:sgln:84353083.0000.0"
        },
        "action": "ADD",
        "bizStep": "commissioning",
        "disposition": "active",
        "epcList": [],
        "ilmd": {
          "cbvmda:lotNumber": "ZTG-MTI1BKOR2WY",
          "cbvmda:itemExpirationDate": "2030-12-31"
        }
      }
    ]
  }
}
```

Response — **202 Accepted** in 210 ms:
```json
{
  "statustype": "I",
  "code": 202,
  "date": "2026-09-01T02:15:06.787Z",
  "messageid": "ztg-mti1bkor2wy-0002",
  "status": {
    "reason": "Message accepted for EPTTS Processing, the message status can be viewed in the message status query",
    "code": "I001"
  }
}
```

Then the platform's own verdict, from `POST /MsgStatusQuery`:
```json
{
  "instanceIdentifier": "ztg-mti1bkor2wy-0002",
  "messagestatus": "S - Successful",
  "logList": [
    {
      "type": "I",
      "message": "Message processed successfully — all 1 event(s) completed"
    }
  ]
}
```

</details>
---
**Environment:**
- Masar B2B API via Citrix VPN
- Auth: POST https://192.168.225.195:8445/registry-service/api/v1/auth (apikey header)
- Events: POST https://192.168.225.195:8444/masar-service/api/v1/scp/SendEPCIS
- Tenant: devsim, manufacturer INSTITUTO GRIFOLS (GLN 8435308300002)
- TLS: self-signed certificate
---
**Priority:**
P2 – High
---
**Bug Type:**
Functional (Backend/API)
---
**Notes:**
Covered by `TC_COMM_004` / `TC_COMM_004b` (both `test.fail()`), and by `SMOKE-05b` in `automation-hub/projects/eptts-api-smoke/` for the empty-eventList case. The SSCC misclassification is the part worth investigating first — it points at the EPC parser rather than at input validation.

---
**SCOPE CORRECTION (2026-09-01): empty-list acceptance is platform-wide, not just `epcList`.**

A full clean run showed the same behaviour for `sourceList`, `destinationList` and
`bizTransactionList` across shipping, receiving and both return legs — 8 cases in total. Filed
as *"Empty required lists are accepted across shipping, receiving and both return legs"*
(`api-shipping`), which lists them.

Keep this ticket for the commissioning `epcList` case and its separate finding that an
empty-string EPC is misclassified as an SSCC — that part is specific to the identifier parser
and does not appear in the wider set.
