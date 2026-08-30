"""
FWL_002 — Validate that the Frameworks Library page displays the correct
empty state when the applied search/filter matches no frameworks.
Feature: Frameworks Library

The case's precondition ("the framework catalog contains no record with
Status = Retired") is already true of the live 453-framework catalog —
'Retired' carries zero live records and there is no retire/archive action
anywhere in the UI to create one. Confirmed live (2026-08-03, build
a146218221): selecting 'Retired' in 'All status' empties the grid and
renders the exact 'No results found!' / "We couldn't find any matches for
your search. Try adjusting your search terms" empty state, with the KPI row
and toolbar still visible and functional (the dropdown reopens with no
error).
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Frameworks Library")
class TestFWL002:

    @pytest.mark.regression
    @allure.title("FWL_002: Empty state renders when the All status filter matches no frameworks")
    def test_empty_state_retired_filter(self, frameworks_library_page):
        (frameworks_library_page
            .toggle_filter_option("All status", "Retired")
            .assert_empty_state_message()
            .assert_kpi_row_visible()
            .assert_toolbar_controls_in_order())
