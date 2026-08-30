"""
CRT_073 — Validate that leaving Step 2 Status blank auto-sets the asset
to Draft.

NOTE: The live portal's observed default status is actually "Active" (a
known discrepancy from the documented expected behavior). This assertion
intentionally checks for "Draft" per the testcase spec — the assertion
failing is the expected signal that surfaces the bug.
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT073:

    @pytest.mark.regression
    @allure.title("CRT_073: Leaving Step 2 Status blank auto-sets asset to Draft")
    def test_blank_status_defaults_draft(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Default Draft {uniq}"

        (asset_create_page
            .select_family("Governance & Compliance")
            .select_type("Policy")
            .fill_asset_name(asset_name)
            .fill_field("Policy Name", f"QA Default Draft Policy {uniq}")
            .fill_field("Version", "1.0")
            .next_step()
            # Step 2 Status dropdown left at its unselected placeholder
            .create()
            # Per testcase: Status should default to Draft. KNOWN BUG: live portal shows
            # "Active" instead — this assertion is expected to fail, surfacing the bug.
            # KNOWN RED: portal has no Draft status anymore
            .assert_created(asset_name)
            .assert_text_visible("Draft"))
