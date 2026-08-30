"""
CRT_002 — Validate that a 'Scan / Test Result' asset can be created with only
its required field filled and Step 2 left blank.
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT002:

    @pytest.mark.regression
    @allure.title("CRT_002: Scan / Test Result asset created with required fields only")
    def test_scan_test_result_minimal_create(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Scan Result {uniq}"
        value = f"SCAN-EXEC-{uniq}"
        (asset_create_page
            .select_family("Evidence")
            .select_type("Scan / Test Result")
            .fill_asset_name(asset_name)
            .fill_field("Scan Execution ID", value)
            .next_step()
            .create()
            .assert_created(asset_name)
            .assert_field("Scan Execution ID", value))
