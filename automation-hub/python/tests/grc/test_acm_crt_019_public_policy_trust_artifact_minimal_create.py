"""
CRT_019 — Validate that a 'Public Policy / Trust Artifact' asset can be
created with only its required field filled and Step 2 left blank.
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT019:

    @pytest.mark.regression
    @allure.title("CRT_019: Public Policy / Trust Artifact asset created with required fields only")
    def test_public_policy_trust_artifact_minimal_create(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Trust Artifact {uniq}"
        (asset_create_page
            .select_family("Trust & Public")
            .select_type("Public Policy / Trust Artifact")
            .fill_asset_name(asset_name)
            .fill_field("Title", f"QA Trust Statement {uniq}", required=True)
            .next_step()
            .create()
            .assert_created(asset_name)
            .assert_field("Title", f"QA Trust Statement {uniq}"))
