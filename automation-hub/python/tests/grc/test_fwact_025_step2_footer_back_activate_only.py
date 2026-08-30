"""
FW_ACT_025 — Validate the "Back" button is on the bottom-left and "Activate"
is the only other button, on the bottom-right of Step 2.
Feature: Framework Activate Wizard

Confirmed as specified live (2026-07-29): the footer shows exactly two
visible buttons, "Back" and "Activate" — no "Save as Draft" or other
secondary button.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT025:

    @pytest.mark.regression
    @allure.title("FW_ACT_025: Step 2 footer shows exactly Back + Activate")
    def test_step2_footer_back_activate_only(self, framework_activate_wizard_page):
        (framework_activate_wizard_page
            .search("ISO 27001")
            .select_framework_card("ISO 27001 (2022)")
            .next()
            .assert_back_only_other_button_is_activate())
