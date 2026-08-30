"""
FWL_020 — Validate no 'Filters' panel trigger (button/icon/link) exists
anywhere on the Framework Library page. Confirmed live (2026-07-21) the
toolbar's per-column dropdowns ('All status' / 'All categories' / 'All
Regions') are the only filter affordance — there is no separate 'Filters'
panel button.
Feature: Frameworks Library
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Frameworks Library")
class TestFWL020:

    @pytest.mark.regression
    @allure.title("FWL_020: No Filters panel trigger exists")
    def test_no_filters_panel_trigger(self, frameworks_library_page):
        frameworks_library_page.assert_no_filters_panel_trigger()
