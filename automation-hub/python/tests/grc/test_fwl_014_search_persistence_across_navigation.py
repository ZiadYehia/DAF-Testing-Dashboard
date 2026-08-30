"""
FWL_014 — Validate that the search term, "All status" filter selection, and
"Sort by" selection all persist when navigating away from the Frameworks
Library (to a framework's details page) and back to it via the sidebar.
Feature: Frameworks Library

KNOWN BUG — fails honestly today. Confirmed live (2026-08-03, build
a146218221) via both a hard URL navigation and this exact in-app SPA route
change (search "Canada" / filter "Inactive" / sort "Creation date", click the
"Canada CSAG" card, return via the sidebar "Frameworks" link): NONE of the
three survive — the search box empties, "All status" reverts to no
selection, and "Sort by" reverts to its unselected placeholder. There is no
session/local-storage/query-string persistence mechanism at all. This test
asserts the REQUIRED behavior (all three persist), so it fails while that gap
is open.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Frameworks Library")
class TestFWL014:

    @pytest.mark.regression
    @pytest.mark.xfail(reason="search/filter/sort do not persist across navigate-away-and-back", strict=False)
    @allure.title("FWL_014: Search term, status filter, and sort selection persist across navigating away and back")
    def test_search_persistence_across_navigation(self, frameworks_library_page):
        (frameworks_library_page
            .search("Canada")
            .toggle_filter_option("All status", "Inactive")
            .sort_by("Creation date")
            .click_card("Canada CSAG")
            .return_to_library_via_sidebar()
            .assert_search_value("Canada")
            .assert_filter_options_checked("All status", ["Inactive"])
            .assert_sort_by_value("Creation date"))
