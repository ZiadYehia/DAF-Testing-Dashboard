"""
CRT_033 — inline error when Cloud Service's Tenant ID is left empty
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT033:

    @pytest.mark.regression
    @allure.title("CRT_033: inline error when Cloud Service's Tenant ID is left empty")
    def test_cloud_service_required_field_empty(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Cloud Service Neg {uniq}"

        (asset_create_page
            .select_family("Technology & Digital")
            .select_type("Cloud Service")
            .fill_asset_name(asset_name)
            # 'Tenant ID' intentionally left empty
            .assert_text_visible("Tenant ID", first=True)
            .next_step_expect_blocked()
            .assert_inline_error("Tenant ID")
            .assert_still_on_step1())
