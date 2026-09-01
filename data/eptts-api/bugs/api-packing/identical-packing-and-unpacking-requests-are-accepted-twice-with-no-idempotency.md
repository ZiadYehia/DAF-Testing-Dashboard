---
title: >-
  [Validation] An identical packing or unpacking request submitted twice is
  accepted both times — no idempotency or replay protection
status: draft
jira_key: null
reported_at: null
feature: api-packing
priority: P2 – High
bug_type: Functional (Backend/API)
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-09-01T01:25:00.000Z'
---
Submitting the same aggregation or disaggregation twice succeeds twice. Confirmed on
`TS_PACK_016` (pack the same children into the same SSCC again) and `TS_UNPK_011` (unpack the
same children from the same SSCC again) — both report `S - Successful` on the second attempt.

The second submission is *not* an exact byte-for-byte replay: each carries a fresh
`instanceIdentifier`, since the platform rejects a reused one. So the message-level replay
guard works; what is missing is the **event-level** check that the requested state change has
already been made. Packing packs that are already in that container, or unpacking packs that
are already out of it, are both no-ops being reported as successful work.

Why it matters, and why it is P2 rather than P1: it does not by itself corrupt the current
state — the pack ends up where it would have anyway. The damage is to the event history, which
is the actual product here. A duplicate aggregation event makes it look as though the container
was built twice, and any count or reconciliation derived by replaying events (rather than
reading current state) will double-count. In a system whose purpose is an auditable chain of
custody, a trace containing events that never physically happened is a real defect.

It is also the shape of a retry bug in a partner integration: a client that resends after a
timeout has no way to discover its first attempt succeeded, and the platform will happily
record the work twice.

Related, already filed for commissioning: *"An already-commissioned SGTIN can be
re-commissioned, and re-commissioning with a different expiry is accepted"* (`TC_COMM_003`,
`TC_COMM_012`). That is the same missing already-in-this-state check on a third feature, which
suggests the guard is absent generally rather than in the aggregation handler specifically.
---
**Covers test cases:** `TS_PACK_016`, `TS_UNPK_011`

**Steps to Reproduce:**
1. Connect the Citrix VPN and authenticate as the manufacturer.
2. Commission a pack and aggregate it into a fresh SSCC. Poll to `S - Successful`.
3. Submit the identical aggregation again with a new `instanceIdentifier` and nothing else
   changed.
4. Poll `MsgStatusQuery` to a terminal state.
5. Repeat the pair for unpacking: disaggregate, then disaggregate again.
6. Read the pack with `POST /VerifyProduct` and inspect `pack.parentSscc`, then list the
   events for that pack.
---
**Expected Result:**
1. The second submission is refused — the packs are already in (or already out of) that
   container, so there is no state change to make.
---
**Actual Result:**
1. The second submission is accepted, `messagestatus: "S - Successful"`, `logList` reporting
   the event processed successfully.
2. The event history now contains a packing (or unpacking) event that describes work the
   platform did not actually do.
---
**Request / Response (for debugging):**

Captured from the automated run. Credentials are masked; intermediate "still processing" polls are omitted so the submission and the verdict stand out.

<details><summary><code>TS_PACK_016</code> — the exact exchange</summary>

Preceded by 2 successful setup call(s) that built the stock this request acts on. The call below is the one under test.

```http
POST https://192.168.225.195:8444/masar-service/api/v1/scp/SendEPCIS
Authorization: «masked, 448 chars»

{
  "@context": [
    "https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonld"
  ],
  "type": "EPCISDocument",
  "schemaVersion": "2.0",
  "creationDate": "2026-09-01T02:17:56+03:00",
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
      "instanceIdentifier": "ztg-mti1evhg6rn-0005",
      "type": "Events",
      "creationDateAndTime": "2026-09-01T02:17:56+03:00"
    }
  },
  "epcisBody": {
    "eventList": [
      {
        "type": "AggregationEvent",
        "eventTime": "2026-09-01T02:17:56+03:00",
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
        "parentID": "urn:epc:id:sscc:84353083.229065435",
        "childEPCs": [
          "urn:epc:id:sgtin:84353083.05448.ZTGMTI1EVHG6RN0001"
        ]
      }
    ]
  }
}
```

Response — **202 Accepted** in 80 ms:
```json
{
  "statustype": "I",
  "code": 202,
  "date": "2026-09-01T02:17:53.505Z",
  "messageid": "ztg-mti1evhg6rn-0005",
  "status": {
    "reason": "Message accepted for EPTTS Processing, the message status can be viewed in the message status query",
    "code": "I001"
  }
}
```

Then the platform's own verdict, from `POST /MsgStatusQuery`:
```json
{
  "instanceIdentifier": "ztg-mti1evhg6rn-0005",
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

<details><summary><code>TS_UNPK_011</code> — the exact exchange</summary>

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
  "creationDate": "2026-09-01T02:23:48+03:00",
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
      "instanceIdentifier": "ztg-mti1kvyw4b-0015",
      "type": "Events",
      "creationDateAndTime": "2026-09-01T02:23:48+03:00"
    }
  },
  "epcisBody": {
    "eventList": [
      {
        "type": "AggregationEvent",
        "eventTime": "2026-09-01T02:23:48+03:00",
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
        "parentID": "urn:epc:id:sscc:84353083.229407647",
        "childEPCs": [
          "urn:epc:id:sgtin:84353083.05448.ZTGMTI1KVYW4B0010"
        ]
      }
    ]
  }
}
```

Response — **202 Accepted** in 93 ms:
```json
{
  "statustype": "I",
  "code": 202,
  "date": "2026-09-01T02:23:46.240Z",
  "messageid": "ztg-mti1kvyw4b-0015",
  "status": {
    "reason": "Message accepted for EPTTS Processing, the message status can be viewed in the message status query",
    "code": "I001"
  }
}
```

Then the platform's own verdict, from `POST /MsgStatusQuery`:
```json
{
  "instanceIdentifier": "ztg-mti1kvyw4b-0015",
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
**Environment:** Masar Platform · `:8444/masar-service/api/v1` · tenant devsim · via Citrix VPN

**Evidence:** `api-log.html` for `eptts-api-packing-ts_pack_016` and
`eptts-api-unpacking-ts_unpk_011` — each shows both submissions and both successful polls.

---
**Priority:**
P2 – High
---
**Bug Type:**
Functional (Backend/API)
