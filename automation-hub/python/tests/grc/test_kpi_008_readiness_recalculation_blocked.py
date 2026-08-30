"""
KPI_008 — Validate that Average Audit Readiness automatically updates when
an Active framework's readiness score changes.
Feature: Framework Library KPI Summary

BLOCKED — reconfirms the sibling frameworks-library ground truth (FWL_029,
fwl-029-readiness-recalculation-blocked): every tab on ACTIVE_TITLE's
Framework Details page was exhausted (2026-08-03, build a146218221) —
"Applicability and Scoping" and "Audit Package" are empty; "Clauses and
Mappings"' one button ("Propose Mapping") produces no visible effect at
all; "Coverage" is read-only stats/heatmap with no clickable rows. No
reachable control-assessment action exists anywhere on the Library or the
Framework Details page that would move a readiness percentage.
"""
import allure
import pytest

ACTIVE_TITLE = "AICPA Privacy Management Framework (PMF) (2020)"


@allure.feature("Frameworks")
@allure.story("Framework Library KPI Summary")
class TestKPI008:

    @pytest.mark.regression
    @pytest.mark.skip(
        reason="No reachable control-assessment action exists anywhere on the Library or Framework "
        "Details page — every actionable element was tried and none mutates or offers to mutate "
        "assessment data, so the readiness-recalculation step cannot be driven at all."
    )
    @allure.title("KPI_008: Average Audit Readiness recalculates when an Active framework's readiness score changes (BLOCKED — no reachable control-assessment action exists)")
    def test_readiness_recalculation_blocked(self, frameworks_library_page):
        (frameworks_library_page
            .assert_kpi_values("453", "47", "6", "16.55%")
            .click_card(ACTIVE_TITLE)
            .assert_details_in_scope_clauses("11", "12"))
