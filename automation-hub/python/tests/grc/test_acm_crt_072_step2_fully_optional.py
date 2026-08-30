"""
CRT_072 — Validate that Step 2 is fully optional and Create succeeds
with every Step 2 field left blank.
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT072:

    @pytest.mark.regression
    @allure.title("CRT_072: Create succeeds with every Step 2 field left blank")
    def test_step2_fully_optional(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Step2 Blank {uniq}"

        (asset_create_page
            .select_family("Governance & Compliance")
            .select_type("Product / Service")
            .fill_asset_name(asset_name)
            .fill_field("Product ID", f"PROD-STEP2-BLANK-{uniq}")
            .next_step()
            # Step 2 intentionally left blank in full
            .create()
            # NOTE: the testcase's "Status defaults to Draft" expectation is stale — the
            # live portal has no Draft status (options: Active/Expired/Retired). CRT_073
            # owns the default-status check; this test only proves Step 2 is optional.
            .assert_created(asset_name))
