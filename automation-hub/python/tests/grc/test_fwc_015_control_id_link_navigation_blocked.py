"""
FWC_015 — Validate that clicking a "Control ID" link within a mapped control
card navigates the user to the Controls module for that specific control.
Feature: Framework Clause Detail

BLOCKED — cannot be evaluated as written. Confirmed live (2026-08-03/04,
build a146218221): no clause anywhere (11 clauses, 3 non-empty frameworks)
has a mapped control, so there is no Control ID link element to click in the
first place. The body below is illustrative only and never runs.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Clause Detail")
class TestFWC015:

    @pytest.mark.regression
    @pytest.mark.skip(
        reason="No clause anywhere has a mapped control, so no Control ID link element exists to click."
    )
    @allure.title("FWC_015: Clicking a Control ID link navigates to the Controls module detail page (BLOCKED — no mapped control/Control ID link exists on any live fixture)")
    def test_control_id_link_navigation_blocked(self, framework_clause_detail_page):
        (framework_clause_detail_page
            .open("PB4ERG63zE")
            .expand_domain("DMY.1")
            .select_clause("DMY.1.1")
            .click_control_id_link("CTL-001")
            .assert_navigated_to_control_detail("CTL-001"))
