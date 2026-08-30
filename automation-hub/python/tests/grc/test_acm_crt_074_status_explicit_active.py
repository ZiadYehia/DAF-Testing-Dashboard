"""
CRT_074 — Validate that Status can be explicitly set to 'Active' in
Step 2.
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT074:

    @pytest.mark.regression
    @allure.title("CRT_074: Status can be explicitly set to Active in Step 2")
    def test_status_explicit_active(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Active Status {uniq}"

        (asset_create_page
            .select_family("Governance & Compliance")
            .select_type("Control")
            .fill_asset_name(asset_name)
            .fill_field("Control Code", f"CTRL-QA-ACTIVE-{uniq}")
            .next_step()
            # Step 2 — explicitly select Active from the Status dropdown
            .select_dropdown("a status", "Active")
            .create()
            .assert_created(asset_name)
            # Status control in the detail header reads Active (accessible name = current value)
            .assert_status("Active"))
