"""
FW_ACT_030 — Validate that an unauthenticated deep link to the Activate
Framework wizard redirects to login with a returnUrl.
Feature: Framework Activate Wizard

Uses a raw, unauthenticated page (no login at all) since the whole point of
this test is to hit /grc/frameworks/activate with no session — passes today.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT030:

    @pytest.mark.regression
    @allure.title("FW_ACT_030: Unauthenticated deep link redirects to login with returnUrl")
    def test_unauthenticated_redirect_to_login(self, framework_activate_wizard_page_unauthenticated):
        framework_activate_wizard_page_unauthenticated.assert_redirected_to_login()
