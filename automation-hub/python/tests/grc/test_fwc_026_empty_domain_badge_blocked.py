"""
FWC_026 — Validate that a domain with zero clauses displays a "0" count
badge and correct chevron/expand behavior.
Feature: Framework Clause Detail

BLOCKED — doubly unbuildable. Confirmed live (2026-08-03/04, build
a146218221): (1) no domain header renders a clause-count badge at all (see
FWC_008 — the feature simply doesn't exist), and (2) no domain-level empty
fixture exists either — every domain observed across all 3 non-empty
frameworks has >=3 clauses; only a whole-framework-empty fixture
(fwXOGmGxko, used by FWC_020) was found, never a single empty domain within
an otherwise-populated framework. The body below is illustrative only, run
against the closest available domain, and never runs.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Clause Detail")
class TestFWC026:

    @pytest.mark.regression
    @pytest.mark.skip(
        reason="No domain header renders a clause-count badge at all, and no domain-level-empty fixture "
        "exists (only whole-framework-empty) — doubly unbuildable."
    )
    @allure.title("FWC_026: Zero-clause domain shows a '0' count badge (BLOCKED — no badge feature exists, and no 0-clause domain fixture exists)")
    def test_empty_domain_badge_blocked(self, framework_clause_detail_page):
        (framework_clause_detail_page
            .open("PB4ERG63zE")
            .assert_domain_visible("DMY.3")
            .assert_no_domain_count_badge("DMY.3"))
