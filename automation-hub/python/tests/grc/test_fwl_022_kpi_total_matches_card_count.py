"""
FWL_022 — Validate that no framework name is rendered by more than one card
in the default (unfiltered, unsorted) grid.

Confirmed live (2026-08-03, build a146218221): exactly 50 cards render per
page, and extracting all 50 names found zero duplicates.
Feature: Frameworks Library
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Frameworks Library")
class TestFWL022:

    @pytest.mark.regression
    @allure.title("FWL_022: No framework name is rendered by more than one card")
    def test_kpi_total_matches_card_count(self, frameworks_library_page):
        (frameworks_library_page
            .assert_card_count(50)
            .assert_no_duplicate_card_names())
