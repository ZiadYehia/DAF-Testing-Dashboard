"""
KPI_010 — KPI values must update to reflect the filtered result set when a
'Status' filter is applied.
Feature: Framework Library KPI Summary

KNOWN BUG, this test will honestly fail today. Confirmed live (2026-08-03,
build a146218221): setting the 'All status' filter to 'Active' correctly
narrows the grid to exactly 47 cards, but the KPI row stays frozen at
453/47/6/16.55% instead of recomputing Total=47/Drafts=0 from the visible
set — same DT-3482 / FW_FR_KPI_SUMMARY_05 defect as KPI_009. This test
asserts the REQUIRED/intended behaviour (tiles match the visible, filtered
grid), so it fails today and becomes a regression-catch once the bug is
fixed.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Library KPI Summary")
class TestKPI010:

    @pytest.mark.regression
    @allure.title("KPI_010: KPI values recompute to reflect a Status-filtered result set")
    def test_status_filter_no_match_zeroes_kpis(self, frameworks_library_page):
        (frameworks_library_page
            .toggle_filter_option("All status", "Active")
            .assert_kpi_values_match_visible_cards())
