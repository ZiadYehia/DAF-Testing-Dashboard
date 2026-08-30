"""
KPI_006 — Validate that KPI values automatically update when a Draft
framework is activated.
Feature: Framework Library KPI Summary

BLOCKED — precondition unreachable. Confirmed live (2026-08-03, build
a146218221): neither of the two possible activation paths exists for an
already-catalogued Draft. (a) DRAFT_TITLE's Framework Details page (one of
the 6 live Drafts) offers only "Export"/"Generate audit package", no
status-change control of any kind. (b) The Activate Framework wizard's Step
1 grid actively EXCLUDES already-catalogued Drafts — searching it for
"Test Framework Draft" returns "No results found!"; its selectable list
only contains frameworks not yet in the catalog. There is no UI path —
wizard or detail page — that flips an existing Draft to Active.
"""
import allure
import pytest

DRAFT_TITLE = "Test Framework Draft aIjJnV"


@allure.feature("Frameworks")
@allure.story("Framework Library KPI Summary")
class TestKPI006:

    @pytest.mark.regression
    @pytest.mark.skip(
        reason="No reachable Draft-to-Active control exists — the Framework Details page has no "
        "status-change control, and the Activate wizard's Step 1 excludes already-catalogued Drafts."
    )
    @allure.title("KPI_006: KPI values automatically update when a Draft framework is activated (BLOCKED — no reachable Draft-to-Active control exists)")
    def test_draft_to_active_activation_blocked(self, frameworks_library_page):
        (frameworks_library_page
            .assert_kpi_values("453", "47", "6", "16.55%")
            .click_card(DRAFT_TITLE)
            .assert_details_page_shows_framework(DRAFT_TITLE))
