"""
FWL_026 — Validate that every card rendered in the grid carries an
"Inactive" status badge when "All status" is filtered to "Inactive" — no
Active or Draft card is present among the results.
Feature: Frameworks Library
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Frameworks Library")
class TestFWL026:

    @pytest.mark.regression
    @allure.title("FWL_026: Filtering to Inactive status shows only Inactive-status cards")
    def test_inactive_filter_excludes_other_statuses(self, frameworks_library_page):
        (frameworks_library_page
            .toggle_filter_option("All status", "Inactive")
            .assert_all_visible_cards_have_status("Inactive"))
