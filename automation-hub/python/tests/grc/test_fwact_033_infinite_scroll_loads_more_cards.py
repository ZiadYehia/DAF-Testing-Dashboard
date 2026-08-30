"""
FW_ACT_033 — Validate that scrolling to the bottom of the Step 1 framework
grid loads the next page of cards via infinite scroll.
Feature: Framework Activate Wizard

Confirmed live 2026-07-29: the grid starts with 12 cards and appends the
next 12 (-> at least 24) after scrolling to the bottom, with no pagination
control or page reload. Passes today.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT033:

    @pytest.mark.regression
    @allure.title("FW_ACT_033: Scrolling to the bottom of the grid loads more cards")
    def test_infinite_scroll_loads_more_cards(self, framework_activate_wizard_page):
        (framework_activate_wizard_page
            .assert_card_count(12)
            .scroll_grid_to_bottom()
            .assert_card_count_at_least(24))
