"""
CRT_044 — Validate that a duplicate 'Contract / MSA / NDA' Contract ID is
rejected.
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT044:

    @pytest.mark.regression
    @allure.title("CRT_044: duplicate Contract / MSA / NDA Contract ID is rejected")
    def test_contract_duplicate_reject(self, asset_create_page):
        uniq = unique_suffix()
        dup_id = f"CTR-DUP-{uniq}"

        # Fixture create — establishes the asset that will collide
        assets_page = (asset_create_page
            .select_family("Legal & Contractual")
            .select_type("Contract / MSA / NDA")
            .fill_asset_name(f"QA Contract Dup A {uniq}")
            .fill_field("Contract ID", dup_id, required=True)
            .next_step()
            .create()
            .back_to_asset_manager())

        # Attempt a second create with the same identifier
        (assets_page
            .add_new()
            .select_family("Legal & Contractual")
            .select_type("Contract / MSA / NDA")
            .fill_asset_name(f"QA Contract Dup B {uniq}")
            .fill_field("Contract ID", dup_id, required=True)
            .next_step()
            .create_expect_no_redirect()
            .assert_duplicate_rejected()
            .assert_url_contains("/grc/assets/create"))
