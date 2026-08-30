"""
FW_ACT_039 — Validate that "Back" from Step 2 preserves both the Step 1
search term and the selected framework.
Feature: Framework Activate Wizard

Confirmed live 2026-07-29: passes today.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT039:

    @pytest.mark.regression
    @allure.title("FW_ACT_039: Back preserves the Step 1 search term and selected card")
    def test_back_preserves_search_and_selection(self, framework_activate_wizard_page):
        (framework_activate_wizard_page
            .search("ISO 2")
            .select_framework_card("ISO 27001 (2022)")
            .next()
            .back()
            .assert_search_term("ISO 2")
            .assert_only_card_selected("ISO 27001 (2022)"))
