"""
KPI_018 — Validate that the sub-labels "In Catalog", "Contributing to
Coverage", and "Pending Activation" remain static and do not change when
filters are applied.
Feature: Framework Library KPI Summary

Confirmed live (2026-08-03, build a146218221): the sublabels are fixed tile
scaffolding (rendered sentence-case as "In catalog"/"Contributing to
coverage"/"Pending activation") independent of the underlying
KPI-value-freeze bug (DT-3482 / FW_FR_KPI_SUMMARY_05) — that bug affects
the NUMBERS the tiles show, not the labels around them. Setting the 'All
status' filter to 'Active' (which does visibly narrow the grid) and
re-checking the sublabels confirms they render unchanged, so this passes.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Library KPI Summary")
class TestKPI018:

    @pytest.mark.regression
    @allure.title("KPI_018: KPI sublabels remain static after a Status filter is applied")
    def test_sublabels_static_across_filter(self, frameworks_library_page):
        (frameworks_library_page
            .toggle_filter_option("All status", "Active")
            .assert_kpi_labels_and_sublabels())
