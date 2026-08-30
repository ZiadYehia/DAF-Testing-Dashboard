"""
KPI_009 — KPI values must update to reflect the filtered result set when a
search term is applied.
Feature: Framework Library KPI Summary

KNOWN BUG, this test will honestly fail today. Confirmed live (2026-08-03,
build a146218221): typing "ISO" into "Search Frameworks" correctly narrows
the card grid, but the KPI row stays frozen at the unfiltered totals
(453/47/6/16.55%) instead of recomputing from the visible, filtered cards —
filed defect DT-3482 / FW_FR_KPI_SUMMARY_05. This test asserts the
REQUIRED/intended behaviour (tiles match the visible, filtered grid), so it
fails today and becomes a regression-catch once the bug is fixed.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Library KPI Summary")
class TestKPI009:

    @pytest.mark.regression
    @allure.title("KPI_009: KPI values recompute to reflect a search-filtered result set")
    def test_search_no_match_zeroes_kpis(self, frameworks_library_page):
        (frameworks_library_page
            .search("ISO")
            .assert_kpi_values_match_visible_cards())
