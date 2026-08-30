"""
FWL_009 — Validate that an 'All Alerts' filter dropdown displays available
options and filters the grid correctly.
Feature: Frameworks Library

BLOCKED: no 'All Alerts' filter dropdown exists anywhere in the live
toolbar. Confirmed live (2026-08-03, build a146218221) the toolbar's only two
filters are 'All status' and 'All Regions' — there is no alerts concept on
this page at all, so this case cannot be exercised as written.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Frameworks Library")
class TestFWL009:

    @pytest.mark.regression
    @pytest.mark.skip(
        reason="No 'All Alerts' filter dropdown exists anywhere in the live toolbar — confirmed live "
        "(2026-08-03, build a146218221) the toolbar's only two filters are 'All status' and 'All Regions', "
        "so this case cannot be exercised as written."
    )
    @allure.title("FWL_009: All Alerts filter dropdown displays options and filters the grid (BLOCKED — no such filter)")
    def test_regions_filter_dropdown_renamed(self, frameworks_library_page):
        frameworks_library_page.assert_only_status_and_region_filters_present()
