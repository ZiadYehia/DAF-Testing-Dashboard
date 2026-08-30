"""
KPI_004 — Validate that all KPI cards display zero values when no
frameworks exist in the library.
Feature: Framework Library KPI Summary

BLOCKED — precondition unreachable: a genuinely EMPTY catalog (0 of the
live 453 records) requires a bulk-delete/reset control that does not exist
anywhere in the UI (confirmed live 2026-08-03, build a146218221). The
visually similar zero-match FILTERED view (see KPI_011, which uses a
guaranteed-zero-match search) is a DIFFERENT precondition — it narrows the
grid to zero visible results, it does not mean the catalog itself is empty.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Library KPI Summary")
class TestKPI004:

    @pytest.mark.regression
    @pytest.mark.skip(
        reason="No bulk-delete/reset control exists anywhere in the UI to empty the 453-framework catalog."
    )
    @allure.title("KPI_004: All KPI cards display zero values when no frameworks exist in the library (BLOCKED — no bulk-delete/reset control exists to empty the catalog)")
    def test_empty_catalog_blocked(self, frameworks_library_page):
        frameworks_library_page.assert_all_kpi_values_zeroed()
