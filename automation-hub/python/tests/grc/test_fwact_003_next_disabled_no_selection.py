"""
FW_ACT_003 — Validate the Next button is disabled on Step 1 of the Framework
Activate wizard when no framework card has been selected.
Feature: Framework Activate Wizard
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT003:

    @pytest.mark.regression
    @allure.title("FW_ACT_003: Next button disabled with no framework selected")
    def test_next_disabled_no_selection(self, framework_activate_wizard_page):
        (framework_activate_wizard_page
            .assert_on_step1()
            .assert_next_disabled())
