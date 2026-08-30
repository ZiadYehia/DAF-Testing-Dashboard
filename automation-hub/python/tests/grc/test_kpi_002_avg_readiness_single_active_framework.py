"""
KPI_002 — All KPI cards correctly reflect counts/average when only Active
frameworks exist in the library.
Feature: Framework Library KPI Summary

BLOCKED — precondition unreachable. Confirmed live (2026-08-03, build
a146218221): the catalog holds 453 frameworks across Active/Inactive/Draft
statuses and no delete/archive/retire control exists anywhere in the UI —
the Framework Details page offers only "Export" and "Generate audit
package". There is no way to reduce the catalog to Active-only without
deleting the other ~406 records, which this suite must not do.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Library KPI Summary")
class TestKPI002:

    @pytest.mark.regression
    @pytest.mark.skip(
        reason="No delete/archive/retire control exists anywhere in the UI to reach an Active-only "
        "catalog — the 453-framework catalog cannot be reduced without deleting ~406 other records."
    )
    @allure.title("KPI_002: All KPI cards correctly reflect counts/average when only Active frameworks exist (BLOCKED — no delete/archive control to reach an Active-only catalog)")
    def test_avg_readiness_single_active_framework(self, frameworks_library_page):
        (frameworks_library_page
            .toggle_filter_option("All status", "Active")
            .assert_kpi_values_match_visible_cards())
