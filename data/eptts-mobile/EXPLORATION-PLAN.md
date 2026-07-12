# EPTTS Mobile — Full Exploration Plan (Appium MCP)

> **Goal:** Systematically explore every screen of the EPTTS Mobile app, capturing domain knowledge,
> feature workflows, locators, and automated code (POM + Fluent Tests).
>
> **Checkpoint System:** Each step is independent. Mark ✅ when complete. Resume from any unchecked step.

---

## Prerequisites Checklist

- [ ] Device connected: `adb devices` → `RF8MC0D6CVA`
- [ ] Appium server running: `npx appium` (port 4723)
- [ ] App installed: `com.daf.eda.eptts`
- [ ] Node.js 18+, npm available
- [ ] `scripts/appium-ts/` initialized: `cd scripts/appium-ts && npm install`
- [ ] TypeScript compiles: `npm run build`

---

## Output Structure

```
scripts/appium-ts/
├── package.json                       ← Dependencies (webdriverio, appium, jest/vitest)
├── tsconfig.json                      ← TypeScript config (strict, paths)
├── jest.config.ts                     ← Test runner config
├── src/
│   ├── core/                          ← Framework foundation
│   │   ├── BasePage.ts                ← Base POM class (driver, waits, common actions)
│   │   ├── DriverFactory.ts           ← Session management (WebDriverIO remote)
│   │   └── AppConfig.ts              ← Constants (credentials, timeouts, device)
│   ├── pages/                         ← Page Object Model classes
│   │   ├── LandingPage.ts
│   │   ├── LoginPage.ts
│   │   ├── pharmacy/
│   │   │   ├── PharmacyHomePage.ts
│   │   │   ├── ReceiveInvoicePage.ts
│   │   │   ├── DispensePage.ts
│   │   │   ├── ReturnPackPage.ts
│   │   │   ├── BranchReturnPage.ts
│   │   │   ├── MyReturnsPage.ts
│   │   │   └── PharmacyEpcisHistoryPage.ts
│   │   ├── distributor/
│   │   │   ├── DistributorHomePage.ts
│   │   │   ├── CreateShipmentPage.ts
│   │   │   ├── MyShipmentsPage.ts
│   │   │   ├── ReceiveShipmentPage.ts
│   │   │   ├── DistributorReturnsPage.ts
│   │   │   └── DistributorEpcisHistoryPage.ts
│   │   ├── branch/
│   │   │   ├── BranchHomePage.ts
│   │   │   ├── BranchCreateShipmentPage.ts
│   │   │   ├── BranchMyShipmentsPage.ts
│   │   │   ├── BranchReceiveShipmentPage.ts
│   │   │   ├── BranchReturnsPage.ts
│   │   │   └── BranchEpcisHistoryPage.ts
│   │   ├── inspector/
│   │   │   ├── InspectorHomePage.ts
│   │   │   ├── ViewShipmentsPage.ts
│   │   │   └── TracePage.ts
│   │   └── patient/
│   │       └── PatientHomePage.ts
│   └── tests/                         ← Fluent-style test classes
│       ├── BaseTest.ts                ← Setup/teardown, role login helpers
│       ├── landing.test.ts
│       ├── login.test.ts
│       ├── pharmacy/
│       │   ├── pharmacy-home.test.ts
│       │   ├── receive-invoice.test.ts
│       │   ├── dispense.test.ts
│       │   ├── return-pack.test.ts
│       │   ├── branch-return.test.ts
│       │   ├── my-returns.test.ts
│       │   └── pharmacy-epcis-history.test.ts
│       ├── distributor/
│       │   └── ... (mirrors pages/)
│       ├── branch/
│       │   └── ... (mirrors pages/)
│       ├── inspector/
│       │   └── ... (mirrors pages/)
│       └── patient/
│           └── patient.test.ts
```

```
data/eptts-mobile/
├── knowledge/
│   └── eptts-mobile-domain-knowledge.md   ← Updated with full app knowledge
├── modules/
│   ├── pharmacy/knowledge/pharmacy-knowledge.md    ← Module-specific knowledge
│   ├── distributor/knowledge/distributor-knowledge.md
│   ├── branch/knowledge/branch-knowledge.md
│   ├── inspector/knowledge/inspector-knowledge.md
│   └── patient/knowledge/patient-knowledge.md
└── features/
    └── <feature-name>/
        ├── workflow.md                   ← Feature workflow (from exploration)
        ├── metadata.json                 ← Feature metadata
        └── screenshots/                  ← App screenshots
```

---

## Phase 0 — Framework Setup

### Step 0.1 — Initialize TypeScript Project
- [ ] Create `scripts/appium-ts/package.json` with dependencies:
  - `webdriverio` (Appium client)
  - `@wdio/appium-service` (optional, for managed Appium)
  - `typescript`, `ts-node`, `@types/node`
  - `jest` + `ts-jest` (test runner)
  - `@types/jest`
- [ ] Create `scripts/appium-ts/tsconfig.json` (strict, ESNext, paths aliases)
- [ ] Create `scripts/appium-ts/jest.config.ts`
- [ ] Run `npm install` — verify clean install

### Step 0.2 — Create Core Framework Classes
- [ ] Create `src/core/AppConfig.ts` — credentials, device config, timeouts (typed constants)
- [ ] Create `src/core/DriverFactory.ts` — WebDriverIO `remote()` session create/destroy
- [ ] Create `src/core/BasePage.ts` — shared POM base (fluent return types, wait helpers, scroll, tap, getText, isDisplayed)
- [ ] Create `src/tests/BaseTest.ts` — Jest beforeAll/afterAll, role login helpers

### Step 0.3 — Create Landing & Login Pages (migrate from EpttsLogin.java)
- [ ] Create `src/pages/LandingPage.ts` — locators + actions for landing screen
- [ ] Create `src/pages/LoginPage.ts` — Keycloak WebView login (handles Chrome dialog)
- [ ] Create `src/tests/landing.test.ts` — verify landing elements visible
- [ ] Create `src/tests/login.test.ts` — test each role can log in

### Step 0.4 — Validate Build
- [ ] Run `npm run build` — all files compile (tsc --noEmit)
- [ ] Run `npm test -- landing.test.ts` against live device

---

## Phase 1 — Patient Module (Simplest, 1 Screen)

### Step 1.1 — Explore Patient Screen
- [ ] Start Appium session (MCP: `select_device` → `appium_session_management` create)
- [ ] Navigate: Landing → tap "Patient"
- [ ] Screenshot every state → `data/eptts-mobile/features/patient/screenshots/`
- [ ] Record all UI elements, content-descs, resource-ids
- [ ] Document behavior: what happens on scan, error states, back navigation

### Step 1.2 — Document Patient Knowledge
- [ ] Write `data/eptts-mobile/features/patient/workflow.md`
- [ ] Update `data/eptts-mobile/modules/patient/knowledge/patient-knowledge.md`

### Step 1.3 — Code Patient Module
- [ ] Create `src/pages/patient/PatientHomePage.ts` (locators + actions)
- [ ] Create `src/tests/patient/patient.test.ts` (fluent tests)

---

## Phase 2 — Inspector Module (3 Features, Read-Only)

### Step 2.1 — Explore Inspector Home
- [ ] Login as `testinspector@eptts.com`
- [ ] Screenshot home → `data/eptts-mobile/features/inspector-home/screenshots/`
- [ ] Record all tiles, their content-desc values, navigation targets

### Step 2.2 — Explore View Shipments
- [ ] Tap "View Shipments" tile
- [ ] Screenshot: list view, empty state, detail view, invoice detail
- [ ] Record all elements, search/filter functionality, pagination
- [ ] Document data fields shown per shipment

### Step 2.3 — Explore Trace
- [ ] Navigate to Trace screen
- [ ] Screenshot: Pack tab, Container tab, scan behavior, results
- [ ] Record: input methods (manual entry vs scan), result display format

### Step 2.4 — Document Inspector Knowledge
- [ ] Write `data/eptts-mobile/features/inspector-home/workflow.md`
- [ ] Write `data/eptts-mobile/features/inspector-view-shipments/workflow.md`
- [ ] Write `data/eptts-mobile/features/inspector-trace/workflow.md`
- [ ] Update `data/eptts-mobile/modules/inspector/knowledge/inspector-knowledge.md`

### Step 2.5 — Code Inspector Module
- [ ] Create `src/pages/inspector/InspectorHomePage.ts`
- [ ] Create `src/pages/inspector/ViewShipmentsPage.ts`
- [ ] Create `src/pages/inspector/TracePage.ts`
- [ ] Create `src/tests/inspector/inspector-home.test.ts`
- [ ] Create `src/tests/inspector/view-shipments.test.ts`
- [ ] Create `src/tests/inspector/trace.test.ts`

---

## Phase 3 — Pharmacy Module (7 Features, Most Complex)

### Step 3.1 — Explore Pharmacy Home
- [ ] Login as `sydybishresaaf@eptts.com`
- [ ] Screenshot home → record all tiles + content-desc
- [ ] Note: pharmacy name displayed, tile count, navigation structure

### Step 3.2 — Explore Receive Invoice
- [ ] Tap "Receive Invoice"
- [ ] Screenshot: invoice list, empty state, invoice detail, scan screen
- [ ] Record: fields (invoice #, date, distributor, items), scan progress bar
- [ ] Document: receive flow (select → scan → confirm), error states

### Step 3.3 — Explore Dispense
- [ ] Tap "Dispense"
- [ ] Screenshot: dispense entry form, scanner, confirmation
- [ ] Record: input fields (patient info?, prescription?), scan behavior
- [ ] Document: dispense flow (scan → assign patient? → confirm)

### Step 3.4 — Explore Return Pack
- [ ] Tap "Return Pack"
- [ ] Screenshot: return selection, scan screen, confirmation
- [ ] Record: return reasons, required fields, flow

### Step 3.5 — Explore Branch Return
- [ ] Tap "Branch Return"
- [ ] Screenshot: all states
- [ ] Record: difference from Return Pack (returns to branch vs distributor)

### Step 3.6 — Explore My Returns
- [ ] Tap "My Returns"
- [ ] Screenshot: returns list, detail, statuses
- [ ] Record: return statuses, actions available per status

### Step 3.7 — Explore EPCIS History (Pharmacy)
- [ ] Tap "EPCIS History"
- [ ] Screenshot: history list, scan/search, timeline detail
- [ ] Record: event types shown, data fields, filtering

### Step 3.8 — Document Pharmacy Knowledge
- [ ] Write workflow.md for each feature (6 files)
- [ ] Update `data/eptts-mobile/modules/pharmacy/knowledge/pharmacy-knowledge.md`

### Step 3.9 — Code Pharmacy Module
- [ ] Create all 7 page objects (see Output Structure above)
- [ ] Create all 7 test classes (fluent pattern)

---

## Phase 4 — Distributor Module (6 Features)

### Step 4.1 — Explore Distributor Home
- [ ] Login as `testdistributor2@eptts.com`
- [ ] Screenshot home → record all tiles + content-desc

### Step 4.2 — Explore Create Shipment
- [ ] Tap "Create Shipment"
- [ ] Screenshot: form (Destination GLN, ERP Invoice), draft creation, scan screen
- [ ] Record: fields, validation rules, flow (create draft → scan → submit)

### Step 4.3 — Explore My Shipments
- [ ] Tap "My Shipments"
- [ ] Screenshot: shipments list, detail view, statuses
- [ ] Record: shipment statuses, actions per status

### Step 4.4 — Explore Receive Shipment
- [ ] Tap "Receive Shipment"
- [ ] Screenshot: incoming invoices list, scan screen with progress bar
- [ ] Record: receive flow, mismatch handling, confirmation

### Step 4.5 — Explore Returns (Distributor)
- [ ] Tap "Returns"
- [ ] Screenshot: sub-menu (Manufacturer Return, My Returns, Incoming Returns)
- [ ] Explore each sub-flow, screenshot all states
- [ ] Record: return types, flows, required fields

### Step 4.6 — Explore EPCIS History (Distributor)
- [ ] Tap "EPCIS History"
- [ ] Screenshot: all states

### Step 4.7 — Document Distributor Knowledge
- [ ] Write workflow.md for each feature (5+ files)
- [ ] Update `data/eptts-mobile/modules/distributor/knowledge/distributor-knowledge.md`

### Step 4.8 — Code Distributor Module
- [ ] Create all 6 page objects
- [ ] Create all 6 test classes (fluent pattern)

---

## Phase 5 — Branch Module (6 Features)

### Step 5.1 — Explore Branch Home
- [ ] Login as `testbranch@eptts.com`
- [ ] Screenshot home → record all tiles + content-desc

### Step 5.2 — Explore Create Shipment (Branch)
- [ ] Same pattern as Distributor Create Shipment
- [ ] Note differences (destination types, fields)

### Step 5.3 — Explore My Shipments (Branch)
- [ ] Screenshot: list, detail, statuses

### Step 5.4 — Explore Receive Shipment (Branch)
- [ ] Screenshot: incoming list, scan, progress

### Step 5.5 — Explore Returns (Branch)
- [ ] Screenshot: sub-menu and all sub-flows

### Step 5.6 — Explore EPCIS History (Branch)
- [ ] Screenshot: all states

### Step 5.7 — Document Branch Knowledge
- [ ] Write workflow.md for each feature (5+ files)
- [ ] Update `data/eptts-mobile/modules/branch/knowledge/branch-knowledge.md`

### Step 5.8 — Code Branch Module
- [ ] Create all 6 page objects
- [ ] Create all 6 test classes (fluent pattern)

---

## Phase 6 — Cross-Cutting Concerns & Domain Knowledge Synthesis

### Step 6.1 — Update Global Domain Knowledge
- [ ] Consolidate findings into `data/eptts-mobile/knowledge/eptts-mobile-domain-knowledge.md`
- [ ] Add sections: full role matrix, shared UI patterns, GS1 scanning behavior
- [ ] Document common components (scanner, progress bar, confirmation dialogs)

### Step 6.2 — Document Shared Patterns
- [ ] Logout flow (common to all roles)
- [ ] Delete Account flow (common to all roles)
- [ ] Scanner component behavior (shared across features)
- [ ] Error handling patterns (network errors, invalid scans)
- [ ] Empty state patterns

### Step 6.3 — Write Functional Requirements
- [ ] Update `data/eptts-mobile/requirements/FRs.md` with discovered requirements

---

## Phase 7 — Final Validation & Test Suite

### Step 7.1 — Full Compile & Smoke Run
- [ ] `npm run build` — all page objects + tests compile
- [ ] Run smoke test per role (login → verify home → logout)

### Step 7.2 — Jest Suite Configuration
- [ ] Configure Jest projects/groups: smoke, patient, inspector, pharmacy, distributor, branch
- [ ] Add npm scripts: `npm test`, `npm run test:smoke`, `npm run test:pharmacy`, etc.
- [ ] Verify sequential execution config (Appium single-device constraint)

---

## Design Patterns Reference

### Page Object Model (POM)

Each page class encapsulates:
1. **Locators** — string selectors as `readonly` constants at the top (named clearly)
2. **Actions** — `async` methods that interact with elements (return `this` for fluent chaining OR return the next page)
3. **Validations** — `isDisplayed()`, `getTitle()`, `getElementText()` assertion helpers

```typescript
// src/pages/pharmacy/PharmacyHomePage.ts
import { BasePage } from '../core/BasePage';
import { ReceiveInvoicePage } from './ReceiveInvoicePage';
import { DispensePage } from './DispensePage';

export class PharmacyHomePage extends BasePage {
  // ── Locators ─────────────────────────────────────────────────────
  private readonly RECEIVE_INVOICE_TILE = '~Receive Invoice';
  private readonly DISPENSE_TILE        = '~Dispense';
  private readonly RETURN_PACK_TILE     = '~Return Pack';
  private readonly BRANCH_RETURN_TILE   = '~Branch Return';
  private readonly MY_RETURNS_TILE      = '~My Returns';
  private readonly EPCIS_HISTORY_TILE   = '~EPCIS History';
  private readonly PHARMACY_NAME        = '~PH Sydy Bishr esaaf 24';

  // ── Page Load Anchor ───────────────────────────────────────────────
  async waitForLoaded(): Promise<this> {
    await this.waitForElement(this.RECEIVE_INVOICE_TILE);
    return this;
  }

  // ── Actions (fluent — return next page) ────────────────────────────
  async tapReceiveInvoice(): Promise<ReceiveInvoicePage> {
    await this.tap(this.RECEIVE_INVOICE_TILE);
    return new ReceiveInvoicePage(this.driver).waitForLoaded();
  }

  async tapDispense(): Promise<DispensePage> {
    await this.tap(this.DISPENSE_TILE);
    return new DispensePage(this.driver).waitForLoaded();
  }

  // ── Validations ────────────────────────────────────────────────────
  async isPharmacyNameDisplayed(): Promise<boolean> {
    return this.isDisplayed(this.PHARMACY_NAME);
  }

  async verifyTileVisible(tileName: string): Promise<this> {
    const el = await this.driver.$(`~${tileName}`);
    await expect(el).toBeDisplayed();
    return this;
  }
}
```

### Fluent Test Pattern

Tests read like natural language using async/await chaining:

```typescript
// src/tests/pharmacy/pharmacy-home.test.ts
import { BaseTest } from '../BaseTest';
import { Role } from '../../core/AppConfig';

const test = new BaseTest();

beforeAll(async () => await test.setup());
afterAll(async () => await test.teardown());

describe('Pharmacy Home', () => {

  it('should display all 6 pharmacy tiles', async () => {
    const home = await test.loginAs(Role.PHARMACY);

    await home
      .verifyTileVisible('Receive Invoice')
      .then(p => p.verifyTileVisible('Dispense'))
      .then(p => p.verifyTileVisible('Return Pack'))
      .then(p => p.verifyTileVisible('Branch Return'))
      .then(p => p.verifyTileVisible('My Returns'))
      .then(p => p.verifyTileVisible('EPCIS History'));

    expect(await home.isPharmacyNameDisplayed()).toBe(true);
  });

  it('should navigate to Receive Invoice and back', async () => {
    const home = await test.loginAs(Role.PHARMACY);

    const receivePage = await home.tapReceiveInvoice();
    expect(await receivePage.isLoaded()).toBe(true);

    const backHome = await receivePage.navigateBack<PharmacyHomePage>();
    expect(await backHome.isPharmacyNameDisplayed()).toBe(true);
  });
});
```

### BasePage Pattern

```typescript
// src/core/BasePage.ts
import { Browser, Element } from 'webdriverio';

export abstract class BasePage {
  constructor(protected driver: Browser) {}

  abstract waitForLoaded(): Promise<this>;

  protected async tap(selector: string): Promise<void> {
    const el = await this.driver.$(selector);
    await el.waitForDisplayed({ timeout: 10000 });
    await el.click();
  }

  protected async setText(selector: string, value: string): Promise<void> {
    const el = await this.driver.$(selector);
    await el.waitForDisplayed({ timeout: 10000 });
    await el.clearValue();
    await el.setValue(value);
  }

  protected async getText(selector: string): Promise<string> {
    const el = await this.driver.$(selector);
    await el.waitForDisplayed({ timeout: 10000 });
    return el.getText();
  }

  protected async isDisplayed(selector: string): Promise<boolean> {
    try {
      const el = await this.driver.$(selector);
      return await el.isDisplayed();
    } catch {
      return false;
    }
  }

  protected async waitForElement(selector: string, timeout = 15000): Promise<Element> {
    const el = await this.driver.$(selector);
    await el.waitForExist({ timeout });
    return el;
  }

  async navigateBack<T extends BasePage>(): Promise<T> {
    await this.driver.back();
    return this as unknown as T;
  }

  async screenshot(name: string): Promise<string> {
    return this.driver.saveScreenshot(`./screenshots/${name}.png`);
  }
}
```

### DriverFactory Pattern

```typescript
// src/core/DriverFactory.ts
import { remote, Browser } from 'webdriverio';
import { DEVICE_CONFIG } from './AppConfig';

export class DriverFactory {
  private static instance: Browser | null = null;

  static async create(): Promise<Browser> {
    if (this.instance) return this.instance;

    this.instance = await remote({
      hostname: '127.0.0.1',
      port: 4723,
      path: '/',
      capabilities: {
        platformName: 'Android',
        'appium:deviceName': DEVICE_CONFIG.deviceName,
        'appium:udid': DEVICE_CONFIG.udid,
        'appium:platformVersion': DEVICE_CONFIG.platformVersion,
        'appium:automationName': 'UiAutomator2',
        'appium:appPackage': DEVICE_CONFIG.appPackage,
        'appium:appActivity': DEVICE_CONFIG.appActivity,
        'appium:noReset': true,
      },
    });

    return this.instance;
  }

  static async destroy(): Promise<void> {
    if (this.instance) {
      await this.instance.deleteSession();
      this.instance = null;
    }
  }
}
```

---

## Exploration Protocol (Per Feature)

When exploring each feature with Appium MCP, follow this protocol:

1. **Screenshot the initial state** → save to `features/<name>/screenshots/<name>-01.png`
2. **Get page source** → `appium_get_page_source` — extract ALL content-desc and resource-id values
3. **Record locators** → note the best strategy (accessibility id > id > xpath)
4. **Interact with each element** → tap buttons, fill forms, trigger states
5. **Screenshot each state** → `<name>-02-<state>.png`, `<name>-03-<state>.png`
6. **Test error states** → empty inputs, invalid data, back navigation
7. **Document the flow** → write workflow.md immediately after exploration
8. **Write the Page Object** → transfer locators into TypeScript POM class

---

## Appium MCP Commands Quick Reference

| Action | MCP Tool | Key Params |
|--------|----------|------------|
| Start session | `select_device` → `appium_session_management` | action=create, platform=android |
| Screenshot | `appium_screenshot` | (save to features/screenshots/) |
| Find element | `appium_find_element` | strategy=accessibility id/id/xpath, selector=... |
| Tap | `appium_gesture` | action=tap, elementUUID=... |
| Type | `appium_set_value` | elementUUID=..., value=... |
| Get text | `appium_get_text` | elementUUID=... |
| Page source | `appium_get_page_source` | — |
| Scroll | `appium_gesture` | action=scroll_to_element, selector=... |
| Back | `appium_gesture` | action=back |
| Kill session | `appium_session_management` | action=delete |

---

## Checkpoint Tracking

| Phase | Module | Steps | Status |
|-------|--------|-------|--------|
| 0 | Framework Setup | 0.1–0.4 | ✅ Complete |
| 1 | Patient | 1.1–1.3 | ✅ Explore ✅ · workflow.md ✅ · locators verified ✅ · POM fixed ✅ |
| 2 | Inspector | 2.1–2.5 | ✅ Explore ✅ · workflow.md ✅ · locators verified ✅ · POM fixed ✅ |
| 3 | Pharmacy | 3.1–3.9 | ✅ Explore ✅ · workflow.md ✅ · locators verified ✅ · POM fixed ✅ |
| 4 | Distributor | 4.1–4.8 | ✅ Explore ✅ · workflow.md ✅ · locators verified ✅ · POM fixed ✅ |
| 5 | Branch | 5.1–5.8 | ✅ Explore ✅ · workflow.md ✅ · locators verified ✅ · POM fixed ✅ |
| 6 | Cross-Cutting | 6.1–6.3 | ⬜ Not Started |
| 7 | Final Validation | 7.1–7.2 | ⬜ Not Started |

---

## How to Resume

1. Open this file
2. Find the first unchecked `[ ]` item
3. Tell Copilot: _"Continue EPTTS Mobile exploration from Step X.Y"_
4. Copilot will:
   - Start/reuse Appium session
   - Execute the exploration protocol
   - Save screenshots + write workflow.md + create/update Page Object + write test
   - Mark the step ✅ in this plan
