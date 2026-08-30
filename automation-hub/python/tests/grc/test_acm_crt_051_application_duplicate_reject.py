"""
CRT_051 — Validate that a duplicate 'Application' Application Name +
Environment combination is rejected.
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT051:

    @pytest.mark.regression
    @allure.title("CRT_051: duplicate Application Application Name + Environment combination is rejected")
    def test_application_duplicate_reject(self, asset_create_page):
        uniq = unique_suffix()
        dup_app_name = f"QA Dup App {uniq}"

        # Fixture create — establishes the asset that will collide
        assets_page = (asset_create_page
            .select_family("Technology & Digital")
            .select_type("Application")
            .fill_asset_name(f"QA App Dup A {uniq}")
            .fill_field("Application Name", dup_app_name, required=True)
            .select_dropdown("Environment", "Production")
            .next_step()
            .create()
            .back_to_asset_manager())

        # Attempt a second create with the same Application Name + Environment
        (assets_page
            .add_new()
            .select_family("Technology & Digital")
            .select_type("Application")
            .fill_asset_name(f"QA App Dup B {uniq}")
            .fill_field("Application Name", dup_app_name, required=True)
            .select_dropdown("Environment", "Production")
            .next_step()
            .create_expect_no_redirect()
            .assert_duplicate_rejected()
            .assert_url_contains("/grc/assets/create"))
