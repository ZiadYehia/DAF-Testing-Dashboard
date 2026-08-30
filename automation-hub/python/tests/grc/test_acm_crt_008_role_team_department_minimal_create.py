"""
CRT_008 — Validate that a 'Role / Team / Department' asset can be created
with only its required field filled and Step 2 left blank.
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT008:

    @pytest.mark.regression
    @allure.title("CRT_008: Role / Team / Department asset created with required fields only")
    def test_role_team_department_minimal_create(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Role {uniq}"
        team_name = f"QA Team Alpha {uniq}"
        # 'Name *' would ambiguously match 'Asset Name *' as a substring — fill_field
        # resolves it via exact=True internally.
        (asset_create_page
            .select_family("Organizational & Responsibility")
            .select_type("Role / Team / Department")
            .fill_asset_name(asset_name)
            .fill_field("Name", team_name)
            .next_step()
            .create()
            .assert_created(asset_name)
            .assert_field("Name", team_name))
