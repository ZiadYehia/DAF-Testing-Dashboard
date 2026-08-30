"""
FWC_005 — Validate that typing a matching term in "Search Clauses" filters
the left-panel tree to show only relevant domains and clauses.
Feature: Framework Clause Detail

Confirmed live (2026-08-04, build a146218221): searching "Incident"
matches only DMY.3.2 DUMMY 3.2 Incident Handling — the other two domains
(DMY.1, DMY.2) disappear from the tree entirely (not merely collapsed),
confirming the dynamic filter narrows both domains and their nested clauses.

The domain/clause tree is a single-expand PrimeVue accordion (see the page
object's class docstring): narrowing the filter to a domain that was NOT
already the open one leaves it rendered but COLLAPSED — there's no
auto-expand-on-filter-match behavior. DMY.3 isn't the framework's cold-load
default (DMY.1 auto-expands), so DMY.3.2 only becomes a visible row after
explicitly expanding DMY.3.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Clause Detail")
class TestFWC005:

    @pytest.mark.regression
    @allure.title("FWC_005: Search Clauses filters the tree to matching domains and clauses")
    def test_search_filters_matching_clauses(self, framework_clause_detail_page):
        (framework_clause_detail_page
            .open("PB4ERG63zE")
            .search_clauses("Incident")
            .assert_domain_visible("DMY.3")
            .assert_domain_absent("DMY.1")
            .expand_domain("DMY.3")
            .assert_clause_row_visible("DMY.3.2"))
