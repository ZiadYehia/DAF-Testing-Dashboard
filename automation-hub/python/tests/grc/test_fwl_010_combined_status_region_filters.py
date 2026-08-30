"""
FWL_010 — Validate that 'All status' and 'All Regions' filters combine to
narrow the grid to records matching both.
Feature: Frameworks Library

Confirmed live (2026-08-03, build a146218221): combining All status =
Active with All Regions = US narrows the 453-framework catalog down to the
single 'Alaska PIPA' card — the only record satisfying both criteria at
once.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Frameworks Library")
class TestFWL010:

    @pytest.mark.regression
    @allure.title("FWL_010: All status and All Regions filters combine to narrow the grid to matches of both")
    def test_combined_status_region_filters(self, frameworks_library_page):
        (frameworks_library_page
            .toggle_filter_option("All status", "Active")
            .toggle_filter_option("All Regions", "US")
            .assert_card_visible("Alaska PIPA")
            .assert_card_count(1))
