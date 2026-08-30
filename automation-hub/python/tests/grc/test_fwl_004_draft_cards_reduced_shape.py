"""
FWL_004 — Validate that Draft framework cards render the reduced card
shape, with no region, readiness, or control counts.
Feature: Frameworks Library

Confirmed live (2026-08-03, build a146218221): filtering All status = Draft
renders exactly the 6 'Test Framework Draft <suffix>' records (aIjJnV,
dUBoXw, flltBA, nsEvG3, RHEZYt, TZnioX) — the only Draft fixtures in the
catalog — each showing only the Framework Name, a 'Draft' badge, and the
creation date; no region row, no 'Audit Readiness', and no control-count
badges render for any of them.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Frameworks Library")
class TestFWL004:

    @pytest.mark.regression
    @allure.title("FWL_004: Draft cards render the reduced shape with no region, readiness, or control counts")
    def test_draft_cards_reduced_shape(self, frameworks_library_page):
        (frameworks_library_page
            .toggle_filter_option("All status", "Draft")
            .assert_card_count(6)
            .assert_reduced_card_shape("Test Framework Draft aIjJnV", "Draft", "2000-02-22")
            .assert_reduced_card_shape("Test Framework Draft dUBoXw", "Draft", "2000-02-22")
            .assert_reduced_card_shape("Test Framework Draft flltBA", "Draft", "2000-02-22")
            .assert_reduced_card_shape("Test Framework Draft nsEvG3", "Draft", "2000-02-22")
            .assert_reduced_card_shape("Test Framework Draft RHEZYt", "Draft", "2000-02-22")
            .assert_reduced_card_shape("Test Framework Draft TZnioX", "Draft", "2000-02-22"))
