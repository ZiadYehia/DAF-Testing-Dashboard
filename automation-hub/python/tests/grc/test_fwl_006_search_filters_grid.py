"""
FWL_006 — Validate that typing into 'Search Frameworks' dynamically filters
the grid by framework name.
Feature: Frameworks Library

REWRITTEN: this case previously encoded a P1/P2 bug where search did not
filter the grid at all. Confirmed live (2026-08-03, build a146218221) search
now works correctly — typing 'Alaska' narrows the 453-framework catalog down
to the single 'Alaska PIPA' card.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Frameworks Library")
class TestFWL006:

    @pytest.mark.regression
    @allure.title("FWL_006: Search dynamically filters the grid by framework name")
    def test_search_filters_grid(self, frameworks_library_page):
        (frameworks_library_page
            .search("Alaska")
            .assert_card_visible("Alaska PIPA")
            .assert_card_count(1))
