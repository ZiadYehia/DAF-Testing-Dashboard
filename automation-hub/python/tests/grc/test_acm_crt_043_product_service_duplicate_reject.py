"""
CRT_043 — Validate that a duplicate 'Product / Service' Product ID is rejected.
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT043:

    @pytest.mark.regression
    @allure.title("CRT_043: duplicate Product / Service Product ID is rejected")
    def test_product_service_duplicate_reject(self, asset_create_page):
        uniq = unique_suffix()
        dup_id = f"PROD-DUP-{uniq}"

        # Fixture create — establishes the asset that will collide
        assets_page = (asset_create_page
            .select_family("Governance & Compliance")
            .select_type("Product / Service")
            .fill_asset_name(f"QA Product Dup A {uniq}")
            .fill_field("Product ID", dup_id, required=True)
            .next_step()
            .create()
            .go_to_asset_manager())

        # Attempt a second create with the same identifier
        (assets_page
            .add_new()
            .select_family("Governance & Compliance")
            .select_type("Product / Service")
            .fill_asset_name(f"QA Product Dup B {uniq}")
            .fill_field("Product ID", dup_id, required=True)
            .next_step()
            .create_expect_no_redirect()
            .assert_duplicate_rejected()
            .assert_create_url_retained())
