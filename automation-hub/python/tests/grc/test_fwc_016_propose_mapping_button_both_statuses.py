"""
FWC_016 — Validate that the "+ Propose Mapping" button is present for both
Gap clauses and Implemented/Partial clauses, and it opens the
"Propose Mapping" modal.
Feature: Framework Clause Detail

Confirmed live (2026-08-03/04, build a146218221): + Propose Mapping renders
on BOTH a Partial clause (DMY.1.1) and a Gap clause (DMY.1.4) — the
button-presence half of this case holds. This spec asserts only that
confirmed half; it deliberately omits the modal-opens assertion, since
clicking the button is a confirmed no-op (no dialog/toast of any kind
appears, inherited from the same finding on the prior frameworks-library
pass) — asserting the modal here would fail for a reason this case isn't
meant to cover.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Clause Detail")
class TestFWC016:

    @pytest.mark.regression
    @allure.title("FWC_016: Propose Mapping button is present for both Partial and Gap clauses")
    def test_propose_mapping_button_both_statuses(self, framework_clause_detail_page):
        (framework_clause_detail_page
            .open("PB4ERG63zE")
            .expand_domain("DMY.1")
            .select_clause("DMY.1.1")
            .assert_propose_mapping_button_visible()
            .select_clause("DMY.1.4")
            .assert_propose_mapping_button_visible())
