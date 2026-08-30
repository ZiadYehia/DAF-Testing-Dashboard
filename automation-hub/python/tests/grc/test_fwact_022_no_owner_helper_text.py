"""
FW_ACT_022 — Validate that the helper text "The owner is accountable for
clause scoping, control mappings, and audit readiness" is NOT present under
the "Framework Owners" field.
Feature: Framework Activate Wizard

Confirmed as specified live (2026-07-29): no such helper text renders under
the field.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT022:

    @pytest.mark.regression
    @allure.title("FW_ACT_022: no helper text under Framework Owners field")
    def test_no_owner_helper_text(self, framework_activate_wizard_page):
        (framework_activate_wizard_page
            .search("ISO 27001")
            .select_framework_card("ISO 27001 (2022)")
            .next()
            .assert_no_helper_text_under_owner())
