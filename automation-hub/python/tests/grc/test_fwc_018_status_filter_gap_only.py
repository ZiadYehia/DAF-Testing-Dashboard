"""
FWC_018 — Validate that selecting "Gap" from the "All Status" filter
displays only "Gap" clauses in the tree.
Feature: Framework Clause Detail

Confirmed live (2026-08-04, build a146218221): filtering to Gap renders
exactly DMY.1.4 and DMY.2.4 (the only 2 Gap clauses across all 11), and
DMY.3 — which has zero Gap clauses — vanishes from the accordion entirely
rather than remaining as an empty domain header.

The domain/clause tree is a single-expand PrimeVue accordion (see the page
object's class docstring), so DMY.1.4 and DMY.2.4 can never be visible rows
at the same instant — only whichever one domain is currently expanded shows
its clauses. DMY.1 happens to already be expanded (the framework's cold-load
default), so its Gap clause is visible for free; DMY.2 must be expanded
explicitly (which collapses DMY.1 in turn) before its own Gap clause becomes
a visible row.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Clause Detail")
class TestFWC018:

    @pytest.mark.regression
    @allure.title("FWC_018: Gap status filter shows only Gap clauses and hides domains with none")
    def test_status_filter_gap_only(self, framework_clause_detail_page):
        (framework_clause_detail_page
            .open("PB4ERG63zE")
            .select_status_filter("Gap")
            .expand_domain("DMY.1")
            .assert_clause_row_visible("DMY.1.4")
            .expand_domain("DMY.2")
            .assert_clause_row_visible("DMY.2.4")
            .assert_domain_absent("DMY.3"))
