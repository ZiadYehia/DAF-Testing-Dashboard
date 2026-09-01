---
title: >-
  [Commissioning] Event timestamps are not validated — empty and malformed
  eventTime and eventTimeZoneOffset are accepted
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
None of the EPCIS event-time fields is validated. All four of these commissioning documents are accepted and processed to *"S - Successful"*:

| Case | Mutation | Result |
|---|---|---|
| TC_COMM_025 | `eventTime: ""` | accepted |
| TC_COMM_026 | `eventTime: "05-05-2026 10:00"` (not ISO 8601) | accepted |
| TC_COMM_027 | `eventTimeZoneOffset: ""` | accepted |
| TC_COMM_028 | `eventTimeZoneOffset: "+99:99"` (impossible offset) | accepted |

For a track-and-trace platform this is the most consequential of the validation gaps found: the entire evidentiary value of an EPCIS chain rests on a defensible event chronology. An event with no timestamp, or a timestamp in an ambiguous format, or an impossible timezone offset, cannot be placed reliably in sequence — which undermines the audit trail these events exist to produce.

Contrast with the fields that ARE validated well: `readPoint.id` and `bizLocation.id` are checked for presence and for canonical SGLN form, `schemaVersion` is pinned to "2.0", and lot numbers are allow-listed.
---
**Steps to Reproduce:**
1. Connect the Citrix VPN.
2. Authenticate as the manufacturer.
3. Build a valid commissioning document for a fresh SGTIN.
4. Set the event's `eventTime` to an empty string and POST to /masar-service/api/v1/scp/SendEPCIS.
5. Poll MsgStatusQuery with the instanceIdentifier and observe the terminal state.
6. Repeat with eventTime "05-05-2026 10:00", then with eventTimeZoneOffset "", then with eventTimeZoneOffset "+99:99".
---
**Expected Result:**
1. Each document is rejected — synchronously with 400 for a malformed field, or asynchronously with MsgStatusQuery reporting FAILED and naming the invalid timestamp.
2. eventTime must be a valid ISO 8601 timestamp and eventTimeZoneOffset a valid UTC offset.
---
**Actual Result:**
1. All four are accepted: 202 followed by messagestatus "S - Successful" and "Commission (Items) event processed successfully".
2. The pack is created with an unusable or absent event timestamp.
---
**Request / Response (for debugging):**

Captured from the automated run. Credentials are masked; intermediate "still processing" polls are omitted so the submission and the verdict stand out.

<details><summary><code>TC_COMM_025</code> — the exact exchange</summary>

```http
POST https://192.168.225.195:8444/masar-service/api/v1/scp/SendEPCIS
Authorization: «masked, 448 chars»

{
  "@context": [
    "https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonld"
  ],
  "type": "EPCISDocument",
  "schemaVersion": "2.0",
  "creationDate": "2026-09-01T02:15:20+03:00",
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
      "instanceIdentifier": "ztg-mti1bkor2wy-0004",
      "type": "Events",
      "creationDateAndTime": "2026-09-01T02:15:20+03:00"
    }
  },
  "epcisBody": {
    "eventList": [
      {
        "type": "ObjectEvent",
        "eventTime": "",
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
        "epcList": [
          "urn:epc:id:sgtin:84353083.05448.ZTGMTI1BKOR2WY0003"
        ],
        "ilmd": {
          "cbvmda:lotNumber": "ZTG-MTI1BKOR2WY",
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
  "date": "2026-09-01T02:15:17.554Z",
  "messageid": "ztg-mti1bkor2wy-0004",
  "status": {
    "reason": "Message accepted for EPTTS Processing, the message status can be viewed in the message status query",
    "code": "I001"
  }
}
```

Then the platform's own verdict, from `POST /MsgStatusQuery`:
```json
{
  "instanceIdentifier": "ztg-mti1bkor2wy-0004",
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

<details><summary><code>TC_COMM_026</code> — the exact exchange</summary>

```http
POST https://192.168.225.195:8444/masar-service/api/v1/scp/SendEPCIS
Authorization: «masked, 448 chars»

{
  "@context": [
    "https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonld"
  ],
  "type": "EPCISDocument",
  "schemaVersion": "2.0",
  "creationDate": "2026-09-01T02:15:22+03:00",
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
      "instanceIdentifier": "ztg-mti1bknb372-0005",
      "type": "Events",
      "creationDateAndTime": "2026-09-01T02:15:22+03:00"
    }
  },
  "epcisBody": {
    "eventList": [
      {
        "type": "ObjectEvent",
        "eventTime": "05-05-2026 10:00",
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
        "epcList": [
          "urn:epc:id:sgtin:84353083.05448.ZTGMTI1BKNB3720004"
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

Response — **202 Accepted** in 84 ms:
```json
{
  "statustype": "I",
  "code": 202,
  "date": "2026-09-01T02:15:19.808Z",
  "messageid": "ztg-mti1bknb372-0005",
  "status": {
    "reason": "Message accepted for EPTTS Processing, the message status can be viewed in the message status query",
    "code": "I001"
  }
}
```

Then the platform's own verdict, from `POST /MsgStatusQuery`:
```json
{
  "instanceIdentifier": "ztg-mti1bknb372-0005",
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

<details><summary><code>TC_COMM_027</code> — the exact exchange</summary>

```http
POST https://192.168.225.195:8444/masar-service/api/v1/scp/SendEPCIS
Authorization: «masked, 448 chars»

{
  "@context": [
    "https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonld"
  ],
  "type": "EPCISDocument",
  "schemaVersion": "2.0",
  "creationDate": "2026-09-01T02:15:30+03:00",
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
      "instanceIdentifier": "ztg-mti1bkok1cd-0005",
      "type": "Events",
      "creationDateAndTime": "2026-09-01T02:15:30+03:00"
    }
  },
  "epcisBody": {
    "eventList": [
      {
        "type": "ObjectEvent",
        "eventTime": "2026-09-01T02:15:30+03:00",
        "eventTimeZoneOffset": "",
        "readPoint": {
          "id": "urn:epc:id:sgln:84353083.0000.0"
        },
        "bizLocation": {
          "id": "urn:epc:id:sgln:84353083.0000.0"
        },
        "action": "ADD",
        "bizStep": "commissioning",
        "disposition": "active",
        "epcList": [
          "urn:epc:id:sgtin:84353083.05448.ZTGMTI1BKOK1CD0004"
        ],
        "ilmd": {
          "cbvmda:lotNumber": "ZTG-MTI1BKOK1CD",
          "cbvmda:itemExpirationDate": "2030-12-31"
        }
      }
    ]
  }
}
```

Response — **202 Accepted** in 88 ms:
```json
{
  "statustype": "I",
  "code": 202,
  "date": "2026-09-01T02:15:28.170Z",
  "messageid": "ztg-mti1bkok1cd-0005",
  "status": {
    "reason": "Message accepted for EPTTS Processing, the message status can be viewed in the message status query",
    "code": "I001"
  }
}
```

Then the platform's own verdict, from `POST /MsgStatusQuery`:
```json
{
  "instanceIdentifier": "ztg-mti1bkok1cd-0005",
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

The same exchange shape repeats for the other case(s) this bug covers (`TC_COMM_028`, `TC_DEST_019`, `TC_DEST_020`, `TS_RECV_029`, `TS_RECV_030`, `TS_RTN_032`, `TS_RTN_033`, `TS_RTRV_030`, `TS_RTRV_031`, `TC_SHIP_025`, `TC_SHIP_026`, `TC_SHIP_039`); they are omitted here for length.
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
**Covers test cases:** `TC_COMM_025`, `TC_COMM_026`, `TC_COMM_027`, `TC_COMM_028`, `TC_DEST_019`, `TC_DEST_020`, `TS_RECV_029`, `TS_RECV_030`, `TS_RTN_032`, `TS_RTN_033`, `TS_RTRV_030`, `TS_RTRV_031`, `TC_SHIP_025`, `TC_SHIP_026`, `TC_SHIP_039`

Covered by `TC_COMM_025`–`TC_COMM_028` in `automation-hub/projects/eptts-api-commission/`, all marked `test.fail()`. The four almost certainly share one root cause: no validation on the event time fields.

---
**SCOPE CORRECTION (2026-09-01): this is not a Commissioning defect.**

A full clean run of all 351 API cases reproduced the same gap on five more features, so the
missing validation is in the shared EPCIS event validator, not the commissioning handler.
Fixing it only here would leave the rest:

| Feature | Cases |
|---|---|
| Commissioning | `TC_COMM_025`, `TC_COMM_026`, `TC_COMM_027`, `TC_COMM_028` |
| Destruction | `TC_DEST_019`, `TC_DEST_020` |
| Receiving | `TS_RECV_029`, `TS_RECV_030` |
| Return Shipping | `TS_RTN_032`, `TS_RTN_033` |
| Return Receiving | `TS_RTRV_030`, `TS_RTRV_031` |
| Shipping | `TC_SHIP_025`, `TC_SHIP_026`, `TC_SHIP_039` |

**The validator is NOT uniform, which is the useful part of this finding.** `/Dispensation`
*does* reject a malformed `eventTime` and a bad offset (`TC_DISP_022`, `TC_DISP_023`,
`TC_DISP_024`, and the partial-dispensing equivalents all pass). So a correct implementation
already exists in this codebase — the fix may be to apply the dispensing path's validation to
the `/scp/SendEPCIS` path rather than to write anything new.
