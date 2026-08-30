"""
FWC_021 — Validate that the currently selected clause row in the left panel
has a distinct light-blue highlighted background.
Feature: Framework Clause Detail

Confirmed live (2026-08-03/04, build a146218221) via an outerHTML diff of
selected vs. unselected clause row buttons: the selected row carries
bg-allendevaux-sky-blue-50 PLUS a thicker border-l-2 left border, while the
background class only applies on :hover for unselected rows. Selecting a
different clause moves the highlight — it does not stay on (or duplicate
onto) the previously-selected row.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Clause Detail")
class TestFWC021:

    @pytest.mark.regression
    @allure.title("FWC_021: Selected clause row shows light-blue highlight, and it moves on reselection")
    def test_clause_selection_highlight_moves(self, framework_clause_detail_page):
        (framework_clause_detail_page
            .open("PB4ERG63zE")
            .expand_domain("DMY.1")
            .select_clause("DMY.1.1")
            .assert_only_clause_selected("DMY.1.1")
            .select_clause("DMY.1.2")
            .assert_only_clause_selected("DMY.1.2"))
