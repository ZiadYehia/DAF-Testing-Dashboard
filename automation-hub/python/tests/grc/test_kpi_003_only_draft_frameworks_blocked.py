"""
KPI_003 — Validate that KPI cards correctly reflect counts and average
readiness when only Draft frameworks exist in the library.
Feature: Framework Library KPI Summary

BLOCKED — precondition unreachable, same reasoning as KPI_002/KPI_004:
confirmed live (2026-08-03, build a146218221) the catalog holds 453
frameworks and no delete/archive/retire control exists anywhere in the UI —
the Framework Details page offers only "Export" and "Generate audit
package". There is no way to remove the 47 Active + ~400 Inactive records
to reach a Draft-only catalog.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Library KPI Summary")
class TestKPI003:

    @pytest.mark.regression
    @pytest.mark.skip(
        reason="No delete/archive/retire control exists anywhere in the UI to reach a Draft-only "
        "catalog — the 453-framework catalog cannot be reduced without deleting the Active/Inactive records."
    )
    @allure.title("KPI_003: KPI cards correctly reflect counts/average when only Draft frameworks exist (BLOCKED — no delete/archive control to reach a Draft-only catalog)")
    def test_only_draft_frameworks_blocked(self, frameworks_library_page):
        (frameworks_library_page
            .toggle_filter_option("All status", "Draft")
            .assert_kpi_values_match_visible_cards())
