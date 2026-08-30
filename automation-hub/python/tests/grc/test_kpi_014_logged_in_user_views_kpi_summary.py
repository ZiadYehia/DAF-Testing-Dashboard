"""
KPI_014 — A logged-in Compliance Manager can view the KPI summary row.
Feature: Framework Library KPI Summary

Deliberately decoupled from exact KPI values (see KPI_001 for those) so this
smoke-level test stays green independent of the confirmed KPI-freeze bug —
it only checks the library page loads and all 4 KPI cards (one <h6> each)
render. Rewritten to use `assert_kpi_row_visible()` instead of a raw
`expect(frameworks_library_page.page.locator("h6"))` call.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Library KPI Summary")
class TestKPI014:

    @pytest.mark.regression
    @allure.title("KPI_014: Logged-in user can view the KPI summary row")
    def test_logged_in_user_views_kpi_summary(self, frameworks_library_page):
        (frameworks_library_page
            .assert_on_library()
            .assert_kpi_row_visible())
