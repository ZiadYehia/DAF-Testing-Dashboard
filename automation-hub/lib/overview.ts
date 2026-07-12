/**
 * Automation Hub — Asset Detail Overview tab helpers (GRC app).
 *
 * The Overview tab renders every label/value pair (Asset Metadata, Type-Specific
 * Details, and the right-rail linked-count tiles) as a fixed DOM shape:
 *   <div><h5>Label</h5><p-or-generic>Value</p-or-generic></div>
 * Values carry no accessible name of their own, so the only reliable way to read
 * one is "the element immediately after the h5 with this exact text" — hence the
 * xpath sibling walk below (an intentional exception to the hub's usual
 * getByRole-first rule, confirmed against the live DOM via MCP browser inspection
 * on 2026-07-10).
 */
import type { Page, Locator } from '@playwright/test'

/** Value locator for an Overview-tab label/value pair (Asset Metadata or a right-rail
 *  linked-count tile) identified by its exact label text. Do NOT use this for a label
 *  that can also appear inside Type-Specific Details (e.g. "Owner") — use
 *  typeSpecificField() for those, since some type-specific fields share a label with
 *  a base Asset Metadata field and both would match, breaking Playwright's strict mode. */
export function overviewField(page: Page, label: string): Locator {
  return page.getByRole('heading', { name: label, exact: true }).locator('xpath=following-sibling::*[1]')
}

/** Value locator for a field inside the "Type-Specific Details" section specifically —
 *  scoped so labels shared with base Asset Metadata fields (e.g. "Owner") resolve to
 *  the type-specific one, not the base one. */
export function typeSpecificField(page: Page, label: string): Locator {
  const section = page.getByRole('heading', { name: 'Type-Specific Details', exact: true }).locator('xpath=following-sibling::*[1]')
  return section.getByRole('heading', { name: label, exact: true }).locator('xpath=following-sibling::*[1]')
}

/**
 * A header pill (Classification or Criticality — Status is a combobox, not a pill).
 * The pill row is the sibling immediately before the row holding Edit/Archive, so we
 * walk from the Edit button: parent (button row) -> preceding sibling (pill row) ->
 * exact-text match. Confirmed against the live DOM via MCP on 2026-07-10.
 */
export function headerPill(page: Page, text: string): Locator {
  return page
    .getByRole('button', { name: 'Edit' })
    .locator('xpath=../preceding-sibling::*[1]')
    .getByText(text, { exact: true })
}
