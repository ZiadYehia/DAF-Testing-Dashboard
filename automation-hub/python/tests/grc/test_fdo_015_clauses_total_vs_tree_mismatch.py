"""
FDO_015 — Validate that the "Clauses" count (total) is consistent with
"In-scope clauses" (X/Total) and the Clauses and Mappings tab's own clause
count.
Feature: Framework Detail Overview (data/grc/features/framework-detail-overview)

KNOWN BUG, this test will honestly FAIL today. Confirmed live (2026-08-04)
on PB4ERG63zE (ISO 21434): the Framework Metadata card reports Clauses:
12 and In-scope clauses: 11 / 12, but the Clauses and Mappings tab's
domain tree only ever renders 11 clause rows total (4+4+3) under any
filter — the 12th clause is never rendered anywhere in the UI. This test
spans this page and the clause tree conceptually, but per the one-page-per-
test rule it is expressed with ONLY this page object's own assertions:
assertClausesTotalValue is asserted against '11' (the tree's real,
independently-confirmed count) and assertInScopeClausesValue against
('11', '11') (the spec's requirement that the denominator equal the actual
in-scope total) — both fail honestly against the live '12' values, proving
the real discrepancy without importing a second page class.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Detail Overview")
class TestFDO015:

    @pytest.mark.regression
    @allure.title("FDO_015: Clauses total must be consistent with the rendered clause tree")
    def test_clauses_total_vs_tree_mismatch(self, framework_detail_overview_page):
        (framework_detail_overview_page
            .open("PB4ERG63zE")
            .assert_clauses_total_value("11")
            .assert_in_scope_clauses_value("11", "11"))
