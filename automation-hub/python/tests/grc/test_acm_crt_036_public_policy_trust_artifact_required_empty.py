"""
CRT_036 — inline error when Public Policy / Trust Artifact's Title is left empty
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT036:

    @pytest.mark.regression
    @allure.title("CRT_036: inline error when Public Policy / Trust Artifact's Title is left empty")
    def test_public_policy_trust_artifact_required_empty(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Trust Artifact Neg {uniq}"

        (asset_create_page
            .select_family("Trust & Public")
            .select_type("Public Policy / Trust Artifact")
            .fill_asset_name(asset_name)
            # 'Title' intentionally left empty
            .assert_text_visible("Title", first=True)
            .next_step_expect_blocked()
            .assert_inline_error("Title")
            .assert_still_on_step1())
