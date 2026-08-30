"""
FWC_013 — Validate that the "MAPPED SCF CONTROLS" section header count
accurately reflects the number of control cards displayed.
Feature: Framework Clause Detail

BLOCKED — cannot be evaluated as written. Confirmed live (2026-08-03/04,
build a146218221): the real heading is bare Mapped Controls — no "SCF", no
count suffix, in ANY clause state checked (including Gap and 0-control
clauses). There is also no clause anywhere (across all 11 clauses, 3
non-empty frameworks) with more than zero mapped controls, so a "2 mapped
controls -> header reads (2)" scenario has no live fixture to exercise
either. The body below is illustrative only and never runs.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Clause Detail")
class TestFWC013:

    @pytest.mark.regression
    @pytest.mark.skip(
        reason="The Mapped Controls header never shows a count suffix in any state, and no clause anywhere "
        "has more than zero mapped controls — there is no live fixture for a '2 controls -> (2)' scenario."
    )
    @allure.title("FWC_013: Mapped Controls header count matches rendered card count (BLOCKED — header never shows a count, and no clause has >0 mapped controls)")
    def test_mapped_controls_header_count_blocked(self, framework_clause_detail_page):
        (framework_clause_detail_page
            .open("PB4ERG63zE")
            .expand_domain("DMY.1")
            .select_clause("DMY.1.1")
            .assert_mapped_controls_header_count(2)
            .select_clause("DMY.1.4")
            .assert_mapped_controls_header_count(0))
