"""
FDO_014 — Validate that "About Gap state", "About Implemented state",
and "About Partial state" tooltips appear and are dismissible.
Feature: Framework Detail Overview (data/grc/features/framework-detail-overview)

BLOCKED — cannot be evaluated as written. Confirmed live (2026-08-04): the
Coverage tab's three stat cards have only a native HTML title attribute
tooltip, not a clickable info icon — there is nothing to click and no
dialog ever opens here. The "About Gap/Implemented/Partial State" dialogs
that DO exist live only on the sibling Clauses and Mappings tab's status
badges (FrameworkClauseDetailPage.clickStatusBadge), a different tab
entirely. The body below is illustrative only and never runs; declared via
test.fixme(title, body) so ONLY this test is skipped.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Detail Overview")
class TestFDO014:

    @pytest.mark.regression
    @pytest.mark.skip(
        reason="The Coverage tab's three stat cards carry only a native HTML `title` attribute (e.g. title=\"Implemeneted\"), not a clickable info icon — no dialog exists to open or dismiss. The real \"About X State\" dialogs live only on the Clauses and Mappings tab's status badges."
    )
    @allure.title("FDO_014: \"About Gap/Implemented/Partial state\" tooltips appear and are dismissible (BLOCKED — no info icon exists on Coverage stat cards)")
    def test_coverage_info_tooltip_dismissible_blocked(self, framework_detail_overview_page):
        (framework_detail_overview_page
            .open("PB4ERG63zE")
            .switch_to_tab("Coverage")
            .click_coverage_stat_card_info_icon("Gaps")
            .assert_coverage_stat_card_about_dialog_visible("Gaps"))
