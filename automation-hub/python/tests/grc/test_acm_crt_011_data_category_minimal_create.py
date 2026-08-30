"""
CRT_011 — Validate that a 'Data Category' asset can be created with only its
required field filled and Step 2 left blank.
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT011:

    @pytest.mark.regression
    @allure.title("CRT_011: Data Category asset created with required fields only")
    def test_data_category_minimal_create(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Data Category {uniq}"
        category_name = f"QA Customer PII {uniq}"
        (asset_create_page
            .select_family("Privacy")
            .select_type("Data Category")
            .fill_asset_name(asset_name)
            .fill_field("Data Category Name", category_name)
            .next_step()
            .create()
            .assert_created(asset_name)
            .assert_field("Data Category Name", category_name))
