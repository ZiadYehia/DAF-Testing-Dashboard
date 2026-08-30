"""
FWL_012 — Validate that toggling the sort-direction control reverses the
order of framework cards.
Feature: Frameworks Library

Confirmed live (2026-08-03, build a146218221): the Sort Direction control
carries an extra state beyond plain ascending/descending. Right after
selecting a sort key the control still reads the neutral 'Sort Direction'
label (not yet 'Ascending'), even though the grid is already rendered
ascending. A SINGLE click — this case's literal step — only advances the
control's own label to the explicit 'Ascending' state; the grid does not
visibly reorder, since it was already ascending. A SECOND click is needed to
reach 'Descending' and see the grid actually reverse (reproduced twice
live). This test asserts the case's literal one-click expectation (the
control's state changes AND the grid reverses) and so fails honestly on the
reorder assertion today — known quirk, not yet filed as a ticket.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Frameworks Library")
class TestFWL012:

    @pytest.mark.regression
    @allure.title("FWL_012: Toggling the sort-direction control reverses the order of framework cards")
    def test_sort_direction_toggle_reverses_order(self, frameworks_library_page):
        (frameworks_library_page
            .sort_by("Name")
            .capture_card_order()
            .toggle_sort_direction()
            .assert_sort_direction_toggle_changed_state()
            .assert_card_order_reversed_from_captured())
