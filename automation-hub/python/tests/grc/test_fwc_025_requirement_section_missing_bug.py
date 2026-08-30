"""
FWC_025 — Validate that selecting a clause displays the OBJECTIVE,
REQUIREMENT, and EVIDENCE EXPECTATION sections in the right panel, each with
its labeled heading and paragraph content.
Feature: Framework Clause Detail

KNOWN BUG, this test will honestly FAIL today. FW_FR_CLAUSE_02 requires
three sections: Objective, Requirement, and Evidence Expectation. Confirmed
live (2026-08-03/04, build a146218221) by dumping every h1-h6 on the page for
multiple clauses across all 3 non-empty frameworks: only Objective and
Evidence Expectation ever render — there is no Requirement heading anywhere
in the DOM. This spec asserts all three REQUIRED sections, so it fails
honestly at the Requirement assertion (1 of 3 required sections is missing),
same convention as test_fwact_006_step1_heading_subtitle_bug.py.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Clause Detail")
class TestFWC025:

    @pytest.mark.regression
    @allure.title("FWC_025: Clause detail must show Objective, Requirement, and Evidence Expectation sections (Requirement is missing — bug)")
    def test_requirement_section_missing_bug(self, framework_clause_detail_page):
        (framework_clause_detail_page
            .open("PB4ERG63zE")
            .expand_domain("DMY.1")
            .select_clause("DMY.1.1")
            .assert_objective_section_has_content()
            .assert_requirement_section_visible()
            .assert_evidence_expectation_section_has_content())
