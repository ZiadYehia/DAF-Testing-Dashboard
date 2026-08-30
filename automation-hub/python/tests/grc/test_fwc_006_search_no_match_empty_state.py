"""
FWC_006 — Validate that typing a non-matching term in "Search Clauses"
results in an empty left-panel tree with no clauses displayed.
Feature: Framework Clause Detail

Corrected from the test case's original premise: the design was assumed to
show no explicit "no results" message, but live (2026-08-03/04, build
a146218221) DOES render an explicit shared empty state — icon +
"No results found!" heading + "We couldn't find any matches for your search.
Try adjusting your filters or search terms" body text (same shared widget
used by the Frameworks Library grid, with different body copy here). This
spec asserts that real, confirmed empty state.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Clause Detail")
class TestFWC006:

    @pytest.mark.regression
    @allure.title("FWC_006: Non-matching search term shows the 'No results found!' empty state")
    def test_search_no_match_empty_state(self, framework_clause_detail_page):
        (framework_clause_detail_page
            .open("PB4ERG63zE")
            .search_clauses("XYZ123NonMatch")
            .assert_no_results_found())
