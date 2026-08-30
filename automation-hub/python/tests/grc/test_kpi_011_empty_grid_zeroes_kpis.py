"""
KPI_011 — All KPI cards must read zero when applied filters/search result in
no matching frameworks.
Feature: Framework Library KPI Summary

The test case's own precondition ("Category = Finance" filter with no
matches) is unreachable — confirmed live (2026-08-03, build a146218221)
there is no "All Categories" filter in this build at all (removed, not
renamed). A guaranteed-zero-match search substitutes for it, matching the
substitution used in the KPI ground-truth pass. This also verifies the
grid's own empty-state message renders (proving the search itself narrowed
the grid) before checking the KPI row.

KNOWN BUG, this test will honestly fail today: confirmed live the KPI row
stays frozen at 453/47/6/16.55% even though the grid correctly empties to
"No results found!", so this fails against the REQUIRED/intended zeroed
expectation — filed defect DT-3482 / FW_FR_KPI_SUMMARY_05.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Library KPI Summary")
class TestKPI011:

    @pytest.mark.regression
    @allure.title("KPI_011: All KPI cards read zero when a filter/search matches nothing")
    def test_empty_grid_zeroes_kpis(self, frameworks_library_page):
        (frameworks_library_page
            .search("zzznomatch999xyz")
            .assert_empty_state_message()
            .assert_all_kpi_values_zeroed())
