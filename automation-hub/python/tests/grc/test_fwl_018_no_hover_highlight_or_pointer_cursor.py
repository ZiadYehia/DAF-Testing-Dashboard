"""
FWL_018 — Validate that hovering over a framework card displays a distinct
highlighted state (border/background/box-shadow change) and a pointer
cursor, indicating the card is interactive.
Feature: Frameworks Library

KNOWN BUG — fails honestly today. Confirmed live (2026-08-03, build
a146218221): the AICPA card's computed border/backgroundColor/boxShadow are
byte-identical before, during, and after :hover, and cursor stays "auto"
(not "pointer") despite the card being genuinely clickable (its title click
navigates to its own details page). There is no hover state at all. This
test asserts the REQUIRED behavior (a visible highlight and a pointer
cursor), so it fails while this gap is open.
"""
import allure
import pytest

AICPA_TITLE = "AICPA Privacy Management Framework (PMF) (2020)"


@allure.feature("Frameworks")
@allure.story("Frameworks Library")
class TestFWL018:

    @pytest.mark.regression
    @pytest.mark.xfail(reason="cards have no hover state and no pointer cursor despite being clickable", strict=False)
    @allure.title("FWL_018: Hovering a framework card shows a highlight and a pointer cursor")
    def test_no_hover_highlight_or_pointer_cursor(self, frameworks_library_page):
        (frameworks_library_page
            .assert_card_hover_highlights_card(AICPA_TITLE)
            .assert_card_cursor_is_pointer(AICPA_TITLE))
