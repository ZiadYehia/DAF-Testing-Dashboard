"""
CRT_029 — inline error when Data Category's Data Category Name is left empty
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT029:

    @pytest.mark.regression
    @allure.title("CRT_029: inline error when Data Category's Data Category Name is left empty")
    def test_data_category_required_field_empty(self, asset_create_page):
        uniq = unique_suffix()
        name = f"QA Data Category Neg {uniq}"
        (asset_create_page
            .select_family("Privacy")
            .select_type("Data Category")
            .fill_asset_name(name)
            .assert_text_visible("Data Category Name", first=True)
            .next_step_expect_blocked()
            .assert_inline_error("Data Category Name")
            .assert_still_on_step1())
