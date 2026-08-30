"""
FW_ACT_016 — Validate an Admin can see the "+ Activate Framework" button on
the Framework Library page (entry point into the Framework Activate wizard).
Feature: Framework Activate Wizard

RBAC roles aren't implemented yet — this uses the same logged-in test user as
FW_ACT_015, framed for the Admin role instead of Compliance Manager.
Functionally identical to FW_ACT_015 today (deliberately duplicated per their
distinct IDs — will diverge once RBAC-scoped users exist).
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT016:

    @pytest.mark.regression
    @allure.title("FW_ACT_016: Admin sees + Activate Framework button on Library")
    def test_activate_button_visible_admin(self, frameworks_library_page):
        frameworks_library_page.assert_activate_button_visible()
