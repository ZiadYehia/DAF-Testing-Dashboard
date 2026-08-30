"""
FWL_008 — Validate that the 'All Regions' filter narrows the grid to only
the selected region.
Feature: Frameworks Library

REWRITTEN: this case previously targeted a non-existent 'All Types' category
dropdown (and, in a later live pass, a since-removed 'All categories'
dropdown that threw a backend error on selection). The live toolbar has no
category filter at all — only 'All status' and 'All Regions'. Confirmed live
(2026-08-03, build a146218221): selecting 'APAC' in 'All Regions' narrows
the grid to only APAC-region cards, with no error surfaced.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Frameworks Library")
class TestFWL008:

    @pytest.mark.regression
    @allure.title("FWL_008: All Regions filter narrows the grid to only the selected region")
    def test_categories_filter_dropdown_renamed(self, frameworks_library_page):
        (frameworks_library_page
            .toggle_filter_option("All Regions", "APAC")
            .assert_all_visible_cards_have_region("APAC"))
