"""
KPI_013 — Avg Readiness card display of its percentage value.
Feature: Framework Library KPI Summary

PREMISE CORRECTED (2026-08-03, build a146218221): the test case as
originally written asserts NO progress bar renders beneath the percentage.
Live inspection found the opposite — a real, visible fill div
(`<div style="width: 16.55%;">` nested in a rounded track div) DOES render,
satisfying FW_FR_KPI_SUMMARY_04's "displayed with a visual progress bar"
requirement. The page object's older `assert_no_avg_readiness_progress_bar`
method is kept only for its own docstring (its narrow "no
[role=progressbar]/<progress> element" check still technically passes,
without meaning no progress bar exists at all) — this test uses the
corrected, positive `assert_avg_readiness_progress_bar` so it accurately
reflects live behaviour.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Library KPI Summary")
class TestKPI013:

    @pytest.mark.regression
    @allure.title("KPI_013: Avg Readiness card renders its percentage with a progress bar")
    def test_avg_readiness_progress_bar(self, frameworks_library_page):
        frameworks_library_page.assert_avg_readiness_progress_bar()
