"""
FWL_028 — Validate that "Sort by: Creation date", "Audit readiness", and
"Updated at" each correctly reorder framework cards, ascending and
descending.
Feature: Frameworks Library

"Audit readiness" is only meaningful once the grid is filtered to
Active-only (non-Active cards render no readiness line at all), so the
"All status: Active" filter is applied before that block — matching how
this sort key was verified live. "Updated at" has no visible per-card field
to re-derive an absolute order from, so that block instead captures the
ascending order and asserts the toggle produces its exact reverse, which is
the documented purpose of capture_card_order/
assert_card_order_reversed_from_captured. An extra toggle_sort_direction()
after each of the first two blocks' descending check restores the ascending
baseline before moving to the next sort key, so each block's "ascending"
assertion doesn't depend on what direction a prior key left the toggle in.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Frameworks Library")
class TestFWL028:

    @pytest.mark.regression
    @allure.title("FWL_028: Sort by Creation date, Audit readiness, and Updated at each reorder the grid ascending and descending")
    def test_sort_by_date_readiness_updated_at(self, frameworks_library_page):
        (frameworks_library_page
            .sort_by("Creation date")
            .assert_cards_sorted_by_date("asc")
            .toggle_sort_direction()
            .assert_sort_direction_toggle_changed_state()
            .assert_cards_sorted_by_date("desc")
            .toggle_sort_direction()
            .toggle_filter_option("All status", "Active")
            .sort_by("Audit readiness")
            .assert_cards_sorted_by_readiness("asc")
            .toggle_sort_direction()
            .assert_cards_sorted_by_readiness("desc")
            .toggle_sort_direction()
            .sort_by("Updated at")
            .capture_card_order()
            .toggle_sort_direction()
            .assert_card_order_reversed_from_captured())
