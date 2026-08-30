"""
FWL_013 — Validate that clicking a framework card navigates to that
framework's own Framework Details page.
Feature: Frameworks Library

REWRITTEN: this case previously encoded a P1 bug where clicking any card
landed on an unrelated, fixed framework's details page. Confirmed live
(2026-08-03, build a146218221) this is now fixed — clicking the 'Alaska
PIPA' card navigates to Alaska PIPA's own details page and shows its own
metadata (not any other framework's).
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Frameworks Library")
class TestFWL013:

    @pytest.mark.regression
    @allure.title("FWL_013: Clicking a card navigates to that framework's own details page")
    def test_card_click_navigation_bug(self, frameworks_library_page):
        (frameworks_library_page
            .click_card("Alaska PIPA")
            .assert_details_page_shows_framework("Alaska PIPA"))
