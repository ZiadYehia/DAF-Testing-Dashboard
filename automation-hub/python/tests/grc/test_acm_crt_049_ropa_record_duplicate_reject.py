"""
CRT_049 — Validate that a duplicate 'ROPA Record' Processing Purpose + Legal
Basis combination is rejected (uniqueness is on the pair, not on Processing
Purpose alone).
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT049:

    @pytest.mark.regression
    @allure.title("CRT_049: duplicate ROPA Record Processing Purpose + Legal Basis combination is rejected")
    def test_ropa_record_duplicate_reject(self, asset_create_page):
        uniq = unique_suffix()
        dup_purpose = f"QA Dup Purpose {uniq}"

        # Fixture create — establishes the asset that will collide
        # portal build 2026-07-06: Legal Basis became required for ROPA
        assets_page = (asset_create_page
            .select_family("Privacy")
            .select_type("ROPA Record")
            .fill_asset_name(f"QA ROPA Dup A {uniq}")
            .fill_field("Processing Purpose", dup_purpose, required=True)
            .select_dropdown_first("Legal Basis")
            .next_step()
            .create()
            .back_to_asset_manager())

        # Attempt a second create with the same identifier
        (assets_page
            .add_new()
            .select_family("Privacy")
            .select_type("ROPA Record")
            .fill_asset_name(f"QA ROPA Dup B {uniq}")
            .fill_field("Processing Purpose", dup_purpose, required=True)
            .select_dropdown_first("Legal Basis")
            .next_step()
            .create_expect_no_redirect()
            .assert_duplicate_rejected()
            .assert_url_contains("/grc/assets/create"))
