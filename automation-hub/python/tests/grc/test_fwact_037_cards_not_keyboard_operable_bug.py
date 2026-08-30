"""
FW_ACT_037 — Validate that Step 1 framework cards expose a radio/radiogroup
role and are keyboard focusable and operable.
Feature: Framework Activate Wizard

KNOWN BUG (a11y) — fails honestly today. `assert_cards_keyboard_operable()`
asserts the REQUIRED accessible behaviour (a radio/radiogroup role, or
equivalently focusable cards, and the first card reachable and activatable
by keyboard) rather than the defect itself. Confirmed live 2026-07-29: cards
are plain `<div>`s with no role and no tabindex; keyboard-only users cannot
select a framework. Its counterpart `assert_cards_not_keyboard_operable()`
(which documents the current broken state as a pass) remains available for
tests that need that framing instead.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT037:

    @pytest.mark.regression
    @allure.title("FW_ACT_037: Step 1 cards are not keyboard operable (documents the a11y defect)")
    def test_cards_not_keyboard_operable(self, framework_activate_wizard_page):
        framework_activate_wizard_page.assert_cards_keyboard_operable()
