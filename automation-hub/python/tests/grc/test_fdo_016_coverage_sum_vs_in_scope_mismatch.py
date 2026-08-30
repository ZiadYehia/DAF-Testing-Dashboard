"""
FDO_016 — Validate that the sum of Implemented, Partial, and Gaps counts
on the Coverage tab is consistent with the "In-scope clauses" denominator
in Framework Metadata.
Feature: Framework Detail Overview (data/grc/features/framework-detail-overview)

KNOWN BUG, this test will honestly FAIL today. Confirmed live (2026-08-04)
on every framework checked, including PB4ERG63zE (ISO 21434): the
Coverage tab is 100% hardcoded mock content (Implemeneted 5 + Partial 4 +
Gaps 20 = 29) and never reconciles with the metadata's real In-scope
clauses denominator (12, or 11 on other fixtures, or 0 on the Draft).
assertCoverageStatsSumMatchesInScopeDenominator is built exactly for this
check and fails honestly on every fixture in the catalog.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Detail Overview")
class TestFDO016:

    @pytest.mark.regression
    @allure.title("FDO_016: Coverage tab counts must sum to the In-scope clauses denominator")
    def test_coverage_sum_vs_in_scope_mismatch(self, framework_detail_overview_page):
        (framework_detail_overview_page
            .open("PB4ERG63zE")
            .switch_to_tab("Coverage")
            .assert_coverage_stats_sum_matches_in_scope_denominator())
