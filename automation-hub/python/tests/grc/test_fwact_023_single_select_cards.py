"""
FW_ACT_023 — Validate that only one framework card can be selected at a time
on Step 1 (single-select).
Feature: Framework Activate Wizard

Uses the "ISO 2" search (confirmed live 2026-07-29 to return both
"ISO 22301 (2019)" and "ISO 27001 (2022)" together) so both cards are
visible at once to select in sequence.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT023:

    @pytest.mark.regression
    @allure.title("FW_ACT_023: selecting a second card deselects the first (single-select)")
    def test_single_select_cards(self, framework_activate_wizard_page):
        (framework_activate_wizard_page
            .search("ISO 2")
            .select_framework_card("ISO 22301 (2019)")
            .select_framework_card("ISO 27001 (2022)")
            .assert_only_card_selected("ISO 27001 (2022)"))
