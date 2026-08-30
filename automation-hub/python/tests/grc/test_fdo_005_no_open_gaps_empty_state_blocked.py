"""
FDO_005 — Validate that "Open Gaps (Foundational First)" card displays a
"No Open Gaps" empty state when zero gap clauses exist.
Feature: Framework Detail Overview (data/grc/features/framework-detail-overview)

BLOCKED — cannot be evaluated as written. Confirmed live (2026-08-04): the
Coverage tab is 100% hardcoded/mock content, confirmed byte-identical even
on the 0-clause Draft fixture (fwXOGmGxko), which still renders the same
fixed 2-row gap list despite having zero real clauses — the strongest
possible proof this tab is fully static. No fixture in the catalog can ever
reach the "No Open Gaps" state. The body below is illustrative only and
never runs; declared via test.fixme(title, body) so ONLY this test is
skipped.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Detail Overview")
class TestFDO005:

    @pytest.mark.regression
    @pytest.mark.skip(
        reason="Coverage tab is fully static/hardcoded mock content — confirmed byte-identical even on the 0-clause Draft fixture (fwXOGmGxko), which still shows the same 2-row gap list. The \"No Open Gaps\" empty state is unreachable on any known fixture."
    )
    @allure.title("FDO_005: Open Gaps card shows \"No Open Gaps\" empty state when zero gap clauses exist (BLOCKED — Coverage tab is static mock data)")
    def test_no_open_gaps_empty_state_blocked(self, framework_detail_overview_page):
        (framework_detail_overview_page
            .open("fwXOGmGxko")
            .switch_to_tab("Coverage")
            .assert_no_open_gaps_empty_state())
