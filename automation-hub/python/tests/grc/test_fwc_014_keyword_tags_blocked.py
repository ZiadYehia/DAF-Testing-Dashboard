"""
FWC_014 — Validate that keyword tags associated with a clause are displayed
below the mapped controls section, regardless of clause status.
Feature: Framework Clause Detail

BLOCKED — cannot be evaluated as written. Confirmed live (2026-08-03/04,
build a146218221): no keyword tags were ever observed below Mapped Controls
on any of the 11 clauses checked (Partial or Gap), across all 3 non-empty
frameworks. No fixture with any tag data exists to confirm or deny this
feature's rendering. The body below is illustrative only and never runs.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Clause Detail")
class TestFWC014:

    @pytest.mark.regression
    @pytest.mark.skip(
        reason="No keyword tags were ever observed below Mapped Controls on any clause, Gap or Partial — no "
        "fixture with any tag data exists to confirm or deny this feature."
    )
    @allure.title("FWC_014: Keyword tags render below Mapped Controls regardless of clause status (BLOCKED — no clause with tag data exists on any fixture)")
    def test_keyword_tags_blocked(self, framework_clause_detail_page):
        (framework_clause_detail_page
            .open("PB4ERG63zE")
            .expand_domain("DMY.1")
            .select_clause("DMY.1.4")
            .assert_keyword_tags_visible(["Governance", "Policy"]))
