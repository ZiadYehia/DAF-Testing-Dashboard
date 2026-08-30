"""Asset Details Page — GRC asset detail view (/grc/assets/details/...)."""
from __future__ import annotations

import re

from playwright.sync_api import expect

from autotest_framework.src.pages.base_page import BasePage

_AST_CODE_RE = re.compile(r"AST-\d+")
_DATE_RE = re.compile(r"\d{1,2}/\d{1,2}/\d{4}")


class AssetDetailsPage(BasePage):
    """Asset detail page reached after a successful Create."""

    def __init__(self, page):
        super().__init__(page, "Asset Details Page")

    def assert_created(self, asset_name: str) -> "AssetDetailsPage":
        """Assert the wizard redirected here after Create: URL contains /grc/assets/details, the asset name heading is visible, and a generated AST-nnn code is visible."""
        self.assert_url_contains("/grc/assets/details")
        expect(self.page.get_by_role("heading", name=asset_name)).to_be_visible()
        expect(self.page.get_by_text(_AST_CODE_RE).first).to_be_visible()
        return self

    def assert_field(self, label: str, value: str, exact: bool = False) -> "AssetDetailsPage":
        """
        Assert `value` is visible somewhere on the current tab. `label` is
        accepted for readability/self-documentation at call sites (e.g.
        assert_field("System File ID / File Hash", value)) but is not itself
        looked up — the portal renders the label and value in separate DOM
        nodes, so matching on the value text is the verified, reliable check.
        NOTE: on the 'Lifecycle & Dates' tab the rendered label is
        'Next Review Date', not 'Review Date' — use assert_date_field_present
        for those.
        """
        expect(self.page.get_by_text(value, exact=exact).first).to_be_visible()
        return self

    def open_tab(self, name: str) -> "AssetDetailsPage":
        """Switch to a details tab (e.g. 'Lifecycle & Dates'). Plain click — tabs are not overlapped by the floating chat FAB."""
        self.click(self.page.get_by_role("tab", name=name))
        return self

    def assert_date_field_present(self, label: str) -> "AssetDetailsPage":
        """
        Assert a date field on the current tab (e.g. 'Next Review Date' — NOT
        'Review Date' — or 'Expiry Date') shows a real date instead of a '—'
        placeholder. Display may be off-by-one day (known timezone rendering
        issue), so only the presence of a date pattern is asserted, not an
        exact value.
        """
        expect(self.page.get_by_role("heading", name=label).locator("xpath=..")).to_contain_text(_DATE_RE)
        return self

    def assert_status(self, status: str) -> "AssetDetailsPage":
        """Assert the Status control in the detail header shows `status` (its accessible name equals the current value once set)."""
        expect(self.page.get_by_role("combobox", name=status)).to_be_visible()
        return self

    def assert_text_visible(self, text: str, first: bool = False) -> "AssetDetailsPage":
        """Generic assertion that literal text is visible on the current tab. Pass first=True when the text may match more than one element."""
        locator = self.page.get_by_text(text)
        if first:
            locator = locator.first
        expect(locator).to_be_visible()
        return self

    def go_to_asset_manager(self):
        """Click the 'Asset Manager' breadcrumb link and return to the Assets Manager list."""
        from pages.grc.assets_list_page import AssetsListPage  # lazy: avoid circular import

        self.click(self.page.get_by_role("link", name="Asset Manager"))
        return AssetsListPage(self.page)

    # Alias — some migrated specs call this name for the same navigation.
    back_to_asset_manager = go_to_asset_manager

    # ─── Lifecycle status transitions (crawl 2026-07-13) ────────────────────
    # Header status pill is a combobox named after the current status. Picking
    # a new status opens a confirmation dialog:
    #   Expired → 'Mark asset as Expired' (expiry date in the PAST required)
    #   Active  → 'Mark asset as Active'  (expiry date in the FUTURE required)
    #   Retired → 'Retire asset'          (no date; warns expiry will be removed)

    def select_status(self, current_status: str, new_status: str) -> "AssetDetailsPage":
        """Open the header status dropdown (accessible name = current status) and select `new_status` — the matching confirmation dialog opens."""
        self.click(self.page.get_by_role("combobox", name=current_status))
        self.click(self.page.get_by_role("option", name=new_status))
        return self

    def assert_status_dialog(self, title: str, body_contains: str | None = None) -> "AssetDetailsPage":
        """Assert a status confirmation dialog (e.g. 'Mark asset as Expired', 'Retire asset') is open, optionally checking its body text."""
        dialog = self.page.get_by_role("dialog", name=title)
        expect(dialog).to_be_visible()
        if body_contains:
            expect(dialog).to_contain_text(body_contains)
        return self

    def pick_status_dialog_date(self, placeholder: str, day_of_month: int) -> "AssetDetailsPage":
        """Fill the status dialog's Expiry-date picker. `placeholder` is 'Select a date in the past' (Expired) or 'Select a date in the future' (Active). Out-of-range days are disabled — clicking them is a no-op, which negative tests rely on."""
        self.click(self.page.get_by_role("combobox", name=placeholder))
        expect(self.page.get_by_role("dialog", name="Choose Date")).to_be_visible()
        self.click(self.page.get_by_role("dialog", name="Choose Date").get_by_role("gridcell", name=str(day_of_month), exact=True).first)
        return self

    def confirm_status_dialog(self, target_status: str) -> "AssetDetailsPage":
        """Click the status dialog's confirm button — its label equals the target status ('Expired' / 'Active' / 'Retired')."""
        self.click(self.page.get_by_role("dialog").get_by_role("button", name=target_status, exact=True))
        return self

    def cancel_status_dialog(self) -> "AssetDetailsPage":
        """Dismiss the status confirmation dialog via its 'Cancel' button."""
        self.click(self.page.get_by_role("dialog").get_by_role("button", name="Cancel"))
        return self

    def assert_lifecycle_field(self, label: str, value: str) -> "AssetDetailsPage":
        """Assert a Lifecycle & Dates tab field (e.g. 'Expiry Date', 'Legal Hold') shows exactly `value` ('—' for unset; Legal Hold renders 'No'/'Yes')."""
        expect(self.page.get_by_role("heading", name=label, exact=True).locator("xpath=following-sibling::*[1]")).to_have_text(value)
        return self

    # ─── Relationships tab (crawl 2026-07-13) ───────────────────────────────
    # Table columns: Related Asset | Type | Relationship. Rows link to
    # /grc/assets/details?id=<related>&from=relationship&from_id=<current>.
    # The 'Add New Relationship' modal: combobox 'Choose an asset' (searchable
    # via 'Search...' searchbox) + combobox 'Select relationship'
    # (Ensured by / Governed by / Measured by / Supported by).

    def open_add_relationship_modal(self) -> "AssetDetailsPage":
        """Click '+ Add New' on the Relationships tab and assert the 'Add New Relationship' modal opened."""
        self.click(self.page.get_by_role("button", name="+ Add New"))
        expect(self.page.get_by_role("heading", name="Add New Relationship")).to_be_visible()
        return self

    def select_related_asset(self, asset_name: str) -> "AssetDetailsPage":
        """In the modal, open the 'Related asset' dropdown, search `asset_name`, and pick the matching option."""
        self.click(self.page.get_by_role("combobox", name="Choose an asset"))
        self.page.get_by_role("searchbox", name="Search...").fill(asset_name)
        self.click(self.page.get_by_role("option", name=asset_name).first)
        return self

    def select_relationship_type(self, label: str) -> "AssetDetailsPage":
        """In the modal, open the 'Relationship' dropdown and pick `label`."""
        self.click(self.page.get_by_role("combobox", name="Select relationship"))
        self.click(self.page.get_by_role("option", name=label))
        return self

    def submit_add_relationship(self, expect_success: bool = True) -> "AssetDetailsPage":
        """Submit the modal via '+ Add relationship'. Pass expect_success=False when a validation/server rejection is expected instead of the success toast."""
        self.click(self.page.get_by_role("button", name="+ Add relationship"))
        if expect_success:
            expect(self.page.get_by_text("Relationship Added", exact=True)).to_be_visible(timeout=10000)
        return self

    def discard_add_relationship_modal(self) -> "AssetDetailsPage":
        """Dismiss the 'Add New Relationship' modal via 'Discard'."""
        self.click(self.page.get_by_role("button", name="Discard"))
        return self

    def assert_toast(self, text: str) -> "AssetDetailsPage":
        """Assert an alert toast containing `text` is visible (e.g. 'Incomplete form', 'Failed to Add Relationship', 'Relationship Added')."""
        expect(self.page.get_by_role("alert").get_by_text(text).first).to_be_visible(timeout=10000)
        return self

    def assert_relationship_row(self, asset_name: str, label: str, type_text: str | None = None) -> "AssetDetailsPage":
        """Assert a relationships-table row exists linking `asset_name` with relationship `label` (and optionally the related asset's type)."""
        row = self.page.get_by_role("row").filter(has=self.page.get_by_role("link", name=asset_name)).filter(has_text=label)
        expect(row.first).to_be_visible()
        if type_text:
            expect(row.first).to_contain_text(type_text)
        return self

    def assert_relationship_row_count(self, asset_name: str, label: str, count: int) -> "AssetDetailsPage":
        """Assert exactly `count` relationships-table rows reference `asset_name` with relationship `label` (duplicate detection)."""
        rows = self.page.get_by_role("row").filter(has=self.page.get_by_role("link", name=asset_name)).filter(has_text=label)
        expect(rows).to_have_count(count)
        return self

    def open_relationship_row(self, asset_name: str) -> "AssetDetailsPage":
        """Click the relationships-table link for `asset_name` and assert navigation to the related asset's detail page (URL carries from=relationship&from_id=)."""
        self.click(self.page.get_by_role("link", name=asset_name).first)
        expect(self.page).to_have_url(re.compile(r"/grc/assets/details\?id=.+&from=relationship&from_id=.+"))
        return self

