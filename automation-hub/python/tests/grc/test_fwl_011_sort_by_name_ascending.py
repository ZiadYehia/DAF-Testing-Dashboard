"""
FWL_011 — Validate that 'Sort by: Name' sorts framework cards alphabetically
ascending by Framework Name.
Feature: Frameworks Library

Confirmed live (2026-08-03, build a146218221): selecting 'Name' in 'Sort by'
orders the grid alphabetically ascending, starting 'AICPA Privacy Management
Framework (PMF) (2020)', 'Alaska PIPA', 'APEC Privacy Framework (2015)', …
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Frameworks Library")
class TestFWL011:

    @pytest.mark.regression
    @allure.title("FWL_011: Sort by Name orders framework cards alphabetically ascending")
    def test_sort_by_name_ascending(self, frameworks_library_page):
        (frameworks_library_page
            .sort_by("Name")
            .assert_sort_by_value("Name")
            .assert_cards_sorted_by_name("asc"))
