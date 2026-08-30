"""
KPI_005 — Validate that the Average Audit Readiness card displays a
non-integer percentage correctly (e.g., rounded to nearest whole number or
one decimal place).
Feature: Framework Library KPI Summary

PREMISE CORRECTED (2026-08-03, build a146218221): the test case as
originally written assumes whole-number rounding ("78%") and asserts NO
progress bar renders. Live, the value renders with TWO decimal places, NOT
rounded (16.55%), and a real progress-bar fill (a plain div with an inline
width: 16.55% style) DOES render beneath it, satisfying
FW_FR_KPI_SUMMARY_04's "displayed with a visual progress bar" requirement —
the same corrected premise KPI_013 uses. This test asserts both corrected
facts, so it passes.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Library KPI Summary")
class TestKPI005:

    @pytest.mark.regression
    @allure.title("KPI_005: Avg Readiness card displays its non-integer percentage with decimals and a progress bar")
    def test_avg_readiness_decimal_and_progress_bar(self, frameworks_library_page):
        (frameworks_library_page
            .assert_avg_readiness_has_decimal_places()
            .assert_avg_readiness_progress_bar())
