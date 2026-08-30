"""
FWC_003 — Validate that selecting a "Partial" clause displays its details,
including the "Partial" status badge and mapped control(s) with <80%
effectiveness or non-Active status.
Feature: Framework Clause Detail

BLOCKED — cannot be evaluated as written. Confirmed live (2026-08-03/04,
build a146218221): every one of the 9 "Partial" clauses across all 3
non-empty frameworks renders zero mapped-control cards — the Mapped Controls
section shows only the heading and the + Propose Mapping button, with no
card, no count, nothing. There is no fixture anywhere with a Partial clause
that actually has a mapped control to inspect (this is itself a
data-integrity defect distinct from this missing-fixture problem — see
FWC_011, which asserts that business-rule violation directly). The body
below is illustrative only and never runs.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Clause Detail")
class TestFWC003:

    @pytest.mark.regression
    @pytest.mark.skip(
        reason="Every Partial clause (9 of 11, across all 3 non-empty frameworks) renders zero mapped-control "
        "cards — no fixture anywhere has a Partial clause with an actual mapped control to inspect."
    )
    @allure.title("FWC_003: Selecting a Partial clause shows Partial badge + mapped control <80% effectiveness (BLOCKED — no Partial clause anywhere has a mapped control)")
    def test_partial_mapped_control_blocked(self, framework_clause_detail_page):
        (framework_clause_detail_page
            .open("PB4ERG63zE")
            .expand_domain("DMY.1")
            .select_clause("DMY.1.1")
            .assert_mapped_control_card(
                "CTL-002",
                "Primary",
                "Applicable",
                "Policies for Information Security",
                "Michael",
                65,
                2,
            ))
