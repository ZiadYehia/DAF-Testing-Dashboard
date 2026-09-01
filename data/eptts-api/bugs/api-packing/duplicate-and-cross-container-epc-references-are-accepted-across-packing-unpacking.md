---
title: >-
  [Validation] Duplicate EPCs in one event, and a child claimed by two parents,
  are accepted across packing, unpacking, destruction, receiving and returns
status: draft
jira_key: null
reported_at: null
feature: api-packing
priority: P1 – Critical
bug_type: Functional (Backend/API)
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-09-01T01:15:00.000Z'
---
An event that names the same EPC twice, or names a pack that does not belong to the container
it references, is accepted and reported `S - Successful`.

Confirmed on 6 cases across 5 features in a single clean run:

| Case | Feature | What was sent |
|---|---|---|
| `TS_PACK_009` | Packing | the same child SGTIN listed twice in `childEPCs` |
| `TS_PACK_011` | Packing | one child assigned to **two different parent SSCCs in one document** |
| `TS_UNPK_005` | Unpacking | a child that is not inside the SSCC being unpacked |
| `TC_DEST_008` | Destruction | the same SGTIN listed twice in `epcList` |
| `TS_RECV_015` | Receiving | duplicate EPCs |
| `TS_RTN_021` | Return Shipping | duplicate EPCs |

**`TS_PACK_011` is the most serious of the six** and deserves separate attention even if the
rest are fixed together. A pack physically exists in exactly one container. Accepting a
document that puts one child under two parents produces a hierarchy that cannot correspond to
reality, and the platform has no way to know afterwards which parent is the lie. Everything
computed from aggregation — what shipped, what a container holds, what a recall must reach —
inherits that corruption silently.

`TS_UNPK_005` is the same class from the other direction: unpacking a child from a container
it was never in should be refused on the pack's own recorded `parentSscc`, which the platform
already tracks and exposes through `VerifyProduct`.

Duplicates matter beyond tidiness: counts derived from `epcList` length (items in a shipment,
packs destroyed) become wrong, and a destruction event that names a pack twice is ambiguous
about whether one or two units left the supply chain.

Like the empty-list defect, the spread across five unrelated features points at the shared
EPCIS event validator rather than any single handler.
---
**Steps to Reproduce:**
1. Connect the Citrix VPN and authenticate as the manufacturer.
2. Commission two packs and pack them into an SSCC so a valid aggregation exists.
3. Build an `AggregationEvent` whose `childEPCs` names the same SGTIN twice; submit it to
   `:8444/masar-service/api/v1/scp/SendEPCIS`.
4. Poll `MsgStatusQuery` to a terminal state.
5. For `TS_PACK_011`, submit one document containing two `AggregationEvent`s that claim the
   same child under different `parentID` values.
6. Read the child back with `POST /VerifyProduct` and inspect `pack.parentSscc`.
---
**Expected Result:**
1. Each submission is refused, naming the duplicated EPC or the container mismatch.
2. `pack.parentSscc` continues to reflect the one container the pack is actually in.
---
**Actual Result:**
1. Every one of the six is accepted: `messagestatus: "S - Successful"`, with the per-event
   `logList` reporting the event processed successfully.
2. No error, no warning, and nothing downstream indicates the aggregation is inconsistent.
---
**Request / Response (for debugging):**

Captured from the automated run. Credentials are masked; intermediate "still processing" polls are omitted so the submission and the verdict stand out.

<details><summary><code>TS_PACK_009</code> — the exact exchange</summary>

Preceded by 1 successful setup call(s) that built the stock this request acts on. The call below is the one under test.

```http
POST https://192.168.225.195:8444/masar-service/api/v1/scp/SendEPCIS
Authorization: «masked, 448 chars»

{
  "@context": [
    "https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonld"
  ],
  "type": "EPCISDocument",
  "schemaVersion": "2.0",
  "creationDate": "2026-09-01T02:17:53+03:00",
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
      "instanceIdentifier": "ztg-mti1evhm6hr-0004",
      "type": "Events",
      "creationDateAndTime": "2026-09-01T02:17:53+03:00"
    }
  },
  "epcisBody": {
    "eventList": [
      {
        "type": "AggregationEvent",
        "eventTime": "2026-09-01T02:17:53+03:00",
        "eventTimeZoneOffset": "+03:00",
        "readPoint": {
          "id": "urn:epc:id:sgln:84353083.0000.0"
        },
        "bizLocation": {
          "id": "urn:epc:id:sgln:84353083.0000.0"
        },
        "action": "ADD",
        "bizStep": "packing",
        "disposition": "active",
        "parentID": "urn:epc:id:sscc:84353083.229073742",
        "childEPCs": [
          "urn:epc:id:sgtin:84353083.05448.ZTGMTI1EVHM6HR0001",
          "urn:epc:id:sgtin:84353083.05448.ZTGMTI1EVHM6HR0001"
        ]
      }
    ]
  }
}
```

Response — **202 Accepted** in 92 ms:
```json
{
  "statustype": "I",
  "code": 202,
  "date": "2026-09-01T02:17:51.185Z",
  "messageid": "ztg-mti1evhm6hr-0004",
  "status": {
    "reason": "Message accepted for EPTTS Processing, the message status can be viewed in the message status query",
    "code": "I001"
  }
}
```

Then the platform's own verdict, from `POST /MsgStatusQuery`:
```json
{
  "instanceIdentifier": "ztg-mti1evhm6hr-0004",
  "messagestatus": "S - Successful",
  "logList": [
    {
      "type": "I",
      "message": "Packing event processed successfully"
    },
    {
      "type": "I",
      "message": "Message processed successfully — all 1 event(s) completed"
    }
  ]
}
```

</details>

<details><summary><code>TS_PACK_011</code> — the exact exchange</summary>

Preceded by 1 successful setup call(s) that built the stock this request acts on. The call below is the one under test.

```http
POST https://192.168.225.195:8444/masar-service/api/v1/scp/SendEPCIS
Authorization: «masked, 448 chars»

{
  "@context": [
    "https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonld"
  ],
  "type": "EPCISDocument",
  "schemaVersion": "2.0",
  "creationDate": "2026-09-01T02:17:53+03:00",
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
      "instanceIdentifier": "ztg-mti1evh918j-0006",
      "type": "Events",
      "creationDateAndTime": "2026-09-01T02:17:53+03:00"
    }
  },
  "epcisBody": {
    "eventList": [
      {
        "type": "AggregationEvent",
        "eventTime": "2026-09-01T02:17:53+03:00",
        "eventTimeZoneOffset": "+03:00",
        "readPoint": {
          "id": "urn:epc:id:sgln:84353083.0000.0"
        },
        "bizLocation": {
          "id": "urn:epc:id:sgln:84353083.0000.0"
        },
        "action": "ADD",
        "bizStep": "packing",
        "disposition": "active",
        "parentID": "urn:epc:id:sscc:84353083.229073766",
        "childEPCs": [
          "urn:epc:id:sgtin:84353083.05448.ZTGMTI1EVH918J0001"
        ]
      },
      {
        "type": "AggregationEvent",
        "eventTime": "2026-09-01T02:17:53+03:00",
        "eventTimeZoneOffset": "+03:00",
        "readPoint": {
          "id": "urn:epc:id:sgln:84353083.0000.0"
        },
        "bizLocation": {
          "id": "urn:epc:id:sgln:84353083.0000.0"
        },
        "action": "ADD",
        "bizStep": "packing",
        "disposition": "active",
        "parentID": "urn:epc:id:sscc:84353083.229073766",
        "childEPCs": [
          "urn:epc:id:sgtin:84353083.05448.ZTGMTI1EVH918J0001"
        ]
      }
    ]
  }
}
```

Response — **202 Accepted** in 91 ms:
```json
{
  "statustype": "I",
  "code": 202,
  "date": "2026-09-01T02:17:51.212Z",
  "messageid": "ztg-mti1evh918j-0006",
  "status": {
    "reason": "Message accepted for EPTTS Processing, the message status can be viewed in the message status query",
    "code": "I001"
  }
}
```

Then the platform's own verdict, from `POST /MsgStatusQuery`:
```json
{
  "instanceIdentifier": "ztg-mti1evh918j-0006",
  "messagestatus": "S - Successful",
  "logList": [
    {
      "type": "I",
      "message": "Packing event processed successfully"
    },
    {
      "type": "I",
      "message": "Message processed successfully — all 2 event(s) completed"
    }
  ]
}
```

</details>

<details><summary><code>TS_UNPK_005</code> — the exact exchange</summary>

Preceded by 3 successful setup call(s) that built the stock this request acts on. The call below is the one under test.

```http
POST https://192.168.225.195:8444/masar-service/api/v1/scp/SendEPCIS
Authorization: «masked, 448 chars»

{
  "@context": [
    "https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonld"
  ],
  "type": "EPCISDocument",
  "schemaVersion": "2.0",
  "creationDate": "2026-09-01T02:23:18+03:00",
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
      "instanceIdentifier": "ztg-mti1ldva4zy-0007",
      "type": "Events",
      "creationDateAndTime": "2026-09-01T02:23:18+03:00"
    }
  },
  "epcisBody": {
    "eventList": [
      {
        "type": "AggregationEvent",
        "eventTime": "2026-09-01T02:23:18+03:00",
        "eventTimeZoneOffset": "+03:00",
        "readPoint": {
          "id": "urn:epc:id:sgln:84353083.0000.0"
        },
        "bizLocation": {
          "id": "urn:epc:id:sgln:84353083.0000.0"
        },
        "action": "DELETE",
        "bizStep": "unpacking",
        "disposition": "active",
        "parentID": "urn:epc:id:sscc:84353083.229377347",
        "childEPCs": [
          "urn:epc:id:sgtin:84353083.05448.ZTGMTI1LDVA4ZY0005"
        ]
      }
    ]
  }
}
```

Response — **202 Accepted** in 67 ms:
```json
{
  "statustype": "I",
  "code": 202,
  "date": "2026-09-01T02:23:15.814Z",
  "messageid": "ztg-mti1ldva4zy-0007",
  "status": {
    "reason": "Message accepted for EPTTS Processing, the message status can be viewed in the message status query",
    "code": "I001"
  }
}
```

Then the platform's own verdict, from `POST /MsgStatusQuery`:
```json
{
  "instanceIdentifier": "ztg-mti1ldva4zy-0007",
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

The same exchange shape repeats for the other case(s) this bug covers (`TC_DEST_008`, `TS_RECV_015`, `TS_RTN_021`); they are omitted here for length.
---
**Environment:**
- Masar Platform
- `:8444/masar-service/api/v1`
- tenant devsim
- via Citrix VPN

**Evidence:** the `api-log.html` artifact for each case records the submitted document and the
poll responses. Replay `eptts-api-packing-ts_pack_011` for the two-parent case.

---
**Priority:**
P1 – Critical
---
**Bug Type:**
Functional (Backend/API)
---
**Notes:**
**Covers test cases:** `TS_PACK_009`, `TS_PACK_011`, `TS_UNPK_005`, `TC_DEST_008`, `TS_RECV_015`, `TS_RTN_021`
