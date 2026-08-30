"""
KPI_017 — KPI cards are view-only and offer no interactive elements.
Feature: Framework Library KPI Summary

Upgraded to `assert_all_kpi_tiles_view_only()`, which checks all 4 tiles
(not just 'Total Frameworks') for `cursor: auto`, no `role` attribute,
`tabIndex == -1`, no `<a>`/`<button>` descendant, and that clicking each one
leaves the URL unchanged. Confirmed live (2026-08-03, build a146218221) via
a real click on all four tiles: the URL never changed, cursor stayed `auto`
before/after hover, and none had an onclick/tabIndex/role.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Library KPI Summary")
class TestKPI017:

    @pytest.mark.regression
    @allure.title("KPI_017: All 4 KPI cards have no click interaction")
    def test_kpi_cards_view_only(self, frameworks_library_page):
        frameworks_library_page.assert_all_kpi_tiles_view_only()
