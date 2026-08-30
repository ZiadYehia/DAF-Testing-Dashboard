"""
FDO_006 — Validate that clicking the "Open" link for a gap clause
navigates to the specific clause's detail page.
Feature: Framework Detail Overview (data/grc/features/framework-detail-overview)

BLOCKED — cannot be evaluated as written. Confirmed live (2026-08-04): the
Coverage tab's "Open" elements are plain, non-semantic <div>s — no
href, no role, no click handler at all. Clicking one produces no
navigation, no URL change, no dialog. The body below is illustrative only
and never runs; declared via test.fixme(title, body) so ONLY this test is
skipped.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Detail Overview")
class TestFDO006:

    @pytest.mark.regression
    @pytest.mark.skip(
        reason="The Coverage tab's \"Open\" elements are plain, non-semantic <div>s with no href/role/handler — confirmed live that clicking one changes neither the URL nor triggers navigation. There is no destination to navigate to."
    )
    @allure.title("FDO_006: Clicking a gap's Open link navigates to the clause detail page (BLOCKED — Open element has no destination)")
    def test_open_link_clause_navigation_blocked(self, framework_detail_overview_page):
        (framework_detail_overview_page
            .open("PB4ERG63zE")
            .switch_to_tab("Coverage")
            .click_coverage_open_link(0)
            .assert_navigated_to_clause_detail("A.5.2"))
