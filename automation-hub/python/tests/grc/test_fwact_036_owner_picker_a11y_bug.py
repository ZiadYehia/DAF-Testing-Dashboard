"""
FW_ACT_036 — Validate that Framework Owners options expose valid accessible
names and the overlay's ARIA role structure is valid.
Feature: Framework Activate Wizard

KNOWN BUG (a11y) — fails honestly today. Confirmed live 2026-07-29: every
owner option's accessible name resolves to the literal string
"[object Object]" (visible text renders fine), and the overlay nests a
`listbox` role inside a `searchbox` role — an invalid ARIA structure.
Screen-reader users cannot distinguish owners by accessible name. This test
asserts both REQUIRED behaviours, so it fails while the defects are open.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT036:

    @pytest.mark.regression
    @allure.title("FW_ACT_036: Owner options have valid accessible names and ARIA structure")
    def test_owner_picker_a11y(self, framework_activate_wizard_page):
        (framework_activate_wizard_page
            .select_framework_card("APEC Privacy Framework (2015)")
            .next()
            .open_owner_picker()
            .assert_owner_options_have_accessible_names()
            .assert_owner_picker_aria_structure_valid())
