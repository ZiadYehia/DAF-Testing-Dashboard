"""
FW_ACT_013 — Validate that the "Back" button on Step 2 returns to Step 1 with
the previously selected framework still highlighted.
Feature: Framework Activate Wizard

The card has no radio input; the selected state is styling only (dark-blue
border) — see FW_ACT_037 for the related a11y defect (out of this range).
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT013:

    @pytest.mark.regression
    @allure.title("FW_ACT_013: Back from Step 2 returns to Step 1 with the card still selected")
    def test_back_preserves_selected_card(self, framework_activate_wizard_page):
        (framework_activate_wizard_page
            .search("ISO 27001")
            .select_framework_card("ISO 27001 (2022)")
            .next()
            .back()
            .assert_on_step1()
            .assert_only_card_selected("ISO 27001 (2022)"))
