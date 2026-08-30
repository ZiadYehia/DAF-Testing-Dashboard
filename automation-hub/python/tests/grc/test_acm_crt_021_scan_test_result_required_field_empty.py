"""
CRT_021 — inline error when Scan / Test Result's Scan Execution ID is left empty
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT021:

    @pytest.mark.regression
    @allure.title("CRT_021: inline error when Scan / Test Result's Scan Execution ID is left empty")
    def test_scan_test_result_required_field_empty(self, asset_create_page):
        uniq = unique_suffix()
        name = f"QA Scan Neg {uniq}"
        (asset_create_page
            .select_family("Evidence")
            .select_type("Scan / Test Result")
            .fill_asset_name(name)
            .assert_text_visible("Scan Execution ID", first=True)
            .next_step_expect_blocked()
            .assert_inline_error("Scan Execution ID")
            .assert_still_on_step1())
