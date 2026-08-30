"""
CRT_024 — inline error when Product / Service's Product ID is left empty
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT024:

    @pytest.mark.regression
    @allure.title("CRT_024: inline error when Product / Service's Product ID is left empty")
    def test_product_service_required_field_empty(self, asset_create_page):
        uniq = unique_suffix()
        name = f"QA Product Neg {uniq}"
        (asset_create_page
            .select_family("Governance & Compliance")
            .select_type("Product / Service")
            .fill_asset_name(name)
            .assert_text_visible("Product ID", first=True)
            .next_step_expect_blocked()
            .assert_inline_error("Product ID")
            .assert_still_on_step1())
