"""
FWL_007 — Validate that the 'All status' filter narrows the grid to only the
selected status.
Feature: Frameworks Library

REWRITTEN: this case previously targeted a non-existent 'All Systems'
dropdown. The live toolbar's only status filter is 'All status'. Confirmed
live (2026-08-03, build a146218221): selecting 'Active' narrows the
453-framework catalog to its 47 Active records, with no Inactive or Draft
card among them.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Frameworks Library")
class TestFWL007:

    @pytest.mark.regression
    @allure.title("FWL_007: All status filter narrows the grid to only the selected status")
    def test_status_filter_dropdown_renamed(self, frameworks_library_page):
        (frameworks_library_page
            .toggle_filter_option("All status", "Active")
            .assert_all_visible_cards_have_status("Active")
            .assert_card_count(47))
