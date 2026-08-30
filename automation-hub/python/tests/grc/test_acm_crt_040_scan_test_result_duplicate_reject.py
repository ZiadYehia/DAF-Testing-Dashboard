"""
CRT_040 — Validate that a duplicate 'Scan / Test Result' Scan Execution ID
is rejected.
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT040:

    @pytest.mark.regression
    @allure.title("CRT_040: duplicate Scan / Test Result Scan Execution ID is rejected")
    def test_scan_test_result_duplicate_reject(self, asset_create_page):
        uniq = unique_suffix()
        dup_id = f"SCAN-EXEC-DUP-{uniq}"

        # Fixture create — establishes the asset that will collide
        assets_page = (asset_create_page
            .select_family("Evidence")
            .select_type("Scan / Test Result")
            .fill_asset_name(f"QA Scan Dup A {uniq}")
            .fill_field("Scan Execution ID", dup_id, required=True)
            .next_step()
            .create()
            .go_to_asset_manager())

        # Attempt a second create with the same identifier
        (assets_page
            .add_new()
            .select_family("Evidence")
            .select_type("Scan / Test Result")
            .fill_asset_name(f"QA Scan Dup B {uniq}")
            .fill_field("Scan Execution ID", dup_id, required=True)
            .next_step()
            .create_expect_no_redirect()
            .assert_duplicate_rejected()
            .assert_create_url_retained())
