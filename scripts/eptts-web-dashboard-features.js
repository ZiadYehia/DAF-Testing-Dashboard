#!/usr/bin/env node
/**
 * Build the EPTTS Web dashboard modules + features from a Phase 4 discovery manifest.
 *
 * Usage:
 *   node scripts/eptts-web-dashboard-features.js <manifest.json> <shotsDir>            # dry run
 *   node scripts/eptts-web-dashboard-features.js <manifest.json> <shotsDir> --write
 *
 * Creates, per discovered page, data/eptts-web/features/<slug>/:
 *   metadata.json            { module: "<module slug>" }
 *   workflow.md              Feature Details, Business Purpose, UI Elements, Happy Path,
 *                            Edge Cases, API calls observed, Notes
 *   screenshots/<slug>.jpg   copied from the discovery run (JPG, since .gitignore blocks *.png)
 *   <slug>-testcases.md      + -v1.md, canonical 13-column table
 *   execution-status-v1.json all new_added — nothing has been executed yet
 *
 * And data/eptts-web/modules/<slug>/module.json + knowledge/module-overview.md.
 *
 * Everything here is derived from what was actually observed in the browser; nothing
 * about page behaviour is invented. Where the discovery could not establish something,
 * the workflow says so rather than guessing.
 */
const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')
const APP_DIR = path.join(REPO, 'data', 'eptts-web')
const [manifestPath, shotsDir] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const WRITE = process.argv.includes('--write')

if (!manifestPath || !shotsDir) {
  console.error('usage: node scripts/eptts-web-dashboard-features.js <manifest.json> <shotsDir> [--write]')
  process.exit(1)
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

// ─── modules ─────────────────────────────────────────────────────────────────

// The dashboard's module tree is owned by scripts/eptts-web-module-tree.js, which mirrors
// the real sidebar (11 groups). This map exists only so workflow.md can print a module's
// display name and base URL; `platform` is kept as a LABEL for the dashboard portal and is
// no longer written to disk as a module. See writeModules below.
const MODULES = {
  platform: {
    name: 'Platform Dashboard',
    icon: 'LayoutDashboard',
    order: 2,
    description: 'Main EPTTS dashboard (:8444) — information centre, reporting, analytics, audit, and admin settings.',
    portal: 'dashboard',
    baseUrl: 'https://192.168.225.195:8444',
  },
  registry: {
    name: 'Master Data Registry',
    icon: 'BookMarked',
    order: 3,
    description: 'Registry portal (:8445) — trade parties, GS1 prefixes, products, pharmacy onboarding, and B2B API keys.',
    portal: 'registry',
    baseUrl: 'https://192.168.225.195:8445',
  },
  billing: {
    name: 'Billing Portal',
    icon: 'Receipt',
    order: 4,
    description: 'Billing portal (:8446) — unbilled operations, invoices, revenue reports, and fee configuration.',
    portal: 'billing',
    baseUrl: 'https://192.168.225.195:8446',
  },
}

/**
 * Per-page authored context - only what discovery could not infer on its own.
 *
 * Keyed "<portal>:<pageName>" because page names repeat across portals: both the main
 * dashboard and the Registry have a "products" page, and Registry and Billing both
 * have a "dashboard".
 */
const PAGE_META = {
  "dashboard:shipping": {
    module: "product-movement", priority: "P1", feature: "Shipping",
    purpose:
      "Where a consignment leaves a party: an invoice number is entered, SSCCs are attached and a shipping event is written. The page loads the registry's distributor/hospital/branch/pharmacy lists to pick a destination, so a missing or inactive party here blocks despatch entirely. Custody does NOT move at this step \u2014 the pack stays with the sender until the receiver confirms \u2014 which is the single most misunderstood rule in the flow.",
  },
  "dashboard:receiving": {
    module: "product-movement", priority: "P1", feature: "Receiving",
    purpose:
      "The other half of a transfer, and the step that actually moves custody. Lists invoices in `dispatched,in_transit` and lets the holder confirm them. Six filters (invoice, SSCC, GLN, destination, date range) matter because a receiver who cannot find an inbound shipment cannot accept stock, and the stock stays unusable while it waits.",
  },
  "dashboard:dispensing": {
    module: "product-movement", priority: "P1", feature: "Dispensing",
    purpose:
      "The terminal step for a pack: scanned out to a patient against a prescription. Queries packs with `status=partially_dispensed` for the current GLN, so it is also the only dashboard view of partial state. Irreversible, which makes the scan-validation and duplicate-dispense paths the highest-value checks.",
  },
  "dashboard:return-shipping": {
    module: "product-movement", priority: "P2", feature: "Return Shipping",
    purpose:
      "Sending stock back upstream to the branch that supplied it. Requires a free-text reason, which is a compliance artefact rather than a convenience \u2014 a return with no stated cause is not auditable. Returns must travel back to the original supplier, not an arbitrary party.",
  },
  "dashboard:return-receiving": {
    module: "product-movement", priority: "P2", feature: "Return Receiving",
    purpose:
      "Accepting returned stock, split into Incoming Returns and My Returns. This is the ONLY transition that moves packs out of a terminal-looking state back into sellable inventory, so a defect here silently resurrects stock that should not be re-sold. The table exposes a DAWANA PRODUCT column, meaning Dawana-integrated items are handled differently on this path.",
  },
  "dashboard:cancel-transfer": {
    module: "product-movement", priority: "P2", feature: "Cancel Transfer",
    purpose:
      "Reverses an already-submitted event, keyed to the ORIGINAL EVENT with a reason and a requester GLN. A cancellation is itself an auditable record rather than a deletion, so the thing to verify is that the original event remains visible in the trace alongside its cancellation.",
  },
  "dashboard:transfer-history": {
    module: "product-movement", priority: "P2", feature: "Transfer History",
    purpose:
      "The despatch ledger, and the operational answer to 'where did this consignment go?'. Carries both platform STATUS and DAWANA STATUS with a LAST SYNC column \u2014 two systems that can disagree, which makes a stale or diverging Dawana status a real and checkable failure mode.",
  },
  "dashboard:operations": {
    module: "product-movement", priority: "P3", feature: "Operations",
    purpose:
      "A flat feed of every action this portal has submitted, with its reference and status. Useful as the cross-check for asynchronous work: an action that succeeded on screen but never reached a terminal state here is exactly the class of bug the API's 202-means-queued behaviour produces.",
  },
  "dashboard:individual-packs": {
    module: "product-structure", priority: "P2", feature: "Individual Packs",
    purpose:
      "Handling loose packs outside any container \u2014 scanning them, unpacking them from a parent, or entering them by hand. Manual entry is the risky path: it bypasses the barcode, so identifier validation is the only thing standing between a typo and a corrupted trace.",
  },
  "dashboard:aggregation": {
    module: "product-structure", priority: "P1", feature: "Aggregation",
    purpose:
      "Nesting packs into an SSCC container, with a LEVEL column for multi-level hierarchies and a Reaggregate action. A completed packing event SEALS the container, so appending to one is refused \u2014 deliberate, and it stops stock being added to something that may already have shipped. Reaggregate exists precisely because sealing is one-way.",
  },
  "dashboard:repack": {
    module: "product-structure", priority: "P3", feature: "Repack",
    purpose:
      "Bulk 3PL repack ingestion: a logistics provider uploads the result of physically rebuilding containers, and the platform reconciles the new parent/child structure. Asynchronous with a job list, so the RESULT column, not the upload response, is what says whether it worked.",
  },
  "dashboard:scan-pack": {
    module: "product-actions", priority: "P2", feature: "Scan Pack",
    purpose:
      "The barcode workbench: scan a DataMatrix, see what the platform knows, and keep a scan log. It is the fastest way to answer 'is this identifier even valid?', so its parsing of the GS1 element string \u2014 AI (01) GTIN plus (21) serial \u2014 is what everything downstream depends on.",
  },
  "dashboard:product-destruction": {
    module: "product-actions", priority: "P1", feature: "Product Destruction",
    purpose:
      "Requests destruction of stock, recording reason, initiator GLN and affected items. Terminal and irreversible: once applied the packs can never re-enter the supply chain. That makes the confirmation step and the role restriction more important to verify than the happy path.",
  },
  "dashboard:product-verification": {
    module: "product-actions", priority: "P1", feature: "Product Verification",
    purpose:
      "Answers the authenticity question for a single pack, from either an SGTIN URN or a scanned element string. Note an UNKNOWN pack is not an error condition \u2014 the API returns 200 with `verified: false` \u2014 so a test asserting non-existence must read the verdict, never the status code, and the page must show 'not verified' rather than a blank result.",
  },
  "dashboard:product-recall": {
    module: "product-actions", priority: "P1", feature: "Product Recall",
    purpose:
      "Regulator-facing: withdraws a GTIN or lot from circulation against a circular number, with a PROGRESS column tracking how much of the affected stock has been accounted for. Scope is the critical field \u2014 recalling a whole GTIN when only one lot is affected is as damaging as missing the recall.",
  },
  "dashboard:epcis-xml-upload": {
    module: "file-upload", priority: "P2", feature: "EPCIS XML Transactions",
    purpose:
      "Bulk EPCIS XML submission for partners without an API integration: download a template, queue files, submit, then read per-message STATUS and ERRORS. Bulk paths fail differently from single calls \u2014 partial acceptance and per-row errors \u2014 so the ERRORS column is the feature, not a detail.",
  },
  "dashboard:commissioning-packing-csv": {
    module: "file-upload", priority: "P2", feature: "Commissioning and Packing CSV",
    purpose:
      "CSV import for commissioning and packing, with source and destination GLNs and a job list carrying DURATION and RESULT. The GLN pair is what makes an import attributable; a job that completes with the wrong source GLN writes events against the wrong party.",
  },
  "dashboard:inventory": {
    module: "master-data", priority: "P1", feature: "Inventory",
    purpose:
      "Pack-level stock for the current party: SGTIN, DataMatrix, batch, expiry, status and location. The operational source of truth for 'what do I hold?', and the natural place to confirm that a movement elsewhere actually changed holdings. CSV export makes it the reconciliation tool too.",
  },
  "dashboard:pharmacy-stock": {
    module: "master-data", priority: "P2", feature: "Pharmacy Stock",
    purpose:
      "Aggregate stock per pharmacy, splitting RECEIVED from IN TRANSIT against a TOTAL. That split is the point: it is where the custody-moves-on-receipt rule becomes visible to an operator, and a figure landing in the wrong column means the rule was applied wrongly.",
  },
  "dashboard:mdm-registry": {
    module: "master-data", priority: "P1", feature: "MDM Registry",
    purpose:
      "The master-data authority behind every validation, in three tabs \u2014 Parties, Prefixes, Products. Carries GCP LEN, which decides how an SGTIN URN is parsed: a wrong prefix length silently produces valid-looking identifiers that resolve to nothing. Also offers bulk JSON upload and re-sync, so drift between this and the trading data is itself a failure mode.",
  },
  "dashboard:trace": {
    module: "monitoring", priority: "P1", feature: "Trace",
    purpose:
      "Full event history for one pack or container, plus parent-container lookup. This is the system-of-record view a regulator or investigator reads, so a gap or a wrongly-ordered event here is worse than a broken page: the trace is the product.",
  },
  "dashboard:epcis-messages": {
    module: "monitoring", priority: "P1", feature: "EPCIS Messages",
    purpose:
      "Every B2B EPCIS message with SUCCEEDED and FAILED counts per message. Directly exposes the platform's most-misread behaviour \u2014 a message can be accepted and still have failed events \u2014 so the per-event counts, not the message status, are what tell an operator the truth. Also allows sending raw XML, which makes it the manual reproduction tool for an API defect.",
  },
  "dashboard:message-log": {
    module: "monitoring", priority: "P2", feature: "Message Log",
    purpose:
      "Integration audit log at the HTTP level: channel, direction, method, path, status and processing time. Where an integration failure is actually diagnosed, and the only place a 5xx or a slow endpoint becomes visible after the fact.",
  },
  "dashboard:webhook-history": {
    module: "monitoring", priority: "P3", feature: "Webhook History",
    purpose:
      "Outbound webhook delivery attempts and their outcomes. Silent failure here means a partner system is out of step with the platform and nobody has been told, which is why delivery status and retry behaviour matter more than the page's own presentation.",
  },
  "dashboard:announcements": {
    module: "administration", priority: "P3", feature: "Announcements",
    purpose:
      "Authoring side of the Information Center: platform staff publish notices that every trade partner reads. The pairing to test is publication \u2014 what is created here must appear there, with the right audience and the right urgency.",
  },
  "dashboard:mobile-versions": {
    module: "administration", priority: "P3", feature: "Mobile Versions",
    purpose:
      "Version gate for the EPTTS Mobile app (the separate `eptts-mobile` app). Controls which client builds are allowed to connect, so a wrong entry can lock working devices out of the field or let an unsupported build keep writing events.",
  },
  "dashboard:integration-downloads": {
    module: "integrations", priority: "P3", feature: "Integration Downloads",
    purpose:
      "What partners fetch to integrate: a Postman collection and the latest master-data snapshot, with version management. Worth noting the page currently renders an error banner because one of its backing endpoints 404s \u2014 the content still loads, so the failure is visible but not blocking.",
  },
  "dashboard:pos-partners": {
    module: "integrations", priority: "P3", feature: "POS Partners",
    purpose:
      "Registered point-of-sale integrators. Distinct from the POS Partners TAB inside /admin, which is a different surface over related data \u2014 both exist and both are covered, and a disagreement between them would itself be the finding.",
  },
  "dashboard:agent-monitoring": {
    module: "desktop-agent", priority: "P3", feature: "Desktop Agent Monitoring",
    purpose:
      "Health of the deployed Windows Masar Agent fleet (the separate `eptts` app). Tested here from the administrator's side: what the dashboard reports about agents, not what the agent does.",
  },
  "dashboard:agent-devices": {
    module: "desktop-agent", priority: "P3", feature: "Desktop Agent Devices",
    purpose:
      "Registry of machines running the desktop agent. Device identity is what ties an event to a physical location, so a duplicate or mis-assigned device makes the resulting trace misleading.",
  },
  "dashboard:activation-keys": {
    module: "desktop-agent", priority: "P2", feature: "Activation Keys",
    purpose:
      "Issues and revokes the keys that let a desktop agent connect. Security-relevant: a key that stays valid after revocation is an access-control defect, and the platform generally cannot re-display an issued key, so the one-time-display behaviour is worth verifying explicitly.",
  },
  "dashboard:agent-updates": {
    module: "desktop-agent", priority: "P3", feature: "Desktop Agent Updates",
    purpose:
      "Publishes agent builds and controls rollout. A bad update reaches every pharmacy counter running the agent, so rollout scoping and rollback are the parts that matter.",
  },
  "dashboard:information-center": {
    module: "information-center", priority: "P3", feature: "Information Center",
    purpose:
      "The post-login landing page. Publishes platform announcements, upcoming compliance dates, guides and support contacts to trade partners. Read-only for every role, and the only page every role can reach - which makes it the de-facto fallback route when navigation fails.",
  },
  "dashboard:command-center": {
    module: "reports", priority: "P1", feature: "Command Center",
    purpose:
      "The national operations overview: pack counts by lifecycle status, stock value, partner activity and expiry exposure. This is the page a regulator looks at first, so wrong numbers here are worse than a broken page - they are believed.",
  },
  "dashboard:reporting": {
    module: "reports", priority: "P2", feature: "Reports",
    purpose:
      "Stock and shipment reporting with a date-range filter, search, pagination and CSV export. The export is what partners reconcile against, so column fidelity matters as much as the on-screen totals.",
  },
  "dashboard:analytics": {
    module: "reports", priority: "P2", feature: "Analytics",
    purpose:
      "Four analytical views over the same traceability data - Activity, Inventory, Shipments and Expiry risk. Expiry risk is the commercially significant one: it drives write-off decisions.",
  },
  "dashboard:violations": {
    module: "reports", priority: "P2", feature: "Violations",
    purpose:
      "Compliance violations raised against trade partners, bucketed by severity. Drives regulatory follow-up, so a missed violation is a compliance failure rather than a display bug.",
  },
  "dashboard:audit-console": {
    module: "reports", priority: "P1", feature: "Audit Console",
    purpose:
      "The regulatory audit trail across four tabs - Regulatory events, EDA submissions, Master-data changes and Integrity. This is the evidence record: it must be complete, immutable and attributable. It also carries a 'What is not recorded?' disclosure, which is itself worth verifying against reality.",
  },
  "dashboard:master-data": {
    module: "integrations", priority: "P2", feature: "Master Data Snapshots",
    purpose:
      "Generates and distributes full master-data snapshots and incremental deltas that integrators pull via the manifest endpoint. Each file is SHA-256 stamped and the manifest is HMAC-signed, so integrity verification is part of the contract rather than optional.",
  },
  "dashboard:settings-admin": {
    module: "administration", priority: "P1", feature: "Settings (Administration)",
    purpose:
      "The full platform administration surface: 15 tabs covering partner types (Government, Manufacturer, Distributor, Dispenser), Pharmacies and Pharmacy Admins, POS Partners, B2B Partners, Platform Staff, User Locks, Geography and System Configuration. The highest-privilege page in the product - and currently unreachable from the navigation menu.",
  },
  "dashboard:products": {
    module: "master-data", priority: "P2", feature: "Product Display",
    purpose:
      "Browses the registered product catalogue as the platform sees it. Also unreachable from the navigation menu.",
  },
  "registry:dashboard": {
    module: "registry", priority: "P2", feature: "Registry Dashboard",
    purpose:
      "Registry portal landing view - opens directly onto the Parties register.",
  },
  "registry:parties": {
    module: "registry", priority: "P1", feature: "Parties",
    purpose:
      "The authoritative trade-party register - every manufacturer, distributor, branch and pharmacy with its GLN, GS1 prefix, GCP length, licence status and parent. This is also where B2B API keys are issued, via the per-row 'B2B Key' action; the platform cannot display an existing key, only replace it, so every rotation is irreversible.",
  },
  "registry:prefixes": {
    module: "registry", priority: "P2", feature: "GS1 Prefixes",
    purpose:
      "GS1 Company Prefixes and their owning GLN. The GCP length here determines how every SGTIN and SSCC for that partner is parsed, so a wrong prefix silently corrupts EPC interpretation across the whole platform.",
  },
  "registry:products": {
    module: "registry", priority: "P1", feature: "Registry Products",
    purpose:
      "The authoritative product catalogue: GTIN, name, manufacturer, MAH GLN, unit price, dispense type and the Dawana-integration flag. Two fields here drive API behaviour directly - dispenseType decides whether partial dispensing is possible at all, and the Dawana flag blocks dispensing through the B2B API entirely. The GTIN/name field-swap defect is visible on this page.",
  },
  "registry:register-pharmacy": {
    module: "registry", priority: "P2", feature: "Register Pharmacy",
    purpose:
      "Pharmacy onboarding form - the widest input surface in the product (25 fields), which makes it the highest-value target for mandatory-field and format validation testing.",
  },
  "billing:dashboard": {
    module: "billing", priority: "P2", feature: "Billing Dashboard",
    purpose:
      "Billing portal landing view - loads a MAH's outstanding dues by GLN.",
  },
  "billing:unbilled-operations": {
    module: "billing", priority: "P2", feature: "Unbilled Operations",
    purpose:
      "Lists a MAH's packing operations that have not yet been invoiced, loaded by MAH GLN. This is the input to invoice generation, so an omission here becomes lost revenue.",
  },
  "billing:invoices": {
    module: "billing", priority: "P1", feature: "Invoices",
    purpose:
      "Issued invoices with piece counts, billing charge, e-service fee, total and payment state. These are financial records - arithmetic correctness and immutability after payment are the whole point.",
  },
  "billing:reports": {
    module: "billing", priority: "P2", feature: "Billing Reports",
    purpose:
      "Revenue and billing reporting across MAHs and periods.",
  },
  "billing:configuration": {
    module: "billing", priority: "P2", feature: "Fee Configuration",
    purpose:
      "Price-band table driving per-unit fees (from-price, to-price, fee per unit). Changing a band changes what every partner is charged, so boundary behaviour at band edges is the critical case.",
  },
}

/** PAGE_META lookup for a discovered page, keyed by portal so names cannot collide. */
function metaFor(page) {
  return PAGE_META[`${page.portal}:${page.name}`]
}

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Feature slug for a discovered page: portal-prefixed so the three portals never collide. */
function featureSlug(page) {
  const prefix = page.portal === 'dashboard' ? 'web' : page.portal
  return `${prefix}-${slugify(page.name)}`
}

function moduleFor(page) {
  const meta = metaFor(page)
  if (meta?.module) return meta.module
  // No silent fallback for dashboard pages: the sidebar has 11 modules and guessing one
  // would quietly file a feature in the wrong place. Registry/billing pages still map to
  // their portal, which IS their module.
  if (page.portal === 'dashboard') {
    throw new Error(
      `no PAGE_META entry for "dashboard:${page.name}" — add one (with its module) before ` +
      'generating this page',
    )
  }
  return page.portal
}

// ─── test-case generation ────────────────────────────────────────────────────

const ENVIRONMENT = 'Masar Platform · https://192.168.225.195:8444 · tenant devsim'
const COLUMNS = [
  'Feature ID', 'TestCase ID', 'Tester', 'Validity', 'Test Cases Title / Objective',
  'Environment', 'Pre-condition', 'Test Data', 'Steps', 'Expected Results',
  'Status', 'Attachment', 'Type',
]

/**
 * Derive test cases from what was actually observed on the page. Deliberately
 * conservative: render/navigation/permission cases are generated for every page, and
 * table/filter/tab/export cases only when the page really has those controls.
 */
function casesFor(page, featureId, prefix, baseUrl) {
  const cases = []
  let n = 0
  const id = () => `${prefix}_${String(++n).padStart(3, '0')}`
  const pre = (extra = '') =>
    `1. Citrix VPN connected 2. Browser open at ${baseUrl} 3. Logged in as Platform Admin` +
    (page.portal === 'dashboard' ? ` 4. User is on the ${page.headings[0] || page.name} page` : ` 4. ${page.portal} portal open`) +
    (extra ? ` 5. ${extra}` : '')

  const add = (validity, title, steps, expected, type = 'Functional', data = 'Not Applicable', extraPre = '') =>
    cases.push({ id: id(), validity, title, pre: pre(extraPre), data, steps, expected, type })

  add('Positive', `Validate that the ${page.headings[0] || page.name} page renders with its heading and primary controls`,
    `1. Navigate to ${page.route} 2. Observe the page heading 3. Observe the primary controls`,
    `1. The page loads without error 2. The heading "${page.headings[0] || page.name}" is displayed` +
    (page.buttons.length ? ` 3. The controls ${page.buttons.slice(0, 4).map((b) => `"${b}"`).join(', ')} are visible` : ''))

  if (page.portal === 'dashboard') {
    add('Positive', `Validate that ${page.route} is reachable by direct URL and survives a refresh`,
      `1. Enter ${baseUrl}${page.route} in the address bar 2. Observe the page 3. Refresh the browser`,
      `1. The page loads directly without redirecting to /information-center 2. The same page is shown after refresh`)
  }

  if (page.tables?.length) {
    const cols = page.tables[0].columns || []
    if (cols.length) {
      add('Positive', 'Validate that the table displays all expected columns',
        '1. Observe the table header row',
        `1. The columns ${cols.slice(0, 10).map((c) => `"${c}"`).join(', ')} are displayed in order`)
    }
    add('Positive', 'Validate that the table renders an empty state when no records match',
      '1. Apply a filter or search value that matches no records 2. Observe the table body',
      '1. An empty-state message is displayed 2. No stale rows from the previous result remain 3. No console error occurs')
  }

  if (page.tabs?.length > 1) {
    add('Positive', 'Validate that every tab opens and loads its own data',
      `1. Click each tab in turn: ${page.tabs.slice(0, 8).join(', ')} 2. Observe the content area after each`,
      '1. Each tab becomes active when clicked 2. Each tab loads its own content without error 3. The previous tab\'s data is not shown under the new tab')
  }

  const hasSearch = page.inputs?.some((i) => /search|query|filter/i.test(`${i.name} ${i.placeholder} ${i.label}`))
  if (hasSearch) {
    add('Positive', 'Validate that search filters the result set',
      '1. Enter a value known to match at least one record in the search field 2. Observe the results',
      '1. Only records matching the search value are displayed 2. The result count reflects the filtered set')
    add('Negative', 'Validate that search handles a no-match value without error',
      '1. Enter a value that matches no record 2. Observe the results',
      '1. An empty state is displayed 2. No error is shown and the page remains usable')
  }

  if (page.buttons?.some((b) => /export|csv/i.test(b))) {
    add('Positive', 'Validate that the CSV export downloads and matches the on-screen data',
      '1. Apply a filter 2. Click Export CSV 3. Open the downloaded file',
      '1. A CSV file downloads 2. Its rows match the filtered on-screen rows 3. Its columns match the table columns')
  }

  if (page.inputs?.length >= 8) {
    add('Negative', 'Validate that submitting the form with all mandatory fields empty is rejected',
      '1. Leave every field empty 2. Submit the form',
      '1. The form is not submitted 2. A validation message is displayed for each mandatory field')
    add('Negative', 'Validate that an invalid GLN check digit is rejected',
      '1. Enter a 13-digit GLN whose GS1 check digit is invalid 2. Submit the form',
      '1. The form is rejected 2. A message indicates the GLN failed check-digit validation',
      'Functional', 'GLN: 8435308300003 (invalid check digit)')
  }

  add('Negative', 'Validate that a non-privileged role cannot reach this page',
    `1. Log in as a role without access to this page 2. Attempt to open ${page.route} directly by URL`,
    '1. Access is refused or the user is redirected 2. No data from this page is exposed 3. Hiding the menu entry alone is not sufficient')

  add('Negative', 'Validate that the page handles an expired session',
    '1. Leave the page open until the session expires 2. Trigger an action that calls the API',
    '1. The user is redirected to the Keycloak login page 2. No stale data is displayed 3. No unhandled console error occurs')

  if (page.xhr?.length) {
    add('Positive', 'Validate that the page surfaces a backend failure instead of failing silently',
      `1. Cause ${page.xhr[0].split(' ')[1] || 'the page API call'} to fail (e.g. disconnect the VPN) 2. Reload the page`,
      '1. An error state or message is displayed 2. The page does not show empty data as though it were a valid result',
      'Functional')
  }

  return cases
}

function testcaseTable(title, featureId, cases) {
  const rows = cases.map((c) => `| ${[
    featureId, c.id, 'Ziad Yehia', c.validity, c.title, ENVIRONMENT,
    // The table's Status column takes the TEST-CASE vocabulary — Pass / Fail /
    // Blocked-Skipped / Under Testing. `new_added` is the EXECUTION vocabulary and belongs
    // only in execution-status-v1.json; writing it here leaks one into the other and fails
    // the validator (it did, across 140 rows, before this was pinned down).
    c.pre, c.data, c.steps, c.expected, 'Under Testing', '', c.type,
  ].map((x) => String(x).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim()).join(' | ')} |`)
  return [
    `# ${title} Test Cases`, '',
    `| ${COLUMNS.join(' | ')} |`,
    '|' + '---|'.repeat(COLUMNS.length),
    ...rows, '',
  ].join('\n')
}

// ─── workflow doc ────────────────────────────────────────────────────────────

/**
 * Portal-level facts (display label, base URL) for a page.
 *
 * MODULES is keyed by PORTAL, not by module. `mod` is now one of the 11 real sidebar module
 * slugs, and every dashboard page shares one base URL regardless of which module owns it —
 * so looking MODULES up by `mod` throws for anything outside platform/registry/billing.
 */
function portalOf(page) {
  const key = page.portal === 'dashboard' ? 'platform' : page.portal
  const entry = MODULES[key]
  if (!entry) throw new Error(`unknown portal "${page.portal}" for page "${page.name}"`)
  return entry
}

function workflowFor(page, slug, featureId, mod, meta) {
  const L = []
  const heading = meta?.feature || page.headings[0] || page.name
  L.push(`# ${heading} — Dashboard Workflow`, '')
  L.push('## Feature Details', '', '| Field | Value |', '|-------|-------|')
  L.push(`| **Feature Name** | ${heading} |`)
  L.push(`| **Slug** | \`${slug}\` |`)
  L.push(`| **Feature ID** | \`${featureId}\` |`)
  L.push(`| **Module** | ${mod} |`)
  L.push(`| **Portal** | ${portalOf(page).baseUrl} |`)
  L.push(`| **Route** | \`${page.route}\` |`)
  L.push(`| **Text direction** | ${page.dir === 'rtl' ? 'RTL (Arabic default)' : page.dir} |`)
  L.push(`| **Priority** | ${meta?.priority || 'P3'} |`)
  L.push('')

  L.push('## Business Purpose', '', meta?.purpose || `Discovered page "${heading}". Purpose not yet documented with the product owner.`, '')

  L.push('## UI Elements', '', '| Element | Type | Detail |', '|---------|------|--------|')
  for (const h of page.headings.slice(0, 6)) L.push(`| ${h} | Heading | — |`)
  for (const t of (page.tabs || []).slice(0, 10)) L.push(`| ${t} | Tab | — |`)
  for (const b of (page.buttons || []).slice(0, 14)) L.push(`| ${b} | Button / action | — |`)
  for (const i of (page.inputs || []).slice(0, 14)) {
    const label = i.name || i.placeholder || i.label || '(unlabelled)'
    const detail = i.options?.length ? `options: ${i.options.slice(0, 8).join(', ')}` : (i.placeholder || '—')
    L.push(`| ${label} | ${i.tag}${i.type ? `[${i.type}]` : ''} | ${detail} |`)
  }
  for (const [n, t] of (page.tables || []).entries()) {
    L.push(`| Table ${n + 1} | Table | columns: ${(t.columns || []).join(', ') || 'unlabelled'} |`)
  }
  L.push('')

  if (page.kpis?.length) {
    L.push('## Displayed metrics', '')
    for (const k of page.kpis.slice(0, 10)) L.push(`- ${k}`)
    L.push('')
  }

  L.push('## Happy Path', '')
  L.push(`1. Connect the Citrix VPN and open ${portalOf(page).baseUrl}.`)
  L.push('2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).')
  if (page.portal === 'dashboard') {
    L.push(`3. Navigate to \`${page.route}\`.`)
  } else {
    L.push(`3. Click **${page.route}** in the portal navigation.`)
  }
  L.push(`4. The page loads with the heading "${heading}".`)
  if (page.tables?.length) L.push('5. The table populates with records (or shows an empty state).')
  L.push('')

  L.push('## Edge Cases & Validation Rules', '')
  L.push('- **Role isolation** — a role without access must be refused on direct URL entry, not merely have the menu entry hidden.')
  L.push('- **Session expiry** — an expired Keycloak session must redirect to login, never display stale data.')
  L.push('- **Backend failure** — a failing API call must surface an error state, not render empty data as a valid result.')
  if (page.tables?.length) L.push('- **Empty state** — filtering to zero results must clear previous rows and show an empty state.')
  if (page.tabs?.length > 1) L.push('- **Tab isolation** — switching tabs must not show the previous tab\'s data.')
  if (page.dir === 'rtl' || page.portal === 'dashboard') {
    L.push('- **Bilingual UI** — the dashboard defaults to Arabic (RTL) with an EN toggle; layout and data must be correct in both directions.')
  }
  L.push('')

  if (page.xhr?.length) {
    L.push('## API calls observed', '')
    L.push('Captured from the browser during discovery — these are the endpoints this page depends on:', '')
    L.push('```')
    for (const c of page.xhr.slice(0, 14)) L.push(c)
    L.push('```', '')
  }

  L.push('## Notes', '')
  L.push('- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.')
  L.push('- Test cases carry Status `Under Testing`; none has been executed yet.')
  if (page.portal === 'dashboard' && !page.reachable) {
    L.push('- **This route did not resolve during discovery** — it fell back to `/information-center`.')
  }
  if (page.portal === 'dashboard' && ['settings-admin', 'products', 'master-data'].includes(page.name)) {
    L.push('- **Reachability defect:** this page exists and works by direct URL but has no working navigation entry. See the filed bug.')
  }
  L.push('')
  return L.join('\n')
}

// ─── main ────────────────────────────────────────────────────────────────────

/**
 * Feature-ID prefix, keyed by PORTAL — not by module.
 *
 * All eleven dashboard modules share one `EPTTS_WEB_nn` sequence, because the Feature ID
 * identifies a feature within an app and every one of them is the same web dashboard. Keying
 * this by module instead produced `EPTTS_undefined_NaN` the moment the module tree grew past
 * platform/registry/billing — silently, since neither the object lookup nor the counter
 * throws on a missing key.
 */
const PREFIX = { dashboard: 'WEB', registry: 'REG', billing: 'BIL' }

function prefixFor(page) {
  const p = PREFIX[page.portal]
  if (!p) throw new Error(`no Feature ID prefix registered for portal "${page.portal}"`)
  return p
}

/**
 * Feature IDs already assigned on disk: slug -> id, plus the highest number per prefix.
 *
 * Both halves are needed for this generator to be IDEMPOTENT. A feature that already has an
 * ID keeps it; only genuinely new features take the next number. Seeding purely from
 * "highest on disk" is NOT idempotent when regenerating the same pages -- each run re-reads
 * the IDs it wrote last time and shifts everything up (31 -> 63 -> 95, observed).
 */
function readAssignedIds() {
  const bySlug = new Map()
  const highest = {}
  const featuresRoot = path.join(APP_DIR, 'features')
  if (!fs.existsSync(featuresRoot)) return { bySlug, highest }
  const re = /EPTTS_([A-Z]+)_(\d+)/g
  for (const dir of fs.readdirSync(featuresRoot)) {
    const f = path.join(featuresRoot, dir, `${dir}-testcases.md`)
    if (!fs.existsSync(f)) continue
    for (const m of fs.readFileSync(f, 'utf8').matchAll(re)) {
      if (!bySlug.has(dir)) bySlug.set(dir, m[0])
      highest[m[1]] = Math.max(highest[m[1]] ?? 0, Number(m[2]))
    }
  }
  return { bySlug, highest }
}

/** Registered test-case ID prefix per feature slug. Must match the rules doc. */
const CASE_PREFIX = {
  'web-shipping': 'WEB_SHP',
  'web-receiving': 'WEB_RCV',
  'web-dispensing': 'WEB_DSP',
  'web-return-shipping': 'WEB_RTS',
  'web-return-receiving': 'WEB_RTR',
  'web-cancel-transfer': 'WEB_CXL',
  'web-transfer-history': 'WEB_THS',
  'web-operations': 'WEB_OPS',
  'web-individual-packs': 'WEB_IPK',
  'web-aggregation': 'WEB_AGG',
  'web-repack': 'WEB_RPK',
  'web-scan-pack': 'WEB_SCN',
  'web-product-destruction': 'WEB_DST',
  'web-product-verification': 'WEB_VRF',
  'web-product-recall': 'WEB_RCL',
  'web-epcis-xml-upload': 'WEB_XML',
  'web-commissioning-packing-csv': 'WEB_CSV',
  'web-inventory': 'WEB_INV',
  'web-pharmacy-stock': 'WEB_PHS',
  'web-mdm-registry': 'WEB_MDM',
  'web-trace': 'WEB_TRC',
  'web-epcis-messages': 'WEB_EPC',
  'web-message-log': 'WEB_MSG',
  'web-webhook-history': 'WEB_WHK',
  'web-announcements': 'WEB_ANN',
  'web-mobile-versions': 'WEB_MOB',
  'web-integration-downloads': 'WEB_IDL',
  'web-pos-partners': 'WEB_POS',
  'web-agent-monitoring': 'WEB_AGM',
  'web-agent-devices': 'WEB_AGD',
  'web-activation-keys': 'WEB_AKY',
  'web-agent-updates': 'WEB_AGU',
  'web-information-center': 'WEB_INF',
  'web-command-center': 'WEB_CMD',
  'web-reporting': 'WEB_RPT',
  'web-analytics': 'WEB_ANL',
  'web-violations': 'WEB_VIO',
  'web-audit-console': 'WEB_AUD',
  'web-master-data': 'WEB_MDT',
  'web-settings-admin': 'WEB_SET',
  'web-products': 'WEB_PRD',
  'registry-dashboard': 'REG_DSH',
  'registry-parties': 'REG_PRT',
  'registry-prefixes': 'REG_PFX',
  'registry-products': 'REG_PRD',
  'registry-register-pharmacy': 'REG_RPH',
  'billing-dashboard': 'BIL_DSH',
  'billing-unbilled-operations': 'BIL_UNB',
  'billing-invoices': 'BIL_INV',
  'billing-reports': 'BIL_RPT',
  'billing-configuration': 'BIL_CFG',
}
// Seeded from disk so a partial run (e.g. only the newly discovered pages) continues the
// existing numbering rather than restarting at 01 and colliding.
const { bySlug: EXISTING_IDS, highest: HIGHEST } = readAssignedIds()
const featureN = {}
for (const prefix of new Set(Object.values(PREFIX))) featureN[prefix] = HIGHEST[prefix] ?? 0
const seeded = Object.entries(featureN).filter(([, n]) => n > 0)
if (seeded.length) {
  console.log(`existing Feature IDs kept; new ones continue from ${seeded.map(([p, n]) => `${p}_${n}`).join(', ')}`)
}

const summary = []

for (const page of manifest.pages) {
  const mod = moduleFor(page)
  const meta = metaFor(page)
  const slug = featureSlug(page)
  const prefix = prefixFor(page)
  // Reuse this feature's own ID when it already has one: the ID is quoted in every row of
  // its test-case table, so it has to be stable across regenerations.
  const featureId = EXISTING_IDS.get(slug)
    ?? `EPTTS_${prefix}_${String(++featureN[prefix]).padStart(2, '0')}`
  // Fixed, readable per-feature codes — see testcase-writing-rules.md's ID table.
  // Derived truncation (BIL_DASHBO, WEB_AUDITC) was unreadable and uneven.
  const casePrefix = CASE_PREFIX[slug]
  if (!casePrefix) throw new Error(`no registered ID prefix for feature "${slug}" — add one to CASE_PREFIX`)
  const cases = casesFor(page, featureId, casePrefix, portalOf(page).baseUrl)
  const title = meta?.feature || page.headings[0] || page.name
  const md = testcaseTable(title, featureId, cases)
  const wf = workflowFor(page, slug, featureId, mod, meta)

  if (WRITE) {
    const dir = path.join(APP_DIR, 'features', slug)
    fs.mkdirSync(path.join(dir, 'screenshots'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify({ module: mod }, null, 2) + '\n')
    fs.writeFileSync(path.join(dir, 'workflow.md'), wf)
    fs.writeFileSync(path.join(dir, `${slug}-testcases.md`), md)
    fs.writeFileSync(path.join(dir, `${slug}-testcases-v1.md`), md)
    const exec = {}
    for (const c of cases) exec[c.id] = 'new_added'
    fs.writeFileSync(path.join(dir, 'execution-status-v1.json'), JSON.stringify(exec, null, 2) + '\n')

    const src = path.join(shotsDir, page.screenshot)
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dir, 'screenshots', `${slug}.jpg`))
  }

  summary.push({ slug, module: mod, featureId, cases: cases.length, shot: page.screenshot })
}

if (WRITE) {
  for (const [slug, m] of Object.entries(MODULES)) {
    // `platform` is a LABEL for the dashboard portal, not a module any more. The dashboard's
    // 11 real modules are owned by scripts/eptts-web-module-tree.js; recreating `platform`
    // here would resurrect the catch-all module that restructure deleted, and features
    // pointing at it would appear nowhere.
    if (slug === 'platform') continue
    const dir = path.join(APP_DIR, 'modules', slug)
    fs.mkdirSync(path.join(dir, 'knowledge'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'module.json'), JSON.stringify({
      slug, name: m.name, icon: m.icon, order: m.order, pathPrefix: slug, description: m.description,
    }, null, 2) + '\n')
    const feats = summary.filter((s) => s.module === slug)
    fs.writeFileSync(path.join(dir, 'knowledge', 'module-overview.md'), [
      `# ${m.name} — Module Overview`, '',
      m.description, '',
      `**Base URL:** ${m.baseUrl}`, '',
      'Requires the Citrix VPN. TLS uses a self-signed certificate, so every client must ignore',
      'certificate errors. Authentication is **Keycloak OIDC** (realm `masar`, client',
      '`masar-dashboard`, Authorization Code + PKCE) — the direct password grant is disabled, so',
      'automation must drive the real browser login.', '',
      '## Features', '',
      '| Feature ID | Slug | Test cases |', '|---|---|---|',
      ...feats.map((f) => `| \`${f.featureId}\` | \`${f.slug}\` | ${f.cases} |`),
      '',
      '## Notes', '',
      '- Discovered live against production on 2026-08-31.',
      '- All test cases are `new_added`; none has been executed.',
      '',
    ].join('\n'))
  }
}

console.log(WRITE ? '=== WROTE ===' : '=== DRY RUN (pass --write) ===')
for (const mod of [...new Set(summary.map((s) => s.module))].sort()) {
  const feats = summary.filter((s) => s.module === mod)
  if (!feats.length) continue
  console.log(`\n[${mod}]`)
  for (const f of feats) console.log(`  ${f.featureId}  ${f.slug.padEnd(30)} ${String(f.cases).padStart(2)} cases  shot=${f.shot ? 'yes' : 'NO'}`)
}
console.log(`\nmodules touched: ${new Set(summary.map((s) => s.module)).size}  features: ${summary.length}  test cases: ${summary.reduce((a, s) => a + s.cases, 0)}`)
