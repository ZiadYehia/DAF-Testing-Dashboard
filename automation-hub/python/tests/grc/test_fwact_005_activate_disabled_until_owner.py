"""
FW_ACT_005 — Validate that the "Activate" button on Step 2 is already
ENABLED with zero "Framework Owners" checked — activation no longer requires
an owner.
Feature: Framework Activate Wizard

REWRITTEN 2026-08-04, build dca9938158 — product change: activation no
longer requires an owner (zero owners is valid; the 10-owner MAXIMUM still
applies — see FW_ACT_043). Confirmed live: Activate is already enabled on
Step 2 with nothing checked. Supersedes the original premise ("Activate
disabled until an owner is checked"), which is now false.

Deliberately does NOT click Activate — this spec only proves the gate is
gone, so it never mutates catalog data and needs no state restoration.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT005:

    @pytest.mark.regression
    @allure.title("FW_ACT_005: Activate is enabled on Step 2 with zero owners checked")
    def test_activate_enabled_with_zero_owners(self, framework_activate_wizard_page):
        (framework_activate_wizard_page
            .search("ISO 27001")
            .select_framework_card("ISO 27001 (2022)")
            .next()
            .assert_activate_enabled())
