---
title: >-
  [Commissioning] disposition is checked for presence but not validated
  against the CBV vocabulary
status: draft
jira_key: null
reported_at: null
feature: api-commission
priority: P3 – Medium
bug_type: Functional (Backend/API)
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-08-31T10:05:00.000Z'
---
`disposition` is a GS1 Core Business Vocabulary field with a controlled value set. The platform checks it is present — omitting it is correctly refused with *"EPCIS event #0 is missing mandatory field(s): disposition"* (TC_COMM_033) — but never checks the value is valid.

A commissioning event with `disposition: "teleported"` is accepted and processed to *"S - Successful"* (**TC_COMM_034**). Any arbitrary string passes.

The same gap should be checked for `bizStep`, which is also a CBV-controlled field.
---
**Steps to Reproduce:**
1. Connect the Citrix VPN.
2. Authenticate as the manufacturer.
3. Build a valid commissioning document for a fresh SGTIN.
4. Set the event's `disposition` to "teleported".
5. POST to /masar-service/api/v1/scp/SendEPCIS and poll MsgStatusQuery.
6. Observe the terminal state.
---
**Expected Result:**
1. The event is refused because "teleported" is not a valid CBV disposition.
---
**Actual Result:**
1. The event is accepted; MsgStatusQuery reports "S - Successful".
2. Omitting disposition entirely IS correctly refused, so the presence check exists but the value check does not.
---
**Request / Response (for debugging):**

Captured from the automated run. Credentials are masked; intermediate "still processing" polls are omitted so the submission and the verdict stand out.

<details><summary><code>TC_COMM_034</code> — the exact exchange</summary>

```http
POST https://192.168.225.195:8444/masar-service/api/v1/scp/SendEPCIS
Authorization: «masked, 448 chars»

{
  "@context": [
    "https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonld"
  ],
  "type": "EPCISDocument",
  "schemaVersion": "2.0",
  "creationDate": "2026-09-01T02:15:32+03:00",
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
      "instanceIdentifier": "ztg-mti1bknb372-0007",
      "type": "Events",
      "creationDateAndTime": "2026-09-01T02:15:32+03:00"
    }
  },
  "epcisBody": {
    "eventList": [
      {
        "type": "ObjectEvent",
        "eventTime": "2026-09-01T02:15:32+03:00",
        "eventTimeZoneOffset": "+03:00",
        "readPoint": {
          "id": "urn:epc:id:sgln:84353083.0000.0"
        },
        "bizLocation": {
          "id": "urn:epc:id:sgln:84353083.0000.0"
        },
        "action": "ADD",
        "bizStep": "commissioning",
        "disposition": "teleported",
        "epcList": [
          "urn:epc:id:sgtin:84353083.05448.ZTGMTI1BKNB3720006"
        ],
        "ilmd": {
          "cbvmda:lotNumber": "ZTG-MTI1BKNB372",
          "cbvmda:itemExpirationDate": "2030-12-31"
        }
      }
    ]
  }
}
```

Response — **202 Accepted** in 81 ms:
```json
{
  "statustype": "I",
  "code": 202,
  "date": "2026-09-01T02:15:30.499Z",
  "messageid": "ztg-mti1bknb372-0007",
  "status": {
    "reason": "Message accepted for EPTTS Processing, the message status can be viewed in the message status query",
    "code": "I001"
  }
}
```

Then the platform's own verdict, from `POST /MsgStatusQuery`:
```json
{
  "instanceIdentifier": "ztg-mti1bknb372-0007",
  "messagestatus": "S - Successful",
  "logList": [
    {
      "type": "I",
      "message": "Commission (Items) event processed successfully"
    },
    {
      "type": "I",
      "message": "Message processed successfully — all 1 event(s) completed"
    }
  ]
}
```

</details>

<details><summary><code>TS_RECV_028</code> — the exact exchange</summary>

Preceded by 3 successful setup call(s) that built the stock this request acts on. The call below is the one under test.

```http
POST https://192.168.225.195:8444/masar-service/api/v1/scp/SendEPCIS
Authorization: «masked, 447 chars»

{
  "@context": [
    "https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonld"
  ],
  "type": "EPCISDocument",
  "schemaVersion": "2.0",
  "creationDate": "2026-09-01T02:18:39+03:00",
  "sbdh": {
    "headerVersion": "1.3",
    "sender": {
      "identifier": "0085412000008"
    },
    "receiver": {
      "identifier": "8435308300002"
    },
    "documentIdentification": {
      "standard": "EPCGlobal",
      "typeVersion": "1.0",
      "instanceIdentifier": "ztg-mti1feap7be-0007",
      "type": "Events",
      "creationDateAndTime": "2026-09-01T02:18:39+03:00"
    }
  },
  "epcisBody": {
    "eventList": [
      {
        "type": "ObjectEvent",
        "eventTime": "2026-09-01T02:18:39+03:00",
        "eventTimeZoneOffset": "+03:00",
        "readPoint": {
          "id": "urn:epc:id:sgln:0085412.00000.0"
        },
        "bizLocation": {
          "id": "urn:epc:id:sgln:0085412.00000.0"
        },
        "action": "OBSERVE",
        "bizStep": "receiving",
        "disposition": "teleported",
        "epcList": [
          "urn:epc:id:sscc:84353083.229098039"
        ],
        "sourceList": [
          {
            "type": "urn:epcglobal:cbv:sdt:owning_party",
            "source": "urn:epc:id:sgln:84353083.0000.0"
          }
        ]
      }
    ]
  }
}
```

Response — **202 Accepted** in 162 ms:
```json
{
  "statustype": "I",
  "code": 202,
  "date": "2026-09-01T02:18:36.783Z",
  "messageid": "ztg-mti1feap7be-0007",
  "status": {
    "reason": "Message accepted for EPTTS Processing, the message status can be viewed in the message status query",
    "code": "I001"
  }
}
```

Then the platform's own verdict, from `POST /MsgStatusQuery`:
```json
{
  "instanceIdentifier": "ztg-mti1feap7be-0007",
  "messagestatus": "S - Successful",
  "logList": [
    {
      "type": "I",
      "message": "Receiving event processed successfully"
    },
    {
      "type": "I",
      "message": "Message processed successfully — all 1 event(s) completed"
    }
  ]
}
```

</details>

<details><summary><code>TS_RTRV_029</code> — the exact exchange</summary>

Preceded by 5 successful setup call(s) that built the stock this request acts on. The call below is the one under test.

```http
POST https://192.168.225.195:8444/masar-service/api/v1/scp/SendEPCIS
Authorization: «masked, 448 chars»

{
  "@context": [
    "https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonld"
  ],
  "type": "EPCISDocument",
  "schemaVersion": "2.0",
  "creationDate": "2026-09-01T02:20:24+03:00",
  "sbdh": {
    "headerVersion": "1.3",
    "sender": {
      "identifier": "8435308300002"
    },
    "receiver": {
      "identifier": "0085412000008"
    },
    "documentIdentification": {
      "standard": "EPCGlobal",
      "typeVersion": "1.0",
      "instanceIdentifier": "ztg-mti1g9zu7ap-0017",
      "type": "Events",
      "creationDateAndTime": "2026-09-01T02:20:24+03:00"
    }
  },
  "epcisBody": {
    "eventList": [
      {
        "type": "ObjectEvent",
        "eventTime": "2026-09-01T02:20:24+03:00",
        "eventTimeZoneOffset": "+03:00",
        "readPoint": {
          "id": "urn:epc:id:sgln:84353083.0000.0"
        },
        "bizLocation": {
          "id": "urn:epc:id:sgln:84353083.0000.0"
        },
        "action": "OBSERVE",
        "bizStep": "receiving",
        "disposition": "teleported",
        "epcList": [
          "urn:epc:id:sscc:84353083.229181802"
        ],
        "sourceList": [
          {
            "type": "urn:epcglobal:cbv:sdt:owning_party",
            "source": "urn:epc:id:sgln:0085412.00000.0"
          }
        ],
        "bizTransactionList": [
          {
            "type": "urn:epcglobal:cbv:btt:desadv",
            "bizTransaction": "RET-ZTG-MTI1G9ZU7AP-0015"
          }
        ]
      }
    ]
  }
}
```

Response — **202 Accepted** in 97 ms:
```json
{
  "statustype": "I",
  "code": 202,
  "date": "2026-09-01T02:20:22.004Z",
  "messageid": "ztg-mti1g9zu7ap-0017",
  "status": {
    "reason": "Message accepted for EPTTS Processing, the message status can be viewed in the message status query",
    "code": "I001"
  }
}
```

Then the platform's own verdict, from `POST /MsgStatusQuery`:
```json
{
  "instanceIdentifier": "ztg-mti1g9zu7ap-0017",
  "messagestatus": "S - Successful",
  "logList": [
    {
      "type": "I",
      "message": "Receiving event processed successfully"
    },
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
P3 – Medium
---
**Bug Type:**
Functional (Backend/API)
---
**Notes:**
**Covers test cases:** `TC_COMM_034`, `TS_RECV_028`, `TS_RTRV_029`

Covered by `TC_COMM_034` (marked `test.fail()`). `TC_COMM_033` (empty disposition) passes and is unaffected. Was recorded as `Fail` in the source spreadsheet and remains broken, unlike TC_COMM_033/035/038/041/042 which now reject correctly.

---
**SCOPE CORRECTION (2026-09-01): also present on Receiving and Return Receiving.**

The same unvalidated `disposition` was accepted on `TS_RECV_028` and `TS_RTRV_029` in a full
clean run, so this belongs to the shared event validator rather than the commissioning
handler. `TC_COMM_034` remains the commissioning instance.
