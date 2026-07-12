/**
 * LOCKED framework file — not editable from the dashboard UI/API.
 *
 * Generic, app-agnostic action helpers used INSIDE page objects' `step()` bodies
 * (see fluent-page.ts). Plain exported functions, not a class — page methods call
 * these directly rather than re-deriving the underlying Playwright calls.
 *
 * Every helper here encodes a portal quirk mined and live-verified across a
 * large body of generated specs, ported from the framework's original Python
 * reference page objects (see that
 * file's module docstring + `_click_wizard` / `_resolve_textbox` /
 * `_wait_for_fresh_listbox` / `pick_date` / `select_dropdown`). Keep this file's
 * behavior in sync with that reference if a portal quirk is ever re-verified —
 * do not "simplify" these recipes away.
 */
import type { Locator, Page } from '@playwright/test'

/** Role name accepted by Page.getByRole — derived so we never hand-maintain the ARIA role union. */
type Role = Parameters<Page['getByRole']>[0]

/**
 * Click via `dispatchEvent('click')` instead of a normal `.click()`.
 *
 * The floating chat FAB (fixed bottom-right) overlaps wizard nav buttons and
 * steals pointer events — even Playwright's force-click still lands on the FAB.
 * Dispatching a synthetic click event bypasses hit-testing entirely. Use this
 * for wizard/dialog buttons (Next / Back / Create / Cancel and similar); plain
 * `.click()` is still correct for ordinary in-page controls (dropdown triggers,
 * options, switches, …).
 */
export async function clickSafe(locator: Locator): Promise<void> {
  await locator.dispatchEvent('click')
}

/**
 * `page.getByRole(role, { name, exact: true })`.
 *
 * `getByRole(..., { name })` is a case-insensitive SUBSTRING match unless
 * `exact: true` is passed — e.g. a bare 'Next' would also match the datepicker's
 * 'Next Month' button, and 'Name *' would match 'Item Name *'. Prefer this over
 * calling `getByRole` directly whenever the name must match exactly one control.
 */
export function roleExact(page: Page, role: Role, name: string | RegExp): Locator {
  return page.getByRole(role, { name, exact: true })
}

/** Wait for `locator` to reach the `visible` state (default Playwright timeout when omitted). */
export async function waitVisible(locator: Locator, timeout?: number): Promise<void> {
  await locator.waitFor({ state: 'visible', timeout })
}

/**
 * Resolve a textbox by its visible label, handling the required/optional dual
 * accessible-name form used throughout the portal's forms.
 *
 * Required fields carry a trailing ' *' in their accessible name. `required:
 * true` targets only the '{label} *' form, `required: false` targets only the
 * bare label, and omitting `required` (default) tries the '{label} *' form
 * first with a short timeout — to absorb type-specific fields that render
 * ASYNCHRONOUSLY after a preceding dropdown selection — then falls back to the
 * bare label. This lets one call site work for both required and optional
 * fields without the caller knowing which form applies.
 */
export async function resolveTextbox(page: Page, label: string, required?: boolean): Promise<Locator> {
  const requiredLocator = roleExact(page, 'textbox', `${label} *`)
  const plainLocator = roleExact(page, 'textbox', label)

  if (required === true) {
    await waitVisible(requiredLocator)
    return requiredLocator
  }
  if (required === false) {
    await waitVisible(plainLocator)
    return plainLocator
  }

  try {
    await waitVisible(requiredLocator, 3000)
    return requiredLocator
  } catch {
    await waitVisible(plainLocator)
    return plainLocator
  }
}

/**
 * Fill a textbox by its visible label (see `resolveTextbox` for the required/
 * optional/async-field lookup this wraps). Pass `required: false` for optional
 * fields with no asterisk (e.g. 'Description', 'Notes'); leave `required`
 * unset to auto-detect either form.
 */
export async function fillField(page: Page, label: string, value: string, required?: boolean): Promise<void> {
  const locator = await resolveTextbox(page, label, required)
  await locator.fill(value)
}

/**
 * Wait for a freshly opened PrimeVue option panel.
 *
 * PrimeVue leaves earlier selects' listboxes mounted (hidden) in the DOM, so
 * once more than one select has been used on the page, `getByRole('listbox')`
 * resolves to multiple elements — the most-recently-opened one is always the
 * LAST in DOM order. Best-effort: some panels never render a `listbox` role,
 * so a timeout here is swallowed rather than propagated.
 */
export async function waitForFreshListbox(page: Page): Promise<void> {
  try {
    const listboxes = page.getByRole('listbox')
    await listboxes.last().waitFor({ state: 'visible', timeout: 3000 })
  } catch {
    // no listbox-role panel rendered — caller's subsequent option click still applies
  }
}

/**
 * Select `option` from a PrimeVue dropdown labelled 'Select {label}' (e.g.
 * `selectDropdown(page, 'Environment', 'Production')` targets the
 * 'Select Environment' combobox). Falls back to the bare `label` as the
 * accessible name when the prefixed form isn't found — some dropdowns
 * (verified live) expose their bare label instead once rendered. Uses the
 * fresh-listbox wait (see `waitForFreshListbox`) between opening the trigger
 * and clicking the option, and an exact-match option name.
 */
export async function selectDropdown(page: Page, label: string, option: string): Promise<void> {
  const prefixed = page.getByRole('combobox', { name: `Select ${label}` })
  let trigger: Locator
  try {
    await waitVisible(prefixed, 3000)
    trigger = prefixed
  } catch {
    trigger = page.getByRole('combobox', { name: label })
    await waitVisible(trigger)
  }

  await trigger.click()
  await waitForFreshListbox(page)
  await roleExact(page, 'option', option).click()
}

/**
 * Commit a date via the PrimeVue calendar panel for the combobox whose
 * accessible name CONTAINS `label` (e.g. "Purchase Date", "Review Date",
 * "Expiry Date", "Retention"). Typed text is silently DROPPED by the widget —
 * clicking through the calendar panel is the only way to set a date.
 *
 * Advances `monthsAhead` months via the 'Next Month' button before clicking
 * the `day` gridcell. When a second date panel is already open in the DOM
 * (e.g. picking Expiry Date right after Review Date), both the 'Next Month'
 * button and the day gridcells are duplicated — the LAST match is used in
 * that case, matching the mined/verified Python recipe.
 */
export async function pickDate(page: Page, label: string, day: string, monthsAhead = 0): Promise<void> {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const trigger = page.getByRole('combobox', { name: new RegExp(escaped) })
  await trigger.click()

  for (let i = 0; i < monthsAhead; i++) {
    const nextMonthAll = page.getByRole('button', { name: 'Next Month' })
    const nextMonth = (await nextMonthAll.count()) > 1 ? nextMonthAll.last() : nextMonthAll
    await nextMonth.click()
  }

  const dayCellAll = page.getByRole('gridcell', { name: day, exact: true })
  const dayCell = (await dayCellAll.count()) > 1 ? dayCellAll.last() : dayCellAll.first()
  await dayCell.click()
}
