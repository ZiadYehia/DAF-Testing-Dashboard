"""
CRT_023 — inline error when Policy's Version is left empty while Policy Name is filled
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT023:

    @pytest.mark.regression
    @allure.title("CRT_023: inline error when Policy's Version is left empty while Policy Name is filled")
    def test_policy_version_required_empty(self, asset_create_page):
        uniq = unique_suffix()
        name = f"QA Policy Neg {uniq}"
        (asset_create_page
            .select_family("Governance & Compliance")
            .select_type("Policy")
            .fill_asset_name(name)
            .fill_field("Policy Name", "QA Neg Policy", required=True)
            .assert_text_visible("Version", first=True)
            .next_step_expect_blocked()
            .assert_inline_error("Version")
            .assert_still_on_step1())
