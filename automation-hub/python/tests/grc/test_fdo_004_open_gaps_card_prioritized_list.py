"""
FDO_004 — Validate that the "Open Gaps (Foundational First)" card
displays a prioritized list of gap clauses with correct format when gaps
exist.
Feature: Framework Detail Overview (data/grc/features/framework-detail-overview)

Confirmed live (2026-08-04): the Coverage tab is 100% hardcoded mock
content (identical on every framework, including the 0-clause Draft), so
this renders on any framework — PB4ERG63zE is used here. The card's
listed rows and the Gaps stat card's total of 20 match this test case's own
live-observed sample data ("A.5.2 Threat Intelligence", "A.8.16 Monitoring
Activities", 20 total gaps), which also lines up with the confirmed Domain
Coverage Heatmap's "A.5 Organizational Controls (2)" / "A.8 Technological
Controls (2)" rows (FDO_023) — each row carries a warning-triangle icon, a
clause code + title, and a right-aligned "Open" label, exactly as
assertOpenGapsRow checks.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Detail Overview")
class TestFDO004:

    @pytest.mark.regression
    @allure.title("FDO_004: Open Gaps (Foundational First) card lists prioritized gap clauses")
    def test_open_gaps_card_prioritized_list(self, framework_detail_overview_page):
        (framework_detail_overview_page
            .open("PB4ERG63zE")
            .switch_to_tab("Coverage")
            .assert_open_gaps_row("A.5.2", "Threat Intelligence")
            .assert_open_gaps_row("A.8.16", "Monitoring Activities")
            .assert_coverage_stat_card("Gaps", 20, 40))
