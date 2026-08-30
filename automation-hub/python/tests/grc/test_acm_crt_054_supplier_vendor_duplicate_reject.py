"""
CRT_054 — Validate that a duplicate 'Supplier / Vendor' Supplier Name is
rejected.
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT054:

    @pytest.mark.regression
    @allure.title("CRT_054: duplicate Supplier / Vendor Supplier Name is rejected")
    def test_supplier_vendor_duplicate_reject(self, asset_create_page):
        uniq = unique_suffix()
        dup_name = f"QA Dup Vendor {uniq}"

        # Fixture create — establishes the asset that will collide
        assets_page = (asset_create_page
            .select_family("Third-Party")
            .select_type("Supplier / Vendor")
            .fill_asset_name(f"QA Supplier Dup A {uniq}")
            .fill_field("Supplier Name", dup_name, required=True)
            .next_step()
            .create()
            .back_to_asset_manager())

        # Attempt a second create with the same identifier
        (assets_page
            .add_new()
            .select_family("Third-Party")
            .select_type("Supplier / Vendor")
            .fill_asset_name(f"QA Supplier Dup B {uniq}")
            .fill_field("Supplier Name", dup_name, required=True)
            .next_step()
            .create_expect_no_redirect()
            .assert_duplicate_rejected()
            .assert_url_contains("/grc/assets/create"))
