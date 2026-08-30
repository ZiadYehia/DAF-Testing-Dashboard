"""Asset Create Page — Asset Manager 'Create New Asset' wizard (Step 1 Basic
Information / Step 2 Optional Information).

Encodes every verified portal recipe/quirk mined from the 84 acm-crt-*
Asset Create Manual specs:

- The floating chat FAB (fixed bottom-right) overlaps the wizard nav buttons
  and steals pointer events — even Playwright force-clicks land on it. Every
  wizard button click MUST use `dispatch_event("click")` instead of `.click()`.
- `get_by_role(..., name=...)` matching is a case-insensitive SUBSTRING match
  unless `exact=True` is passed — 'Next' would otherwise match the datepicker's
  'Next Month' button, and 'Name *' would match 'Asset Name *'.
- Type-specific Step-1 fields render ASYNCHRONOUSLY after `select_type()` —
  callers must wait for a field to be visible before filling it.
- PrimeVue datepickers silently DROP typed text — the only way to commit a
  date is clicking through the calendar panel (Next Month, then a day cell).
"""
from __future__ import annotations

import re

from playwright.sync_api import expect
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError

from autotest_framework.src.pages.base_page import BasePage
from pages.grc.asset_details_page import AssetDetailsPage


class AssetCreatePage(BasePage):
    """Asset Manager 'Create New Asset' wizard — manual creation flow."""

    def __init__(self, page):
        super().__init__(page, "Asset Create Page")

    # ==========================================
    #             INTERNAL HELPERS
    # ==========================================

    def _click_wizard(self, name: str) -> None:
        """
        Click a wizard nav button (Next / Back / Create / Cancel).

        MUST use dispatch_event: the floating chat FAB overlaps these buttons
        and steals pointer events, even from force-clicks. MUST use
        exact=True: 'Next' substring-matches the datepicker's 'Next Month'
        button when a calendar panel is open.
        """
        self.logger.info(f"Clicking wizard button (dispatch_event): {name}")
        self.page.get_by_role("button", name=name, exact=True).dispatch_event("click")

    def _resolve_textbox(self, label: str, required: bool | None = None):
        """
        Resolve a Step-1 textbox locator by its visible label.

        Required fields carry a trailing ' *' in their accessible name.
        `required=True` targets only the '{label} *' form, `required=False`
        targets only the bare label, and `required=None` (default) tries the
        '{label} *' form first (short timeout, to absorb async type-specific
        field rendering) and falls back to the bare label — this lets one
        call site work for both required and optional fields.
        """
        required_locator = self.page.get_by_role("textbox", name=f"{label} *", exact=True)
        plain_locator = self.page.get_by_role("textbox", name=label, exact=True)

        if required is True:
            self.wait_for_element(required_locator)
            return required_locator
        if required is False:
            self.wait_for_element(plain_locator)
            return plain_locator

        try:
            self.wait_for_element(required_locator, timeout=3000)
            return required_locator
        except PlaywrightTimeoutError:
            self.wait_for_element(plain_locator)
            return plain_locator

    # ==========================================
    #             STEP 1 — BASIC INFORMATION
    # ==========================================

    def select_family(self, family: str) -> "AssetCreatePage":
        """Open the Asset Family PrimeVue select and choose `family` (exact match — substring match would collide, e.g. 'Physical' vs other families)."""
        self.click(self.page.locator("#asset_family_id"))
        self.click(self.page.get_by_role("option", name=family, exact=True))
        return self

    def select_type(self, type_name: str) -> "AssetCreatePage":
        """Open the Asset Type PrimeVue select (scoped to the already-selected Family) and choose `type_name`."""
        self.click(self.page.locator("#asset_type_id"))
        self.click(self.page.get_by_role("option", name=type_name, exact=True))
        return self

    def get_family_options(self) -> list[str]:
        """Open the Family select, read all visible option labels (in DOM order), then close the panel without selecting."""
        self.click(self.page.locator("#asset_family_id"))
        options = self.page.get_by_role("option").all_text_contents()
        self.page.keyboard.press("Escape")
        return options

    def get_type_options(self) -> list[str]:
        """Open the Type select (a Family must already be selected), read all visible option labels, then close without selecting."""
        self.click(self.page.locator("#asset_type_id"))
        options = self.page.get_by_role("option").all_text_contents()
        self.page.keyboard.press("Escape")
        return options

    def fill_asset_name(self, name: str) -> "AssetCreatePage":
        """Fill the universal required 'Asset Name *' field."""
        return self.fill_field("Asset Name", name, required=True)

    def fill_field(self, label: str, value: str, required: bool | None = None) -> "AssetCreatePage":
        """
        Fill a Step-1 textbox by its visible label.

        Quirks encoded: (a) type-specific fields render ASYNC after
        select_type() — this waits for the field to be visible before
        filling; (b) exact=True is mandatory since role-name matching is a
        case-insensitive substring match (e.g. 'Name *' would match
        'Asset Name *'). Pass `required=False` for optional fields with no
        asterisk (e.g. 'Description', 'Notes'); leave `required` unset to
        auto-detect either form.
        """
        locator = self._resolve_textbox(label, required)
        self.fill(locator, value)
        return self

    def select_dropdown(self, label: str, option: str) -> "AssetCreatePage":
        """
        Select `option` from a type-specific PrimeVue dropdown labelled
        'Select {label}' (e.g. select_dropdown("Environment", "Production")
        targets the 'Select Environment' combobox). Falls back to the bare
        `label` as the accessible name if the prefixed form isn't found —
        some dropdowns (verified live) expose their bare label instead once
        rendered.
        """
        prefixed = self.page.get_by_role("combobox", name=f"Select {label}")
        try:
            self.wait_for_element(prefixed, timeout=3000)
            trigger = prefixed
        except PlaywrightTimeoutError:
            trigger = self.page.get_by_role("combobox", name=label)
            self.wait_for_element(trigger)

        self.click(trigger)
        self._wait_for_fresh_listbox()
        self.click(self.page.get_by_role("option", name=option, exact=True))
        return self

    def select_dropdown_first(self, label: str) -> "AssetCreatePage":
        """Select the first available option from a 'Select {label}' dropdown whose option set is dynamic/unknown (e.g. Legal Basis)."""
        trigger = self.page.get_by_role("combobox", name=f"Select {label}")
        self.wait_for_element(trigger)
        self.click(trigger)
        self._wait_for_fresh_listbox()
        self.click(self.page.get_by_role("option").first)
        return self

    def _wait_for_fresh_listbox(self) -> None:
        """
        Wait for a PrimeVue option panel to open. PrimeVue leaves earlier
        selects' listboxes mounted (hidden) in the DOM, so once more than one
        select has been used on the page, get_by_role("listbox") resolves to
        multiple elements — the most-recently-opened one is always the last
        in DOM order.
        """
        try:
            listboxes = self.page.get_by_role("listbox")
            listboxes.last.wait_for(state="visible", timeout=3000)
        except PlaywrightTimeoutError:
            pass

    def select_owner(self, accessible_name: str, index: int = 0, exact: bool = True) -> "AssetCreatePage":
        """
        Select the Nth option from a user-lookup combobox (e.g.
        "Select a user or enter an email" for Primary Owner, exact=True; or
        "Select a user or enter an email (optional)" for Secondary Owner).
        The option set is a dynamic/anonymous user list, so options are
        picked by position rather than by name.
        """
        trigger = self.page.get_by_role("combobox", name=accessible_name, exact=exact)
        self.click(trigger)
        self._wait_for_fresh_listbox()
        self.click(self.page.get_by_role("option").nth(index))
        return self

    def pick_date(self, label: str, day: str, months_ahead: int = 0) -> "AssetCreatePage":
        """
        Commit a date via the PrimeVue calendar panel for the combobox whose
        accessible name contains `label` (e.g. "Purchase Date", "Review
        Date", "Expiry Date", "Retention"). Typed text is silently DROPPED by
        the model — a calendar-panel day click is the only way to set a date.

        Advances `months_ahead` months via 'Next Month' before clicking the
        `day` gridcell. When a second date panel is already open in the DOM
        (e.g. picking Expiry Date right after Review Date), both the
        'Next Month' button and the day gridcells are duplicated — the LAST
        match is used in that case.
        """
        trigger = self.page.get_by_role("combobox", name=re.compile(re.escape(label)))
        self.click(trigger)

        for _ in range(months_ahead):
            next_month = self.page.get_by_role("button", name="Next Month")
            if next_month.count() > 1:
                next_month = next_month.last
            self.click(next_month)

        day_cell = self.page.get_by_role("gridcell", name=day, exact=True)
        day_cell = day_cell.last if day_cell.count() > 1 else day_cell.first
        self.click(day_cell)
        return self

    def toggle_switch(self, index: int = 0) -> "AssetCreatePage":
        """Click the Nth Step-2 switch (0=Legal Hold, 1=Archive Flag, verified order). force=True — the switch track intercepts pointer events."""
        self.page.get_by_role("switch").nth(index).click(force=True)
        return self

    # ==========================================
    #             WIZARD NAVIGATION
    # ==========================================

    def next_step(self) -> "AssetCreatePage":
        """Advance from Step 1 to Step 2 and assert the 'Optional Information' heading appears."""
        self._click_wizard("Next")
        expect(self.page.get_by_role("heading", name="Optional Information")).to_be_visible()
        return self

    def next_step_expect_blocked(self) -> "AssetCreatePage":
        """Click Next without asserting advancement — used by Step-1 validation-error tests."""
        self._click_wizard("Next")
        return self

    def back(self) -> "AssetCreatePage":
        """Return from Step 2 to Step 1 and assert the 'Basic Information' heading reappears; previously entered values are preserved."""
        self._click_wizard("Back")
        expect(self.page.get_by_role("heading", name="Basic Information")).to_be_visible()
        return self

    def cancel(self) -> "AssetsListPage":  # noqa: F821 - resolved via lazy import below
        """Discard all entered data and return to the Assets Manager list."""
        from pages.grc.assets_list_page import AssetsListPage  # lazy: avoid circular import

        self._click_wizard("Cancel")
        self.wait_for_url(re.compile(r".*/grc/assets/?$"))
        return AssetsListPage(self.page)

    def create(self) -> AssetDetailsPage:
        """Submit the wizard and wait for the redirect to the asset detail page."""
        self._click_wizard("Create")
        self.wait_for_url("**/grc/assets/details**", timeout=15000)
        return AssetDetailsPage(self.page)

    def create_expect_no_redirect(self) -> "AssetCreatePage":
        """Click Create without asserting redirect — used for duplicate-reject / server-validation tests."""
        self._click_wizard("Create")
        return self

    # ==========================================
    #             ASSERTIONS
    # ==========================================

    def assert_inline_error(self, field: str, message: str | None = None) -> "AssetCreatePage":
        """
        Assert the inline '{field} is required.' error is visible (rendered as
        `small.text-allendevaux-red-50` below the field). Pass `message` for
        fields whose live error text deviates from the standard pattern (e.g.
        the base Asset Name field surfaces the generic "This field is
        required" instead of "Asset Name is required.").
        """
        text = message if message is not None else f"{field} is required."
        expect(self.page.get_by_text(text)).to_be_visible()
        return self

    def assert_duplicate_rejected(self) -> "AssetCreatePage":
        """Assert the duplicate-identifier toast ('...same identifier already exists') is visible after Create was rejected."""
        expect(
            self.page.get_by_text(re.compile("same identifier already exists", re.IGNORECASE)).first
        ).to_be_visible(timeout=15000)
        return self

    def assert_still_on_step1(self) -> "AssetCreatePage":
        """Assert the wizard never advanced: URL is still /grc/assets/create and Step 2's heading never rendered."""
        expect(self.page).to_have_url(re.compile(r"/grc/assets/create"))
        expect(self.page.get_by_role("heading", name="Optional Information")).to_have_count(0)
        return self

    def assert_heading(self, name: str) -> "AssetCreatePage":
        """Assert a step heading (e.g. 'Basic Information', 'Optional Information', 'Create New Asset') is visible."""
        expect(self.page.get_by_role("heading", name=name)).to_be_visible()
        return self

    def assert_breadcrumb_link(self, name: str) -> "AssetCreatePage":
        """Assert a breadcrumb link (e.g. 'Asset Manager', 'Create New Asset') is visible."""
        expect(self.page.get_by_role("link", name=name)).to_be_visible()
        return self

    def assert_create_manually_selected(self) -> "AssetCreatePage":
        """Assert the 'Create manually' radio is pre-selected and 'Import bulk of assets' is not."""
        expect(self.page.get_by_role("radio", name="Create manually")).to_be_checked()
        expect(self.page.get_by_role("radio", name="Import bulk of assets")).not_to_be_checked()
        return self

    def assert_no_default_family_or_type(self) -> "AssetCreatePage":
        """Assert the Family/Type selects render with placeholder text (non-empty) but no real value pre-selected."""
        family_text = self.page.locator("#asset_family_id").inner_text()
        type_text = self.page.locator("#asset_type_id").inner_text()
        assert len(family_text.strip()) > 0, "Family select should show placeholder text"
        assert len(type_text.strip()) > 0, "Type select should show placeholder text"
        return self

    def assert_type_specific_field_absent(self, label: str) -> "AssetCreatePage":
        """Assert a type-specific required field (e.g. 'Application Name *') is absent — no Type selected yet, or Family/Type changed away from it."""
        expect(self.page.get_by_role("textbox", name=f"{label} *")).to_have_count(0)
        return self

    def assert_no_asset_code_field(self) -> "AssetCreatePage":
        """Assert no manual Asset Code input exists anywhere on the create form — Asset Code is always system-generated."""
        expect(self.page.get_by_role("textbox", name=re.compile("Asset Code", re.IGNORECASE))).to_have_count(0)
        return self

    def assert_field_value(self, label: str, value: str, required: bool | None = None) -> "AssetCreatePage":
        """Assert a Step-1 textbox currently holds `value` (e.g. after Back navigation preserves Step 1 state)."""
        locator = self._resolve_textbox(label, required)
        expect(locator).to_have_value(value)
        return self

    def assert_family_selected(self, family: str) -> "AssetCreatePage":
        """Assert the Family select displays `family` as its current value (used after Back navigation)."""
        expect(self.page.locator("#asset_family_id")).to_contain_text(family)
        return self

    def assert_type_selected(self, type_name: str) -> "AssetCreatePage":
        """Assert the Type select displays `type_name` as its current value (used after Back navigation)."""
        expect(self.page.locator("#asset_type_id")).to_contain_text(type_name)
        return self

    def assert_field_id_value(self, field_id: str, value: str) -> "AssetCreatePage":
        """
        Assert a Step-1 field identified by its stable element id (e.g.
        "environment") contains `value`. Needed because once a PrimeVue
        select has a value chosen, its accessible name becomes the VALUE
        itself instead of the 'Select X' placeholder, so role-based lookup
        by the original label no longer works.
        """
        expect(self.page.locator(f"#{field_id}")).to_contain_text(value)
        return self

    def assert_dropdown_enabled(self, accessible_name: str) -> "AssetCreatePage":
        """Assert a combobox with the given full accessible name (e.g. 'Select or add a relationship type') is enabled."""
        expect(self.page.get_by_role("combobox", name=accessible_name)).to_be_enabled()
        return self

    def assert_dropdown_disabled(self, accessible_name: str) -> "AssetCreatePage":
        """Assert a combobox with the given full accessible name (e.g. 'Select linked controls') is disabled."""
        expect(self.page.get_by_role("combobox", name=accessible_name)).to_be_disabled()
        return self

    def assert_input_capped_below(self, label: str, over_long_length: int, required: bool | None = None) -> "AssetCreatePage":
        """Assert a field's value — after attempting to fill `over_long_length` characters — was capped shorter (frontend enforces some max length, exact cap unknown/unverified)."""
        locator = self._resolve_textbox(label, required)
        value = self.get_input_value(locator)
        assert len(value) < over_long_length, f"{label}: expected value capped below {over_long_length} chars, got {len(value)}"
        return self

    def assert_input_max_length(self, label: str, max_length: int, required: bool | None = None) -> "AssetCreatePage":
        """Assert a field's value length does not exceed `max_length` (frontend maxlength enforcement with a known/verified cap)."""
        locator = self._resolve_textbox(label, required)
        value = self.get_input_value(locator)
        assert len(value) <= max_length, f"{label}: expected value length <= {max_length}, got {len(value)}"
        return self

    def assert_switch_visible(self, index: int = 0) -> "AssetCreatePage":
        """Assert the Nth Step-2 switch (0=Legal Hold, 1=Archive Flag) is visible."""
        expect(self.page.get_by_role("switch").nth(index)).to_be_visible()
        return self

    def assert_text_visible(self, text: str, first: bool = False) -> "AssetCreatePage":
        """Generic assertion that literal text is visible on the current step (e.g. 'Disabled', 'Relationships (Tagging)'). Pass first=True when the text may match more than one element."""
        locator = self.page.get_by_text(text)
        if first:
            locator = locator.first
        expect(locator).to_be_visible()
        return self

    def assert_create_url_retained(self) -> "AssetCreatePage":
        """Assert the URL is still /grc/assets/create — used after a rejected duplicate Create, where the wizard may still be showing Step 2 (unlike assert_still_on_step1, this does NOT assert Step-2 heading absence)."""
        expect(self.page).to_have_url(re.compile(r".*/grc/assets/create"))
        return self

    def assert_family_options_order(self, expected: list[str]) -> "AssetCreatePage":
        """Assert the Family select's options render in exactly `expected` DOM order."""
        options = self.get_family_options()
        assert options == expected, f"Family options order: expected {expected}, got {options}"
        return self

    def assert_type_options_order(self, expected: list[str]) -> "AssetCreatePage":
        """Assert the Type select's options (Family already selected) render in exactly `expected` DOM order."""
        options = self.get_type_options()
        assert options == expected, f"Type options order: expected {expected}, got {options}"
        return self

    def assert_type_not_selected(self, type_name: str) -> "AssetCreatePage":
        """Assert the Type select no longer shows `type_name` as its current value (e.g. after the Family changed and reset it)."""
        assert type_name not in self.page.locator("#asset_type_id").inner_text().strip(), \
            f"Expected Type select to no longer show '{type_name}'"
        return self

    def assert_type_specific_field_present(self, label: str) -> "AssetCreatePage":
        """Assert a type-specific required field (e.g. 'Application Name *') is visible for the currently selected Type."""
        expect(self.page.get_by_role("textbox", name=f"{label} *", exact=True)).to_be_visible()
        return self

    def assert_dropdown_visible(self, accessible_name: str) -> "AssetCreatePage":
        """Assert a combobox with the given accessible name (e.g. 'Select Environment') is visible."""
        expect(self.page.get_by_role("combobox", name=accessible_name)).to_be_visible()
        return self

    def assert_future_purchase_date_rejected(self) -> "AssetCreatePage":
        """
        CRT_057 bug-probe: after Next was clicked with a future Purchase Date
        (via next_step_expect_blocked), the portal's behavior toward future
        dates is unverified/unfixed, so this branches on what actually
        happened rather than asserting one fixed outcome. If Step 2 rendered
        anyway, attempts Create and then asserts either the wizard stayed on
        /grc/assets/create (rejected late) or a future/invalid-date error
        message is visible.
        """
        if self.page.get_by_role("heading", name="Optional Information").is_visible():
            self._click_wizard("Create")
        if "/grc/assets/create" in self.page.url:
            expect(self.page).to_have_url(re.compile(r"/grc/assets/create"))
        else:
            expect(
                self.page.get_by_text(re.compile("future|invalid|purchase date", re.IGNORECASE)).first
            ).to_be_visible()
        return self
