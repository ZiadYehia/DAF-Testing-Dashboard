#!/usr/bin/env node
/**
 * Generate an OpenAPI 3.1 description of the Masar B2B API.
 *
 * Usage:
 *   node scripts/eptts-api-openapi.js            # dry run (prints a summary)
 *   node scripts/eptts-api-openapi.js --write
 *
 * Output:
 *   automation-hub/exports/eptts-apis.openapi.json
 *
 * WHY WE WRITE THIS OURSELVES
 *
 * The platform exposes no machine-readable spec. `/v3/api-docs` and `/swagger-ui` return
 * `200 text/html`, but that is nginx's SPA catch-all — a deliberately bogus path returns
 * `200` too, so those responses prove nothing. There is no Swagger to read.
 *
 * So this file is hand-derived from behaviour VERIFIED against production on 2026-08-31,
 * recorded in data/eptts-api/modules/eptts-apis/knowledge/verified-live-contract.md. Where
 * the vendor's documentation and the live platform disagree, this describes the LIVE
 * platform and says so in the description — an accurate spec of what is deployed is more
 * useful than a faithful copy of a document that does not match it.
 *
 * Uses of the output:
 *   - drop it into editor.swagger.io (or any Swagger UI) for a browsable API reference
 *   - import into Postman ("Import → OpenAPI") as an alternative to the curated collection
 *   - diff it against a future vendor-published spec to find contract drift
 *
 * No secrets: auth is declared as a security scheme, never a value.
 */
const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')
const OUT = path.join(REPO, 'automation-hub', 'exports', 'eptts-apis.openapi.json')
const WRITE = process.argv.includes('--write')

const MASAR = 'https://192.168.225.195:8444/masar-service/api/v1'
const REGISTRY = 'https://192.168.225.195:8445/registry-service/api/v1'

// ─── reusable pieces ─────────────────────────────────────────────────────────

const bearerOnly = [{ bearerAuth: [] }]

/** The role guard matrix, stated per operation so it is visible where it bites. */
const ROLES = (mfg, dist, pharm) =>
  `\n\n**Role access** — manufacturer: ${mfg} · distributor: ${dist} · pharmacy: ${pharm}.`

const ASYNC_NOTE = `
**This endpoint is asynchronous.** A well-formed request returns \`202\` with
\`statustype: "I"\` / \`code: "I001"\` and means only *accepted for processing*. The outcome is
obtained by polling \`POST /MsgStatusQuery\` with the \`instanceIdentifier\` from the SBDH until
\`messagestatus\` starts with \`S\` (success) or \`E\`/\`F\` (failure).

A \`202\` therefore tells you nothing about whether the events were applied. Asserting on it
alone is the most common way to misread this API.`

const errorResponses = (envelope) => ({
  400: {
    description: 'Rejected synchronously — malformed envelope, missing SBDH, or a bad field.',
    content: { 'application/json': { schema: { $ref: `#/components/schemas/${envelope}` } } },
  },
  401: {
    description: 'Missing, malformed, or expired bearer token.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/NestError' } } },
  },
  403: {
    description: 'Authenticated, but this role may not call this endpoint.',
    content: { 'application/json': { schema: { $ref: `#/components/schemas/${envelope}` } } },
  },
})

const acceptResponse = {
  202: {
    description:
      'Accepted for processing. Poll `/MsgStatusQuery` for the real outcome. `messageid` echoes ' +
      'your `instanceIdentifier`, which is a cheap check that the SBDH was read.',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/AcceptEnvelope' },
        example: {
          statustype: 'I',
          code: 202,
          date: '2026-08-31T08:42:28.514Z',
          messageid: 'ztg-run1-0003',
          status: {
            reason:
              'Message accepted for EPTTS Processing, the message status can be viewed in the ' +
              'message status query',
            code: 'I001',
          },
        },
      },
    },
  },
}

const epcisRequestBody = {
  required: true,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/EpcisDocument' },
      example: {
        '@context': ['https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonld'],
        type: 'EPCISDocument',
        schemaVersion: '2.0',
        creationDate: '2026-08-31T08:42:20+03:00',
        sbdh: {
          header: { standard: 'EPCglobal', typeVersion: '2.0' },
          sender: { identifier: '8435308300002' },
          receiver: { identifier: '0085412000008' },
          documentIdentification: {
            standard: 'EPCglobal',
            typeVersion: '2.0',
            instanceIdentifier: 'ztg-run1-0003',
            type: 'masterData',
            creationDateAndTime: '2026-08-31T08:42:20+03:00',
          },
        },
        epcisBody: {
          eventList: [
            {
              type: 'ObjectEvent',
              eventTime: '2026-08-31T08:42:20+03:00',
              eventTimeZoneOffset: '+03:00',
              epcList: ['urn:epc:id:sgtin:84353083.05448.ZTGrun10002'],
              action: 'ADD',
              bizStep: 'commissioning',
              disposition: 'active',
              readPoint: { id: 'urn:epc:id:sgln:84353083.0000.0' },
              bizLocation: { id: 'urn:epc:id:sgln:84353083.0000.0' },
              ilmd: { lotNumber: 'LOT-ZTG-001', itemExpirationDate: '2030-12-31' },
            },
          ],
        },
      },
    },
    'application/xml': {
      schema: { type: 'string', description: 'EPCIS 1.2 / SOAP form. Accepted but not exercised by this suite.' },
    },
  },
}

// ─── schemas ─────────────────────────────────────────────────────────────────

const schemas = {
  Sbdh: {
    type: 'object',
    description:
      'Standard Business Document Header. Omitting it is rejected synchronously with `400` / `E003`.',
    required: ['sender', 'receiver', 'documentIdentification'],
    properties: {
      header: {
        type: 'object',
        properties: { standard: { type: 'string' }, typeVersion: { type: 'string' } },
      },
      sender: {
        type: 'object',
        required: ['identifier'],
        properties: {
          identifier: {
            type: 'string',
            description: '13-digit GLN of the sending party. Must match the token\'s `entityGln`.',
            example: '8435308300002',
          },
        },
      },
      receiver: {
        type: 'object',
        required: ['identifier'],
        properties: { identifier: { type: 'string', example: '0085412000008' } },
      },
      documentIdentification: {
        type: 'object',
        required: ['instanceIdentifier'],
        properties: {
          standard: { type: 'string' },
          typeVersion: { type: 'string' },
          instanceIdentifier: {
            type: 'string',
            description:
              'Caller-generated, must be unique. A reused value is rejected, and it is the key ' +
              'used to poll `/MsgStatusQuery`, so keep it.',
          },
          type: { type: 'string' },
          creationDateAndTime: { type: 'string', format: 'date-time' },
        },
      },
    },
  },

  EpcisEvent: {
    type: 'object',
    description:
      'One EPCIS 2.0 event. `ObjectEvent` covers commissioning, shipping, receiving, ' +
      'destruction, dispensing and returns; `AggregationEvent` covers packing and unpacking.',
    required: ['type', 'eventTime', 'eventTimeZoneOffset', 'action', 'bizStep'],
    properties: {
      type: { type: 'string', enum: ['ObjectEvent', 'AggregationEvent'] },
      eventTime: {
        type: 'string',
        format: 'date-time',
        description: 'ISO 8601 **with an offset**. A bare local time is rejected.',
      },
      eventTimeZoneOffset: { type: 'string', example: '+03:00' },
      epcList: {
        type: 'array',
        items: { type: 'string' },
        description:
          'SGTIN or SSCC URNs. On an `AggregationEvent` the children go in `childEPCs` and the ' +
          'parent SSCC in `parentID` instead.',
      },
      childEPCs: { type: 'array', items: { type: 'string' } },
      parentID: { type: 'string', example: 'urn:epc:id:sscc:84353083.0000000012' },
      action: { type: 'string', enum: ['ADD', 'OBSERVE', 'DELETE'] },
      bizStep: {
        type: 'string',
        description: 'CBV business step, e.g. `commissioning`, `packing`, `shipping`, `receiving`, `destroying`.',
      },
      disposition: {
        type: 'string',
        description: 'CBV disposition, e.g. `active`, `in_transit`, `destroyed`, `returned`.',
      },
      readPoint: { type: 'object', properties: { id: { type: 'string', example: 'urn:epc:id:sgln:84353083.0000.0' } } },
      bizLocation: { type: 'object', properties: { id: { type: 'string' } } },
      sourceList: {
        type: 'array',
        items: { type: 'object', properties: { type: { type: 'string' }, source: { type: 'string' } } },
      },
      destinationList: {
        type: 'array',
        items: { type: 'object', properties: { type: { type: 'string' }, destination: { type: 'string' } } },
      },
      bizTransactionList: {
        type: 'array',
        items: { type: 'object', properties: { type: { type: 'string' }, bizTransaction: { type: 'string' } } },
      },
      ilmd: {
        type: 'object',
        description: 'Lot and expiry. Required on commissioning.',
        properties: {
          lotNumber: { type: 'string' },
          itemExpirationDate: { type: 'string', format: 'date' },
        },
      },
      quantity: {
        type: 'integer',
        description:
          'Partial dispensing only. Note: no product on the devsim tenant currently supports a ' +
          'partial dispense type, so this path is untested there.',
      },
    },
  },

  EpcisDocument: {
    type: 'object',
    required: ['type', 'sbdh', 'epcisBody'],
    properties: {
      '@context': { type: 'array', items: { type: 'string' } },
      type: { type: 'string', enum: ['EPCISDocument'] },
      schemaVersion: { type: 'string', example: '2.0' },
      creationDate: { type: 'string', format: 'date-time' },
      sbdh: { $ref: '#/components/schemas/Sbdh' },
      epcisBody: {
        type: 'object',
        required: ['eventList'],
        properties: {
          eventList: {
            type: 'array',
            items: { $ref: '#/components/schemas/EpcisEvent' },
            description:
              'KNOWN DEFECT: an **empty** eventList returns `202` / `I001` rather than `400`. A ' +
              'document with no events is not meaningful and should be rejected.',
          },
        },
      },
    },
  },

  AcceptEnvelope: {
    type: 'object',
    properties: {
      statustype: { type: 'string', enum: ['I'], description: '`I` informational (accepted), `E` error.' },
      code: { type: 'integer', example: 202 },
      date: { type: 'string', format: 'date-time' },
      messageid: { type: 'string', description: 'Echoes the request `instanceIdentifier`.' },
      status: {
        type: 'object',
        properties: { reason: { type: 'string' }, code: { type: 'string', example: 'I001' } },
      },
    },
  },

  EpcisError: {
    type: 'object',
    description: 'Error envelope used by `/scp/SendEPCIS` and `/Dispensation`.',
    properties: {
      statustype: { type: 'string', enum: ['E'] },
      code: { type: 'integer', example: 400 },
      date: { type: 'string', format: 'date-time' },
      messageid: { type: 'string' },
      status: {
        type: 'object',
        properties: {
          reason: { type: 'string', example: 'Missing SBDH (Standard Business Document Header)' },
          code: { type: 'string', example: 'E003', description: 'Known: `E003` missing SBDH, `E016` missing productId.' },
        },
      },
    },
  },

  LogListError: {
    type: 'object',
    description: 'Error envelope used by `/VerifyProduct`.',
    properties: {
      logList: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', example: 'E' },
            code: { type: 'string', example: 'E016' },
            message: { type: 'string', example: 'JSON body must include productId' },
          },
        },
      },
    },
  },

  NestError: {
    type: 'object',
    description:
      'NestJS default envelope, used by `/epcis/json`, `/MsgStatusQuery` and every ' +
      'registry-service route. Three different error shapes across one API is a real ' +
      'consistency problem — a single shared "expect an error" assertion cannot work.',
    properties: {
      statusCode: { type: 'integer', example: 400 },
      timestamp: { type: 'string', format: 'date-time' },
      path: { type: 'string' },
      method: { type: 'string' },
      correlationId: { type: 'string' },
      message: { type: 'string' },
      error: { type: 'string', example: 'Bad Request' },
    },
  },

  AuthRequest: {
    type: 'object',
    description:
      'The body is **optional**. A valid `apikey` header alone authenticates. The legacy ' +
      'username/password path engages only when BOTH fields are present and non-empty; if ' +
      'either is empty, null or absent the credential check is skipped entirely.\n\n' +
      'PROBABLE DEFECT: a half-supplied credential (`{username: "x"}` with no password) returns ' +
      '`200` rather than `400`, so a caller that failed to populate its password would believe ' +
      'it authenticated with one.',
    properties: { username: { type: 'string' }, password: { type: 'string' } },
  },

  AuthResponse: {
    type: 'object',
    properties: {
      access_token: {
        type: 'string',
        description:
          'Bearer token, **900 s (15 min)** lifetime. Claims: `sub`, `role`, `entityId`, ' +
          '`entityGln`, `jti`, `source: "b2b"`, `principalType: "b2b_partner"`.',
      },
      refresh_token: { type: 'string', description: '~7-day expiry.' },
      token_type: { type: 'string', example: 'Bearer' },
      expires_in: { type: 'integer', example: 900 },
    },
  },

  MsgStatusQueryRequest: {
    type: 'object',
    required: ['instanceIdentifier'],
    properties: { instanceIdentifier: { type: 'string' } },
  },

  MsgStatusQueryResponse: {
    type: 'object',
    properties: {
      instanceIdentifier: { type: 'string' },
      messagestatus: {
        type: 'string',
        example: 'S - Successful',
        description:
          'NOTE THE CASING — the field is `messagestatus`, all lowercase. A camelCase ' +
          '`messageStatus` lookup misses it silently, so the poller sees no state and times out ' +
          'even though the submission succeeded.\n\n' +
          'The value is `"S - Successful"`, not a bare `SUCCESS`. The leading letter is the ' +
          'machine-readable part: `S` success, `E`/`F` failure, `P`/`I`/`Q` still processing.',
      },
      logList: {
        type: 'array',
        description:
          'PER-EVENT outcomes, and the best source of a failure reason. Assert on this as well ' +
          'as the overall status — a message can complete while an individual event inside it fails.',
        items: {
          type: 'object',
          properties: { type: { type: 'string' }, code: { type: 'string' }, message: { type: 'string' } },
        },
      },
    },
  },

  VerifyProductRequest: {
    type: 'object',
    description: 'Accepts an SGTIN URN, or a `productId` for a catalogue lookup.',
    properties: { sgtin: { type: 'string' }, productId: { type: 'string' } },
  },

  VerifyProductResponse: {
    type: 'object',
    description:
      'An UNKNOWN pack returns `200` with `verified: false`, **not** a `404`. A test asserting ' +
      'non-existence must therefore check `verified` / `alerts`, never the status code.',
    properties: {
      verified: { type: 'boolean' },
      sgtin: { type: 'string' },
      alerts: { type: 'array', items: { type: 'string', example: 'NOT_FOUND' } },
      verifiedAt: { type: 'string', format: 'date-time' },
      pack: {
        type: 'object',
        nullable: true,
        description: 'The authoritative state source for lifecycle assertions.',
        properties: {
          sgtin: { type: 'string' },
          gtin: { type: 'string' },
          serial: { type: 'string' },
          batchNumber: { type: 'string' },
          expiryDate: { type: 'string', format: 'date' },
          status: {
            type: 'string',
            enum: ['active', 'in_transit', 'dispensed', 'destroyed'],
            description:
              'The lifecycle field, and its vocabulary is **lowercase** — not the title-case ' +
              'names the test cases use ("Commissioned", "In transit"). A freshly commissioned ' +
              'pack reads `active`.',
          },
          currentGln: {
            type: 'string',
            description:
              'How custody is verified. It does NOT change at shipping — it stays with the ' +
              'sender until the receiver posts its receiving event.',
          },
          isRecalled: { type: 'boolean' },
          parentSscc: { type: 'string', nullable: true, description: 'Confirms aggregation / disaggregation.' },
          manufacturerGln: {
            type: 'string',
            nullable: true,
            description: 'Came back `null` for a pack whose GTIN belongs to a registered manufacturer — possible data gap.',
          },
        },
      },
      product: { type: 'object', nullable: true },
    },
  },
}

// ─── paths ───────────────────────────────────────────────────────────────────

const paths = {
  '/auth': {
    servers: [{ url: REGISTRY, description: 'registry-service' }],
    post: {
      tags: ['Authentication'],
      operationId: 'authenticate',
      summary: 'Exchange a B2B API key for a bearer token',
      description:
        'Lives on **registry-service (:8445)**. The vendor collection\'s ' +
        '`:8444/masar-service/api/v1/auth` returns `404` — it does not exist.\n\n' +
        'The `apikey` header is a credential used **once, here**. Every other endpoint ' +
        'authenticates with `Authorization: Bearer` alone; `apikey` alone returns `401`. So any ' +
        'test whose objective is "verify X with a valid/invalid API key" must target this ' +
        'endpoint, not the event endpoints.',
      security: [{ apiKeyAuth: [] }],
      requestBody: {
        required: false,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthRequest' } } },
      },
      responses: {
        200: {
          description: 'Token issued.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } },
        },
        401: {
          description:
            'Missing or invalid `apikey`, or a fully-supplied credential pair that is wrong ' +
            '("Invalid credentials"). No credential pair can substitute for the key, so the body ' +
            'can only ever narrow access, never widen it.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/NestError' } } },
        },
      },
    },
  },

  '/scp/SendEPCIS': {
    post: {
      tags: ['EPCIS submission'],
      operationId: 'sendEpcis',
      summary: 'Submit an EPCIS document (commissioning, packing, shipping, receiving, destruction, returns)',
      description:
        'The endpoint all 351 authored test cases target.' +
        ASYNC_NOTE +
        '\n\n`POST /epcis/json` is also live and neither supersedes the other; they differ in ' +
        'error envelope, which suggests different handlers. Which one is canonical is an open ' +
        'question for the product owner.' +
        ROLES('allowed', 'allowed', 'allowed'),
      security: bearerOnly,
      requestBody: epcisRequestBody,
      responses: { ...acceptResponse, ...errorResponses('EpcisError') },
    },
  },

  '/epcis/json': {
    post: {
      tags: ['EPCIS submission'],
      operationId: 'sendEpcisJson',
      summary: 'Alternative EPCIS submission endpoint',
      description:
        'Live alongside `/scp/SendEPCIS`. Same document, but errors come back in the **NestJS** ' +
        'envelope rather than the EPCIS one — so a shared negative-assertion helper written ' +
        'against `/scp/SendEPCIS` will not match here.' +
        ASYNC_NOTE,
      security: bearerOnly,
      requestBody: epcisRequestBody,
      responses: { ...acceptResponse, ...errorResponses('NestError') },
    },
  },

  '/Dispensation': {
    post: {
      tags: ['Dispensing'],
      operationId: 'dispense',
      summary: 'Dispense a pack (full or partial)',
      description:
        'CORRECTION TO THE VENDOR DOCS: the source spreadsheet and vendor collection describe ' +
        'this as returning `200` **synchronously**. The status code is right; the meaning is ' +
        'not. It acknowledges with `200`, and that `200` means *queued* — the pack is not ' +
        'dispensed until `MsgStatusQuery` says so.\n\n' +
        'Note this endpoint is the odd one out: `/scp/SendEPCIS` and `/epcis/json` acknowledge ' +
        'with `202`, `/Dispensation` with `200`. So do not assert the status code here — assert ' +
        'the polled `messagestatus`. Asserting `202` fails against the real platform, and ' +
        'reading `200` as success passes while the dispense actually failed.' +
        ASYNC_NOTE +
        '\n\nDispensing is refused for Dawana-integrated products with a channel message, so ' +
        'test data must be chosen from products where `isDawanaIntegration` is false.' +
        ROLES('**403 — refused outright**', 'allowed', 'allowed'),
      security: bearerOnly,
      requestBody: epcisRequestBody,
      responses: {
        200: {
          description:
            'Accepted for processing — **not** dispensed. Poll `/MsgStatusQuery` for the real ' +
            'outcome. This endpoint uses `200` where the other submission endpoints use `202`.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AcceptEnvelope' } } },
        },
        ...errorResponses('EpcisError'),
      },
    },
  },

  '/MsgStatusQuery': {
    post: {
      tags: ['Queries'],
      operationId: 'msgStatusQuery',
      summary: 'Poll the outcome of an asynchronous submission',
      description:
        'The other half of every write in this API.' +
        ROLES('allowed', 'allowed', 'allowed'),
      security: bearerOnly,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/MsgStatusQueryRequest' } } },
      },
      responses: {
        200: {
          description: 'Terminal or in-progress status.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/MsgStatusQueryResponse' },
              example: {
                instanceIdentifier: 'ztg-run1-0003',
                messagestatus: 'S - Successful',
                logList: [
                  { type: 'I', message: 'Commission (Items) event processed successfully' },
                  { type: 'I', message: 'Message processed successfully - all 1 event(s) completed' },
                ],
              },
            },
          },
        },
        404: {
          description:
            '**Not ready yet — keep polling.** "No message was found for the provided instance ' +
            'identifier. The message may still be initializing. Please retry after 10 seconds..." ' +
            'A poller that treats this as terminal makes every asynchronous test fail spuriously.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/NestError' } } },
        },
        400: {
          description: 'Missing `instanceIdentifier`.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/NestError' } } },
        },
      },
    },
  },

  '/VerifyProduct': {
    post: {
      tags: ['Queries'],
      operationId: 'verifyProduct',
      summary: 'Look up a pack and its lifecycle state',
      description:
        'The state oracle for assertions: `pack.status`, `pack.currentGln` and `pack.parentSscc` ' +
        'are what confirm that a commissioning, shipping, receiving or packing event actually ' +
        'took effect.' +
        ROLES('allowed', 'allowed', 'allowed'),
      security: bearerOnly,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/VerifyProductRequest' } } },
      },
      responses: {
        200: {
          description: 'Always `200` for a well-formed request — including for an unknown pack.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/VerifyProductResponse' } } },
        },
        400: {
          description: 'Neither `sgtin` nor `productId` supplied (`E016`).',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LogListError' } } },
        },
      },
    },
  },

  '/epcis': {
    get: {
      tags: ['Queries'],
      operationId: 'listEpcisMessages',
      summary: 'List submitted EPCIS messages',
      description: 'Message history for the authenticated party.' + ROLES('allowed', 'allowed', 'allowed'),
      security: bearerOnly,
      responses: {
        200: { description: 'Message list.', content: { 'application/json': { schema: { type: 'object' } } } },
      },
    },
  },

  '/scp/invoices': {
    get: {
      tags: ['Queries'],
      operationId: 'listInvoices',
      summary: 'List invoices',
      description: ROLES('**403 — refused**', 'allowed', 'allowed').trim(),
      security: bearerOnly,
      responses: {
        200: { description: 'Invoice list.', content: { 'application/json': { schema: { type: 'object' } } } },
        403: {
          description: 'Manufacturers have no invoices.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/NestError' } } },
        },
      },
    },
  },
}

// ─── assemble ────────────────────────────────────────────────────────────────

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'EPTTS — Masar B2B API',
    version: '2026-08-31',
    summary: 'Hand-derived spec for an API that publishes none.',
    description: [
      'Track-and-trace API for the Masar Platform (EPTTS), described from behaviour **verified',
      'against the live production host on 2026-08-31** over the Citrix VPN.',
      '',
      'The platform exposes no machine-readable spec: `/v3/api-docs` and `/swagger-ui` return',
      '`200 text/html`, but that is nginx\'s SPA catch-all — a deliberately bogus path returns',
      '`200` too. So this file is derived from live probing, not from a published document.',
      '',
      '**Where the vendor documentation and the live platform disagree, this describes the live',
      'platform** and flags the divergence in the relevant operation. The three that cost the',
      'most debugging time:',
      '',
      '1. `/auth` is on **registry-service :8445**, not masar-service :8444 (which 404s).',
      '2. `apikey` is used **only at `/auth`**; everything else takes `Authorization: Bearer` alone.',
      '3. `/Dispensation` is **asynchronous** — it acknowledges with `200`, but that means',
      '   *queued*, not dispensed. It is also the only submission endpoint using `200`, not `202`.',
      '',
      'Two behaviours documented here are probable defects rather than intended design, marked',
      'as such in place: an empty `eventList` is accepted with `202`, and a half-supplied',
      'credential pair authenticates with `200`.',
      '',
      'Full reasoning and evidence:',
      '`data/eptts-api/modules/eptts-apis/knowledge/verified-live-contract.md`.',
    ].join('\n'),
  },
  servers: [
    { url: MASAR, description: 'masar-service — EPCIS submission, dispensing, queries' },
    { url: REGISTRY, description: 'registry-service — authentication' },
  ],
  tags: [
    { name: 'Authentication', description: 'Minting a bearer token from a B2B API key.' },
    { name: 'EPCIS submission', description: 'Asynchronous event submission. Always poll for the outcome.' },
    { name: 'Dispensing', description: 'Pharmacy and distributor dispensing. Asynchronous.' },
    { name: 'Queries', description: 'Synchronous reads: message status, pack state, history, invoices.' },
  ],
  security: bearerOnly,
  components: {
    securitySchemes: {
      apiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'apikey',
        description:
          'B2B partner key, used **only** at `/auth`. Sending it to other endpoints is harmless ' +
          'but proves nothing about authorisation. Keys are held in `automation-hub/.env`; the ' +
          'platform cannot re-display an existing key, so a lost key must be rotated — which ' +
          'immediately invalidates whatever is using it.',
      },
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'From `/auth`. 900 s lifetime — long runs must re-authenticate.',
      },
    },
    schemas,
  },
  paths,
}

// ─── secret-leak guard ───────────────────────────────────────────────────────
// exports/ is committed, so a key reaching this file would be published.
const serialized = JSON.stringify(spec, null, 2) + '\n'
const envPath = path.join(REPO, 'automation-hub', '.env')
if (fs.existsSync(envPath)) {
  const secrets = [...fs.readFileSync(envPath, 'utf8').matchAll(/^\s*\w*(?:APIKEY|PASSWORD|SECRET|TOKEN)\w*=(.+)$/gm)]
    .map((m) => m[1].trim().replace(/^["']|["']$/g, ''))
    .filter((v) => v.length > 7 && !/^(UNKNOWN|TODO|CHANGEME)/i.test(v))
  const leaked = secrets.filter((s) => serialized.includes(s))
  if (leaked.length) {
    console.error(`REFUSING TO WRITE — ${leaked.length} secret value(s) present in the generated spec.`)
    process.exit(1)
  }
}

const opCount = Object.values(paths).reduce(
  (n, p) => n + Object.keys(p).filter((k) => ['get', 'post', 'put', 'patch', 'delete'].includes(k)).length, 0)

console.log(`OpenAPI 3.1 — ${opCount} operations across ${Object.keys(paths).length} paths, ` +
  `${Object.keys(schemas).length} schemas`)
console.log('no secret values present in the output')

if (WRITE) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, serialized)
  console.log(`\nwrote ${path.relative(REPO, OUT)} (${(serialized.length / 1024).toFixed(1)} KB)`)
} else {
  console.log('\n(dry run — pass --write)')
}
