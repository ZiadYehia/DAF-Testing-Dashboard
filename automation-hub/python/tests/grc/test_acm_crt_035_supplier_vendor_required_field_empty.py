"""
CRT_035 — inline error when Supplier / Vendor's Supplier Name is left empty
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT035:

    @pytest.mark.regression
    @allure.title("CRT_035: inline error when Supplier / Vendor's Supplier Name is left empty")
    def test_supplier_vendor_required_field_empty(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Supplier Neg {uniq}"

        (asset_create_page
            .select_family("Third-Party")
            .select_type("Supplier / Vendor")
            .fill_asset_name(asset_name)
            # 'Supplier Name' intentionally left empty
            .assert_text_visible("Supplier Name", first=True)
            .next_step_expect_blocked()
            .assert_inline_error("Supplier Name")
            .assert_still_on_step1())
