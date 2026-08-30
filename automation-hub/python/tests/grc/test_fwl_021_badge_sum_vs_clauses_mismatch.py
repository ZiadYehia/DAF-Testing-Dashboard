"""
FWL_021 — Validate that the sum of a framework card's three control-count
badges equals the numerator of "In-scope clauses" on its Framework Details
page, not the total "Clauses" count.

Confirmed live (2026-08-03, build a146218221) on AICPA PMF: card badges are
"0 implemented" / "11 Partially implemented" / "0 Gaps" (sum = 11); the
details page shows "Clauses 12" and "In-scope clauses 11 / 12" — the badge
sum (11) matches the in-scope numerator (11), not the total (12). The single
clause that's out of the 12 total isn't in-scope, so the two figures are
deliberately different: total catalog clauses vs. in-scope-and-assessed
clauses.
Feature: Frameworks Library
"""
import allure
import pytest

AICPA_TITLE = "AICPA Privacy Management Framework (PMF) (2020)"


@allure.feature("Frameworks")
@allure.story("Frameworks Library")
class TestFWL021:

    @pytest.mark.regression
    @allure.title("FWL_021: Card badge-count sum reconciles with In-scope clauses numerator, not total Clauses")
    def test_badge_sum_vs_clauses_mismatch(self, frameworks_library_page):
        (frameworks_library_page
            .click_card(AICPA_TITLE)
            .assert_details_clauses_total("12")
            .assert_details_in_scope_clauses("11", "12")
            .assert_control_count_badges_sum_to_in_scope_clauses("0", "11", "0", "11"))
