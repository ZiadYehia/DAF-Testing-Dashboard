"""
CRT_046 — Validate that a duplicate 'Role / Team / Department' Name is
rejected.
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT046:

    @pytest.mark.regression
    @allure.title("CRT_046: duplicate Role / Team / Department Name is rejected")
    def test_role_team_department_duplicate_reject(self, asset_create_page):
        uniq = unique_suffix()
        dup_name = f"QA Dup Team {uniq}"

        # Fixture create — establishes the asset that will collide
        # 'Name *' would ambiguously match 'Asset Name *' as a substring, and
        # the field renders async — fill_field(required=True) waits for the
        # exact 'Name *' textbox before filling it.
        assets_page = (asset_create_page
            .select_family("Organizational & Responsibility")
            .select_type("Role / Team / Department")
            .fill_asset_name(f"QA Role Dup A {uniq}")
            .fill_field("Name", dup_name, required=True)
            .next_step()
            .create()
            .back_to_asset_manager())

        # Attempt a second create with the same identifier
        (assets_page
            .add_new()
            .select_family("Organizational & Responsibility")
            .select_type("Role / Team / Department")
            .fill_asset_name(f"QA Role Dup B {uniq}")
            .fill_field("Name", dup_name, required=True)
            .next_step()
            .create_expect_no_redirect()
            .assert_duplicate_rejected()
            .assert_url_contains("/grc/assets/create"))
