"""
FWC_020 — Validate that for a framework with no domain/clause data, the left
panel displays a "No domains" message and the right panel shows the default
empty-selection message.
Feature: Framework Clause Detail

Confirmed verbatim live (2026-08-03/04, build a146218221) on the Draft
fixture fwXOGmGxko ("Test Framework Draft aIjJnV", Clauses 0): left panel
shows a centered icon + "No domains" heading + "No domains available for
this framework" body text; right panel shows the default "Select a clause to
view its details" message — exactly as specified.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Clause Detail")
class TestFWC020:

    @pytest.mark.regression
    @allure.title("FWC_020: Empty framework shows 'No domains' left panel and default right-panel message")
    def test_empty_framework_no_domains_state(self, framework_clause_detail_page):
        (framework_clause_detail_page
            .open("fwXOGmGxko")
            .assert_no_domains_empty_state())
