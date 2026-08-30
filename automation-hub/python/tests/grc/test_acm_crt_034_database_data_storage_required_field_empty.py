"""
CRT_034 — inline error when Database / Data Storage's Data Store Name is left empty
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT034:

    @pytest.mark.regression
    @allure.title("CRT_034: inline error when Database / Data Storage's Data Store Name is left empty")
    def test_database_data_storage_required_field_empty(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Database Neg {uniq}"

        (asset_create_page
            .select_family("Technology & Digital")
            .select_type("Database / Data Storage")
            .fill_asset_name(asset_name)
            # 'Data Store Name' intentionally left empty
            .assert_text_visible("Data Store Name", first=True)
            .next_step_expect_blocked()
            .assert_inline_error("Data Store Name")
            .assert_still_on_step1())
