"""
CRT_032 — inline errors when Application's Application Name and Environment are both left empty
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT032:

    @pytest.mark.regression
    @allure.title("CRT_032: inline errors when Application's Application Name and Environment are both left empty")
    def test_application_required_fields_empty(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA App Neg {uniq}"

        (asset_create_page
            .select_family("Technology & Digital")
            .select_type("Application")
            .fill_asset_name(asset_name)
            # Application Name, Environment all intentionally left empty
            .assert_text_visible("Application Name", first=True)
            .next_step_expect_blocked()
            .assert_inline_error("Application Name")
            .assert_inline_error("Environment")
            .assert_still_on_step1())
