"""
FW_ACT_040 — Validate that a checked owner survives Back then Next again,
and Activate stays enabled.
Feature: Framework Activate Wizard

Confirmed live 2026-07-29: passes today.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT040:

    @pytest.mark.regression
    @allure.title("FW_ACT_040: Checked owner survives round-tripping through Back and Next")
    def test_owner_survives_back_then_next(self, framework_activate_wizard_page):
        (framework_activate_wizard_page
            .search("ISO 27001")
            .select_framework_card("ISO 27001 (2022)")
            .next()
            .open_owner_picker()
            .check_owner("Clara Cogsworth")
            .close_owner_picker()
            .back()
            .next()
            .assert_owner_selected("Clara Cogsworth")
            .assert_activate_enabled())
