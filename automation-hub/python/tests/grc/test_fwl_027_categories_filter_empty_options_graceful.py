"""
FWL_027 — Validate that "All status" and "All Regions" retain their full,
static option lists even when the current search term matches zero
frameworks.

Confirmed live (2026-08-03, build a146218221): typing a non-matching search
renders the "No results found!" empty state, but both dropdowns still open
and list their complete, unreduced option sets — "All status":
Active/Inactive/Draft/Retired; "All Regions": APAC/US/EMEA/General/Americas
(verbatim casing, per the live listbox).
Feature: Frameworks Library
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Frameworks Library")
class TestFWL027:

    @pytest.mark.regression
    @allure.title("FWL_027: All status and All Regions retain full option lists when the search matches zero frameworks")
    def test_categories_filter_empty_options_graceful(self, frameworks_library_page):
        (frameworks_library_page
            .search("NonExistentFramework")
            .assert_empty_state_message()
            .assert_filter_option_list("All status", ["Active", "Inactive", "Draft", "Retired"])
            .assert_filter_option_list("All Regions", ["APAC", "US", "EMEA", "General", "Americas"]))
