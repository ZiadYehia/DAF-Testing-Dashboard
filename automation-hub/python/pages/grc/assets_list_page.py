"""Assets List Page — GRC Asset Manager list (/grc/assets)."""
from __future__ import annotations

import re

from playwright.sync_api import expect

from autotest_framework.config import config
from autotest_framework.src.pages.base_page import BasePage
from pages.grc.asset_create_page import AssetCreatePage


class AssetsListPage(BasePage):
    """Asset Manager list page — entry point into the Create Manual wizard."""

    def __init__(self, page):
        super().__init__(page, "Assets List Page")

    def open(self) -> "AssetsListPage":
        """Navigate directly to the Assets Manager list."""
        self.navigate(f"{config.base_url}/grc/assets")
        return self

    def add_new(self) -> AssetCreatePage:
        """Click 'Add New' and wait for the Create Asset wizard (Step 1) to load."""
        self.click(self.page.get_by_text("Add New").first)
        self.wait_for_url("**/grc/assets/create**")
        return AssetCreatePage(self.page)

    def assert_on_list(self) -> "AssetsListPage":
        """Assert the current URL is the bare Assets Manager list (not create/details)."""
        expect(self.page).to_have_url(re.compile(r".*/grc/assets/?$"))
        return self

    def assert_asset_not_listed(self, asset_name: str) -> "AssetsListPage":
        """Assert an asset name does not appear anywhere on the list (e.g. after Cancel discarded it)."""
        expect(self.page.get_by_text(asset_name)).to_have_count(0)
        return self

    def assert_asset_listed(self, asset_name: str) -> "AssetsListPage":
        """Assert an asset name is visible somewhere on the list."""
        expect(self.page.get_by_text(asset_name).first).to_be_visible()
        return self
