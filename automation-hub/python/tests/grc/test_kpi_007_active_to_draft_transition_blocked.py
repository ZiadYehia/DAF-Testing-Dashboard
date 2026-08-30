"""
KPI_007 — Validate that KPI values automatically update when an Active
framework is saved as Draft.
Feature: Framework Library KPI Summary

BLOCKED — precondition unreachable. Confirmed live (2026-08-03, build
a146218221) using the same evidence class as KPI_006: ACTIVE_TITLE's (an
Active framework's) Framework Details page has no status-change control of
any kind across any of its four tabs — only "Export" and "Generate audit
package". No "Save as Draft"/"Deactivate" action exists anywhere
post-catalog-entry.
"""
import allure
import pytest

ACTIVE_TITLE = "AICPA Privacy Management Framework (PMF) (2020)"


@allure.feature("Frameworks")
@allure.story("Framework Library KPI Summary")
class TestKPI007:

    @pytest.mark.regression
    @pytest.mark.skip(
        reason="No Active-to-Draft/Save-as-Draft control exists anywhere on the Framework Details page."
    )
    @allure.title("KPI_007: KPI values automatically update when an Active framework is saved as Draft (BLOCKED — no Active-to-Draft control exists)")
    def test_active_to_draft_transition_blocked(self, frameworks_library_page):
        (frameworks_library_page
            .assert_kpi_values("453", "47", "6", "16.55%")
            .click_card(ACTIVE_TITLE)
            .assert_details_page_shows_framework(ACTIVE_TITLE))
