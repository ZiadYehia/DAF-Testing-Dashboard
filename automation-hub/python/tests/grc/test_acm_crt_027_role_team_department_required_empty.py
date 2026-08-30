"""
CRT_027 — inline error when Role / Team / Department's Name is left empty
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT027:

    @pytest.mark.regression
    @allure.title("CRT_027: inline error when Role / Team / Department's Name is left empty")
    def test_role_team_department_required_empty(self, asset_create_page):
        uniq = unique_suffix()
        name = f"QA Role Neg {uniq}"
        (asset_create_page
            .select_family("Organizational & Responsibility")
            .select_type("Role / Team / Department")
            .fill_asset_name(name)
            .assert_type_specific_field_present("Name")
            .next_step_expect_blocked()
            .assert_inline_error("Name")
            .assert_still_on_step1())
