"""
FWC_027 — Validate that a clause with two or more mapped controls of
differing effectiveness is displayed as "Implemented" when at least one
mapped control is Active with >=80% effectiveness, even if other mapped
controls are lower.
Feature: Framework Clause Detail

BLOCKED — cannot be evaluated as written. Confirmed live (2026-08-03/04,
build a146218221): no clause anywhere (11 clauses, 3 non-empty frameworks)
has more than zero mapped controls, and no clause anywhere is "Implemented"
(the status filter itself returns zero results for that value). A
multi-control aggregation scenario needs BOTH a clause with 2+ mapped
controls of differing effectiveness AND at least one qualifying >=80% Active
control — neither precondition has a live fixture, let alone both together.
The body below is illustrative only and never runs.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Clause Detail")
class TestFWC027:

    @pytest.mark.regression
    @pytest.mark.skip(
        reason="No clause anywhere has more than zero mapped controls, and no clause anywhere is "
        "'Implemented' — a multi-control aggregation scenario has no live fixture to exercise."
    )
    @allure.title("FWC_027: Multi-control clause with one qualifying control aggregates to Implemented (BLOCKED — no clause anywhere has any mapped control, let alone multiple)")
    def test_multi_control_aggregation_blocked(self, framework_clause_detail_page):
        (framework_clause_detail_page
            .open("PB4ERG63zE")
            .expand_domain("DMY.1")
            .select_clause("DMY.1.1")
            .assert_mapped_controls_count(2)
            .assert_mapped_control_card(
                "CTL-H",
                "Primary",
                "Applicable",
                "Access Control Policy Enforcement",
                "Michael",
                90,
                3,
            ))
