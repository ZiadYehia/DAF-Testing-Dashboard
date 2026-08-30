"""
FWC_023 — Validate that selecting a different clause in the left panel
immediately updates the right panel with the new clause's details without a
full page reload.
Feature: Framework Clause Detail

Confirmed live (2026-08-03/04, build a146218221) via repeated same-session
clicks: the right panel updates in place on clause selection, and the URL
never changes (still .../details/<id>?tab=Clauses+and+Mappings) across the
switch — no full reload occurs. Asserting the URL both before and after the
second clause selection is the "no reload / no URL change" proof.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Clause Detail")
class TestFWC023:

    @pytest.mark.regression
    @allure.title("FWC_023: Switching the selected clause updates the right panel with no URL change")
    def test_clause_switch_no_full_reload(self, framework_clause_detail_page):
        (framework_clause_detail_page
            .open("PB4ERG63zE")
            .expand_domain("DMY.1")
            .select_clause("DMY.1.1")
            .assert_clause_heading_visible("DMY.1.1")
            .assert_on_clauses_tab("PB4ERG63zE")
            .select_clause("DMY.1.2")
            .assert_clause_heading_visible("DMY.1.2")
            .assert_on_clauses_tab("PB4ERG63zE"))
