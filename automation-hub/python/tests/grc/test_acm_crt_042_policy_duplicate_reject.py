"""
CRT_042 — Validate that a duplicate 'Policy' Policy Name + Version
combination is rejected.
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT042:

    @pytest.mark.regression
    @allure.title("CRT_042: duplicate Policy Policy Name + Version combination is rejected")
    def test_policy_duplicate_reject(self, asset_create_page):
        uniq = unique_suffix()
        dup_policy_name = f"QA Dup Policy {uniq}"
        dup_version = "1.0"

        # Fixture create — establishes the asset that will collide
        assets_page = (asset_create_page
            .select_family("Governance & Compliance")
            .select_type("Policy")
            .fill_asset_name(f"QA Policy Dup A {uniq}")
            .fill_field("Policy Name", dup_policy_name, required=True)
            .fill_field("Version", dup_version, required=True)
            .next_step()
            .create()
            .go_to_asset_manager())

        # Attempt a second create with the same Policy Name + Version
        (assets_page
            .add_new()
            .select_family("Governance & Compliance")
            .select_type("Policy")
            .fill_asset_name(f"QA Policy Dup B {uniq}")
            .fill_field("Policy Name", dup_policy_name, required=True)
            .fill_field("Version", dup_version, required=True)
            .next_step()
            .create_expect_no_redirect()
            .assert_duplicate_rejected()
            .assert_create_url_retained())
