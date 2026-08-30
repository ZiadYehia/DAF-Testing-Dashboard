"""
FWC_019 — Validate that the breadcrumb, page title, and Clauses and Mappings
tab data correctly reflect the selected framework, and do not show a
mismatch.
Feature: Framework Clause Detail

KNOWN BUG, this test will honestly FAIL today. Confirmed live (2026-08-03/04,
build a146218221): the headline defect of this whole feature — the tab
renders BYTE-IDENTICAL mock content for every framework. PB4ERG63zE
(ISO 21434) and OD3zPmaTGK (Alaska PIPA) show the exact same 3 domains
(DMY.1/DMY.2/DMY.3), the same 11 clause titles, and the same statuses — none
of it belongs to either framework specifically. This is the same class of
bug as the previously-documented DT-3167 hardcoded-title defect, but far more
severe here (every domain, clause, and status is identical, not just the
title). This spec opens two genuinely different frameworks and asserts a
domain seen on the first is ABSENT on the second — the behavior required for
the tab to actually reflect "the framework you opened" — so it fails while
the mock data is shared across every framework.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Clause Detail")
class TestFWC019:

    @pytest.mark.regression
    @allure.title("FWC_019: Clauses and Mappings data must differ between two different frameworks (currently identical — P1 bug)")
    def test_tab_data_identical_across_frameworks_bug(self, framework_clause_detail_page):
        (framework_clause_detail_page
            .open("PB4ERG63zE")
            .assert_on_clauses_tab("PB4ERG63zE")
            .assert_domain_visible("DMY.1"))

        (framework_clause_detail_page
            .open("OD3zPmaTGK")
            .assert_on_clauses_tab("OD3zPmaTGK")
            .assert_domain_absent("DMY.1"))
