"""
FWL_005 — Validate that Inactive framework cards render the reduced card
shape, with region and date but no readiness or control counts.
Feature: Frameworks Library

Confirmed live (2026-08-03, build a146218221): searching 'Canada' and
filtering All status = Inactive narrows the grid to 'Canada CSAG', which
renders its Framework Name, an 'Inactive' badge, its 'AMERICAS' region, and
the '2000-02-22' creation date — the same reduced shape used for Draft
cards, except the region row IS present (only Draft cards omit it; see
FWL_004/FWL_025).
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Frameworks Library")
class TestFWL005:

    @pytest.mark.regression
    @allure.title("FWL_005: Inactive cards render the reduced shape with region and date but no readiness or control counts")
    def test_inactive_cards_reduced_shape(self, frameworks_library_page):
        (frameworks_library_page
            .search("Canada")
            .toggle_filter_option("All status", "Inactive")
            .assert_reduced_card_shape("Canada CSAG", "Inactive", "2000-02-22", "AMERICAS"))
