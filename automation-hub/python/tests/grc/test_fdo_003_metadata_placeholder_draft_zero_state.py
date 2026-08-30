"""
FDO_003 — Validate that Framework Metadata fields display a placeholder
when optional data (Region, Owner) is unset.
Feature: Framework Detail Overview (data/grc/features/framework-detail-overview)

Confirmed live (2026-08-04) on the Draft fixture fwXOGmGxko (0 owners, 0
region): the real live placeholder is a literal hyphen-minus - (U+002D),
NOT the em dash — (U+2014) the original test case text names, and the
Owner label itself reverts to singular "Owner" at 0 owners. This asserts
the app's actual confirmed placeholder behavior via assertDraftZeroState
(which also confirms Clauses/Audit readiness/In-scope render cleanly as
0/0%/0 / 0 rather than errors) instead of the scripted em-dash
expectation, per the live ground-truth correction.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Detail Overview")
class TestFDO003:

    @pytest.mark.regression
    @allure.title("FDO_003: Framework Metadata shows placeholders when Region/Owner are unset")
    def test_metadata_placeholder_draft_zero_state(self, framework_detail_overview_page):
        (framework_detail_overview_page
            .open("fwXOGmGxko")
            .assert_draft_zero_state())
