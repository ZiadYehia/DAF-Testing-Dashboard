"""
CRT_004 — Validate that a 'Policy' asset can be created with only its
required fields filled and Step 2 left blank.
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT004:

    @pytest.mark.regression
    @allure.title("CRT_004: Policy asset created with required fields only")
    def test_policy_minimal_create(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Policy {uniq}"
        policy_name = f"QA Data Retention Policy {uniq}"
        version = "1.0"
        (asset_create_page
            .select_family("Governance & Compliance")
            .select_type("Policy")
            .fill_asset_name(asset_name)
            .fill_field("Policy Name", policy_name)
            .fill_field("Version", version)
            .next_step()
            .create()
            .assert_created(asset_name)
            .assert_field("Policy Name", policy_name)
            .assert_field("Version", version))
