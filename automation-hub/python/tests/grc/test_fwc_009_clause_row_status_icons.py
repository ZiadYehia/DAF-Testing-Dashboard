"""
FWC_009 — Validate that clause rows display the correct colored status
indicator icons (Implemented: filled circle with checkmark; Partial/Gap:
outline warning triangle with amber/red color).
Feature: Framework Clause Detail

Confirmed live (2026-08-03/04, build a146218221): only two icon states were
ever observed, both the identical warning-triangle SVG path — color is the
only differentiator (text-allendevaux-yellow-400 = Partial,
text-allendevaux-red-100 = Gap). No clause anywhere is "Implemented" (0 of
11 clauses, confirmed via the status filter returning zero results), so the
design mock's separate checkmark-circle icon has no live counterpart — this
spec asserts only the confirmed Partial/Gap half.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Clause Detail")
class TestFWC009:

    @pytest.mark.regression
    @allure.title("FWC_009: Clause rows show correct-colored status triangle icons for Partial and Gap")
    def test_clause_row_status_icons(self, framework_clause_detail_page):
        (framework_clause_detail_page
            .open("PB4ERG63zE")
            .expand_domain("DMY.1")
            .assert_clause_row_status_icon("DMY.1.1", "Partial")
            .assert_clause_row_status_icon("DMY.1.4", "Gap"))
