"""
FW_ACT_004 — Validate that the "Next" button on Step 1 becomes enabled after
a framework card is selected.
Feature: Framework Activate Wizard
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT004:

    @pytest.mark.regression
    @allure.title("FW_ACT_004: Next button enabled after a framework card is selected")
    def test_next_enabled_after_selection(self, framework_activate_wizard_page):
        (framework_activate_wizard_page
            .search("ISO 27001")
            .select_framework_card("ISO 27001 (2022)")
            .assert_next_enabled())
