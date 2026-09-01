---
title: >-
  [Business rule] Custody destinations are not validated — a return goes to a
  party that never supplied the pack, and a shipment goes to an unregistered GLN
status: draft
jira_key: null
reported_at: null
feature: api-shipping
priority: P1 – Critical
bug_type: Functional (Backend/API)
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-09-01T01:20:00.000Z'
---
Two custody rules that define who may hold stock are not enforced. Both were confirmed in a
clean run, and both are accepted with `messagestatus: "S - Successful"`.

**`TC_SHIP_036` — shipping to an unregistered destination.** A shipping event naming a GLN
that is not a registered trade party is accepted and committed. The supply chain's whole
premise is that stock only ever moves between known, licensed parties; an unregistered
destination means the platform has recorded product leaving the traceable chain to somewhere
it cannot describe. It also cannot be undone by the receiver, because there is no receiver.

**`TS_RTN_012` — returning to a party that never supplied the pack.** A return is accepted to
an arbitrary registered GLN rather than the partner the stock actually came from. A return is
the one movement whose destination is *determined* by history rather than chosen, so this is
not a missing input check — the platform holds the supplying party and does not consult it.

Taken together these are the same failure: **the destination of a custody transfer is written
to the trace without being validated against who is allowed to receive it.** Unlike the
malformed-input defects filed alongside this one, these documents are entirely well-formed —
no validator on syntax would catch them. They need the business rule.

The practical consequence is that the trace can show stock in the hands of a party that
never received it, or that does not exist. Anything built on custody — recall reach,
inventory reconciliation, regulatory reporting — is then wrong in a way that reads as
authoritative.

Worth checking as part of a fix whether the receiving side has the mirror gap: if an
unregistered or unrelated GLN can also *accept* stock, the chain can be closed in both
directions without either party being entitled to the goods.
---
**Steps to Reproduce:**

*TC_SHIP_036 — unregistered destination*
1. Connect the Citrix VPN and authenticate as the manufacturer.
2. Commission a pack and aggregate it into an SSCC.
3. Build a shipping `ObjectEvent` whose `destinationList` names an SGLN for a GLN that is not
   registered as a trade party.
4. `POST` to `:8444/masar-service/api/v1/scp/SendEPCIS` and poll `MsgStatusQuery`.

*TS_RTN_012 — return to a non-supplier*
1. Move a pack manufacturer → branch and have the branch receive it.
2. As the branch, build a return event whose receiver is a registered party that never
   supplied the pack (e.g. the pharmacy GLN rather than the manufacturer).
3. Submit and poll.
---
**Expected Result:**
1. The shipment is refused because the destination is not a registered party.
2. The return is refused because the destination is not the party that supplied the pack.
---
**Actual Result:**
1. Both are accepted: `S - Successful`, with `logList` reporting the event processed
   successfully and the message completed.
2. The trace records the transfer as valid.
---
**Request / Response (for debugging):**

Captured from the automated run. Credentials are masked; intermediate "still processing" polls are omitted so the submission and the verdict stand out.

<details><summary><code>TC_SHIP_036</code> — the exact exchange</summary>

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
  "creationDate": "2026-09-01T02:16:58+03:00",
  "sbdh": {
    "headerVersion": "1.3",
    "sender": {
      "identifier": "8435308300002"
    },
    "receiver": {
      "identifier": "1111111111116"
    },
    "documentIdentification": {
      "standard": "EPCGlobal",
      "typeVersion": "1.0",
      "instanceIdentifier": "ztg-mti1dgwt30b-0006",
      "type": "Events",
      "creationDateAndTime": "2026-09-01T02:16:58+03:00"
    }
  },
  "epcisBody": {
    "eventList": [
      {
        "type": "ObjectEvent",
        "eventTime": "2026-09-01T02:16:58+03:00",
        "eventTimeZoneOffset": "+03:00",
        "readPoint": {
          "id": "urn:epc:id:sgln:84353083.0000.0"
        },
        "bizLocation": {
          "id": "urn:epc:id:sgln:84353083.0000.0"
        },
        "action": "OBSERVE",
        "bizStep": "shipping",
        "disposition": "in_transit",
        "epcList": [
          "urn:epc:id:sscc:84353083.229008017"
        ],
        "sourceList": [
          {
            "type": "urn:epcglobal:cbv:sdt:owning_party",
            "source": "urn:epc:id:sgln:84353083.0000.0"
          }
        ],
        "destinationList": [
          {
            "type": "urn:epcglobal:cbv:sdt:owning_party",
            "destination": "urn:epc:id:sgln:0085412.00000.0"
          }
        ],
        "bizTransactionList": [
          {
            "type": "urn:epcglobal:cbv:btt:desadv",
            "bizTransaction": "INV-ZTG-MTI1DGWT30B-0005"
          }
        ]
      }
    ]
  }
}
```

Response — **202 Accepted** in 124 ms:
```json
{
  "statustype": "I",
  "code": 202,
  "date": "2026-09-01T02:16:56.070Z",
  "messageid": "ztg-mti1dgwt30b-0006",
  "status": {
    "reason": "Message accepted for EPTTS Processing, the message status can be viewed in the message status query",
    "code": "I001"
  }
}
```

Then the platform's own verdict, from `POST /MsgStatusQuery`:
```json
{
  "instanceIdentifier": "ztg-mti1dgwt30b-0006",
  "messagestatus": "S - Successful",
  "logList": [
    {
      "type": "I",
      "message": "Shipping event processed successfully"
    },
    {
      "type": "I",
      "message": "Message processed successfully — all 1 event(s) completed"
    }
  ]
}
```

</details>

<details><summary><code>TS_RTN_012</code> — the exact exchange</summary>

Preceded by 4 successful setup call(s) that built the stock this request acts on. The call below is the one under test.

```http
POST https://192.168.225.195:8444/masar-service/api/v1/scp/SendEPCIS
Authorization: «masked, 447 chars»

{
  "@context": [
    "https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonld"
  ],
  "type": "EPCISDocument",
  "schemaVersion": "2.0",
  "creationDate": "2026-09-01T02:22:12+03:00",
  "sbdh": {
    "headerVersion": "1.3",
    "sender": {
      "identifier": "0085412000008"
    },
    "receiver": {
      "identifier": "1234567890128"
    },
    "documentIdentification": {
      "standard": "EPCGlobal",
      "typeVersion": "1.0",
      "instanceIdentifier": "ztg-mti1jq3i6zc-0009",
      "type": "Events",
      "creationDateAndTime": "2026-09-01T02:22:12+03:00"
    }
  },
  "epcisBody": {
    "eventList": [
      {
        "type": "ObjectEvent",
        "eventTime": "2026-09-01T02:22:12+03:00",
        "eventTimeZoneOffset": "+03:00",
        "readPoint": {
          "id": "urn:epc:id:sgln:0085412.00000.0"
        },
        "bizLocation": {
          "id": "urn:epc:id:sgln:0085412.00000.0"
        },
        "action": "OBSERVE",
        "bizStep": "shipping",
        "disposition": "returned",
        "epcList": [
          "urn:epc:id:sscc:84353083.229300044"
        ],
        "sourceList": [
          {
            "type": "urn:epcglobal:cbv:sdt:owning_party",
            "source": "urn:epc:id:sgln:0085412.00000.0"
          }
        ],
        "destinationList": [
          {
            "type": "urn:epcglobal:cbv:sdt:owning_party",
            "destination": "urn:epc:id:sgln:84353083.0000.0"
          }
        ],
        "bizTransactionList": [
          {
            "type": "urn:epcglobal:cbv:btt:desadv",
            "bizTransaction": "RET-ZTG-MTI1JQ3I6ZC-0008"
          }
        ]
      }
    ]
  }
}
```

Response — **202 Accepted** in 96 ms:
```json
{
  "statustype": "I",
  "code": 202,
  "date": "2026-09-01T02:22:09.483Z",
  "messageid": "ztg-mti1jq3i6zc-0009",
  "status": {
    "reason": "Message accepted for EPTTS Processing, the message status can be viewed in the message status query",
    "code": "I001"
  }
}
```

Then the platform's own verdict, from `POST /MsgStatusQuery`:
```json
{
  "instanceIdentifier": "ztg-mti1jq3i6zc-0009",
  "messagestatus": "S - Successful",
  "logList": [
    {
      "type": "I",
      "message": "Return event processed successfully"
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
- Masar Platform
- `:8444/masar-service/api/v1`
- tenant devsim
- via Citrix VPN

**Evidence:** `api-log.html` for `eptts-api-shipping-tc_ship_036` and
`eptts-api-return-ts_rtn_012` — both show the full request and the successful poll result.

---
**Priority:**
P1 – Critical
---
**Bug Type:**
Functional (Backend/API)
---
**Notes:**
**Covers test cases:** `TC_SHIP_036`, `TS_RTN_012`
