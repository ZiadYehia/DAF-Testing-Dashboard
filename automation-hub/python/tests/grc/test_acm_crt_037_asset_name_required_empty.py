"""
CRT_037 — empty base Asset Name blocks Next regardless of asset type
Feature: Asset Create Manual
"""
import allure
import pytest


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT037:

    @pytest.mark.regression
    @allure.title("CRT_037: empty base Asset Name blocks Next regardless of asset type")
    def test_asset_name_required_empty(self, asset_create_page):
        (asset_create_page
            .select_family("Technology & Digital")
            .select_type("Application")
            # Asset Name intentionally left empty
            .fill_field("Application Name", "QA App", required=True)
            .select_dropdown("Environment", "Production")
            .next_step_expect_blocked()
            .assert_inline_error("Asset Name", message="This field is required")
            .assert_still_on_step1())
