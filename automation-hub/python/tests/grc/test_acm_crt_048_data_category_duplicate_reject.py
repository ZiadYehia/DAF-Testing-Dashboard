"""
CRT_048 — Validate that a duplicate 'Data Category' Data Category Name is
rejected.
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT048:

    @pytest.mark.regression
    @allure.title("CRT_048: duplicate Data Category Data Category Name is rejected")
    def test_data_category_duplicate_reject(self, asset_create_page):
        uniq = unique_suffix()
        dup_name = f"QA Dup Category {uniq}"

        # Fixture create — establishes the asset that will collide
        assets_page = (asset_create_page
            .select_family("Privacy")
            .select_type("Data Category")
            .fill_asset_name(f"QA Data Category Dup A {uniq}")
            .fill_field("Data Category Name", dup_name, required=True)
            .next_step()
            .create()
            .back_to_asset_manager())

        # Attempt a second create with the same identifier
        (assets_page
            .add_new()
            .select_family("Privacy")
            .select_type("Data Category")
            .fill_asset_name(f"QA Data Category Dup B {uniq}")
            .fill_field("Data Category Name", dup_name, required=True)
            .next_step()
            .create_expect_no_redirect()
            .assert_duplicate_rejected()
            .assert_url_contains("/grc/assets/create"))
