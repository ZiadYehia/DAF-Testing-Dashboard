"""
FWL_019 — Validate that "All status" and "All Regions" filter dropdowns ARE
present in the toolbar, and that "All Categories" is NOT.

This test case's premise flipped since the 2026-07-21 pass that originally
created this project (which asserted all three dropdowns were absent, per a
build where the toolbar had been relabelled "All Systems"/"All Types"/"All
Alerts"). Confirmed live (2026-08-03, build a146218221): the toolbar shows
"All status" and "All Regions" again — only "All Categories" is genuinely
gone. Rewritten to match the current test case text rather than keep
asserting the old, now-inverted premise.
Feature: Frameworks Library
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Frameworks Library")
class TestFWL019:

    @pytest.mark.regression
    @allure.title("FWL_019: All status and All Regions dropdowns are present; All Categories is not")
    def test_status_filters_stale_absence_premise(self, frameworks_library_page):
        frameworks_library_page.assert_only_status_and_region_filters_present()
