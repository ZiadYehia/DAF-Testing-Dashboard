"""
FW_ACT_035 — Validate that the Framework Owners overlay's filter input
narrows the ~219-user directory dynamically.
Feature: Framework Activate Wizard

Confirmed live 2026-07-29: filtering "clara" narrows the directory to
exactly 1 option, "Clara Cogsworth". Passes today.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT035:

    @pytest.mark.regression
    @allure.title("FW_ACT_035: Owner filter narrows the directory to a matching user")
    def test_owner_filter_narrows_directory(self, framework_activate_wizard_page):
        (framework_activate_wizard_page
            .select_framework_card("APEC Privacy Framework (2015)")
            .next()
            .open_owner_picker()
            .filter_owners("clara")
            .assert_owner_options_narrowed_to(1)
            .assert_owner_option_visible("Clara Cogsworth"))
