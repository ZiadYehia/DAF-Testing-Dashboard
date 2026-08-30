"""
FW_ACT_024 — Validate Step 1's footer renders Cancel bottom-left and Next
bottom-right (correct DOM/visual order).
Feature: Framework Activate Wizard
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT024:

    @pytest.mark.regression
    @allure.title("FW_ACT_024: Footer Cancel bottom-left, Next bottom-right")
    def test_footer_cancel_before_next(self, framework_activate_wizard_page):
        framework_activate_wizard_page.assert_cancel_before_next()
