"""
CRT_076 — Validate Asset Code is system-generated, immutable, and shown on
the detail page after creation (no manual Asset Code input exists anywhere
on the create form).
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT076:

    @pytest.mark.regression
    @allure.title("CRT_076: Asset Code is system-generated and not editable on the create form")
    def test_asset_code_system_generated(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Asset Code Check {uniq}"
        team_name = f"QA Asset Code Team {uniq}"

        (asset_create_page
            .assert_heading("Create New Asset")
            # Assert no manual Asset Code input exists anywhere on the create page
            .assert_no_asset_code_field()
            .select_family("Organizational & Responsibility")
            .select_type("Role / Team / Department")
            .fill_asset_name(asset_name)
            .fill_field("Name", team_name)
            .next_step()
            # Step 2 intentionally left blank
            .create()
            .assert_created(asset_name))
