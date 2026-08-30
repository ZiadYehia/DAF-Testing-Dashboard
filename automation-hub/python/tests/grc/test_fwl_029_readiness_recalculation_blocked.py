"""
FWL_029 — Validate that a framework card's Audit Readiness percentage
recalculates when an underlying control assessment changes.
Feature: Frameworks Library

BLOCKED / not performable as originally specified: confirmed live
(2026-08-03, build a146218221) by exhausting every actionable element on
AICPA PMF's Framework Details page across all four tabs — "Applicability and
Scoping" and "Audit Package" are empty; "Clauses and Mappings" only opens a
READ-ONLY explainer dialog on a clause-status badge and its one button
("Propose Mapping") produces no visible effect at all (no dialog, no toast,
no error); "Coverage" is read-only stats/heatmap with no clickable rows. No
reachable control-assessment action exists anywhere on the Library or the
Framework Details page — whatever assigns control effectiveness scores lives
outside this surface entirely (presumably the separate Controls module, out
of scope for this feature). Step 2 of the test case ("update a control
assessment result affecting readiness") cannot be driven at all.
"""
import allure
import pytest

AICPA_TITLE = "AICPA Privacy Management Framework (PMF) (2020)"


@allure.feature("Frameworks")
@allure.story("Frameworks Library")
class TestFWL029:

    @pytest.mark.regression
    @pytest.mark.skip(
        reason="No reachable control-assessment action exists anywhere on the Library or Framework "
        "Details page — every actionable element was tried and none mutates or offers to mutate "
        "assessment data, so the readiness-recalculation step cannot be driven at all."
    )
    @allure.title("FWL_029: Framework card's Audit Readiness recalculates after a control assessment change (BLOCKED — no reachable assessment action exists)")
    def test_readiness_recalculation_blocked(self, frameworks_library_page):
        (frameworks_library_page
            .click_card(AICPA_TITLE)
            .assert_details_in_scope_clauses("11", "12"))
