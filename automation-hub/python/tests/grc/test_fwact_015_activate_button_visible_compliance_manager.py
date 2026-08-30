"""
FW_ACT_015 — Validate a Compliance Manager can see the "+ Activate Framework"
button on the Framework Library page (entry point into the Framework Activate
wizard).
Feature: Framework Activate Wizard

RBAC roles aren't implemented yet — this uses the single logged-in test user
as a stand-in for the Compliance Manager role. Checks the LIBRARY page's
button visibility, so it uses the frameworks_library_page fixture rather than
the wizard page fixture (still "one page per test" — just a different single
page than the other 8 cases in this batch).
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT015:

    @pytest.mark.regression
    @allure.title("FW_ACT_015: Compliance Manager sees + Activate Framework button on Library")
    def test_activate_button_visible_compliance_manager(self, frameworks_library_page):
        frameworks_library_page.assert_activate_button_visible()
