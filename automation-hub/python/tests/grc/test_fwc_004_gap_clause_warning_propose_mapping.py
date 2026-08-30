"""
FWC_004 — Validate that selecting a "Gap" clause displays its details,
including the "Gap" status badge, "No controls mapped" warning, and
"+ Propose Mapping" button.
Feature: Framework Clause Detail

Confirmed live (2026-08-03/04, build a146218221) on DMY.1.4 DUMMY 1.4
Management Review (Gap): the warning box text matches the test case's copy
verbatim, including the em dash — "No controls mapped — this clause is a
Gap." — and + Propose Mapping renders directly below it. The section header
itself is corrected from the test case's expected "MAPPED SCF CONTROLS (0)"
to the real live text, which is bare Mapped Controls with no "SCF" and no
count suffix in any state.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Clause Detail")
class TestFWC004:

    @pytest.mark.regression
    @allure.title("FWC_004: Selecting a Gap clause shows Gap warning banner and Propose Mapping button")
    def test_gap_clause_warning_propose_mapping(self, framework_clause_detail_page):
        (framework_clause_detail_page
            .open("PB4ERG63zE")
            .expand_domain("DMY.1")
            .select_clause("DMY.1.4")
            .assert_mapped_controls_header_visible()
            .assert_gap_warning_visible()
            .assert_propose_mapping_button_visible())
