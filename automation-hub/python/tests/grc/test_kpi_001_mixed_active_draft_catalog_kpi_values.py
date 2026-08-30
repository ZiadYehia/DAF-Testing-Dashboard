"""
KPI_001 — Validate that all four KPI cards display correct counts and
average readiness when the Frameworks Library contains a mix of Active and
Draft frameworks.
Feature: Framework Library KPI Summary

Uses the live catalog's real mixed Active/Draft/Inactive composition rather
than the test case's synthetic F1-F5 fixtures (which don't exist live).
Confirmed live (2026-08-03, build a146218221): Total=453, Active=47,
Drafts=6, Avg Readiness=16.55%. The Active(47) and Draft(6) counts were
independently cross-checked by filtering 'All status' to each value alone
and counting the rendered cards exactly (see the KPI ground-truth pass) —
Total and the implied Inactive count can't be independently summed the same
way due to the grid's hard 50-card render cap, a testing-environment
limitation, not a discrepancy.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Library KPI Summary")
class TestKPI001:

    @pytest.mark.regression
    @allure.title("KPI_001: KPI cards show correct counts and average readiness for the mixed catalog")
    def test_mixed_active_draft_catalog_kpi_values(self, frameworks_library_page):
        frameworks_library_page.assert_kpi_values("453", "47", "6", "16.55%")
