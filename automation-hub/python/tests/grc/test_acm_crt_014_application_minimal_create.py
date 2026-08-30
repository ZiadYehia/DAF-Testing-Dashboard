"""
CRT_014 — Validate that an 'Application' asset can be created with only its
required fields filled and Step 2 left blank.
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT014:

    @pytest.mark.regression
    @allure.title("CRT_014: Application asset created with required fields only")
    def test_application_minimal_create(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA App {uniq}"
        app_name = f"QA CRM App {uniq}"
        (asset_create_page
            .select_family("Technology & Digital")
            .select_type("Application")
            .fill_asset_name(asset_name)
            .fill_field("Application Name", app_name)
            .select_dropdown("Environment", "Production")
            .next_step()
            .create()
            .assert_created(asset_name)
            .assert_field("Application Name", app_name)
            .assert_field("Environment", "Production"))
