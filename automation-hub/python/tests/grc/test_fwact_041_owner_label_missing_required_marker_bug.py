"""
FW_ACT_041 — Validate that "Framework Owners" is genuinely optional: no
required-field marker on its label, and leaving it empty never blocks
Activate.
Feature: Framework Activate Wizard

REWRITTEN 2026-08-04, build dca9938158 — product change: activation no
longer requires an owner (see FW_ACT_005). The original premise ("Activate
is gated on selecting at least one owner, so the label should show a
required marker") is now false on both halves: there was never a marker, AND
the field is genuinely optional. This flips the case from a known bug to a
PASS.

assert_owner_label_is_plural()'s exact-text match on "Framework Owners" (no
trailing marker) doubles as the no-marker check.
assert_no_helper_text_under_owner() confirms no inline helper/error text
under the field. assert_activate_enabled() — reached with the owner picker
never opened — is the functional proof the field isn't required. Fixture:
Belgium Privacy Law (the original fixture, APEC Privacy Framework (2015), is
now reserved for other specs).

Deliberately never opens the owner picker or clicks Activate — no mutation,
no restoration needed.

NOTE: no page-object method exists to scan the full page for an absent
validation/error message (only assert_no_helper_text_under_owner, scoped to
a <small> node directly under the label, is available) — flagged as a
coverage gap in the task report.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT041:

    @pytest.mark.regression
    @allure.title("FW_ACT_041: Framework Owners has no required-field marker and blocks nothing when left empty")
    def test_owner_field_is_genuinely_optional(self, framework_activate_wizard_page):
        (framework_activate_wizard_page
            .select_framework_card("Belgium Privacy Law")
            .next()
            .assert_owner_label_is_plural()
            .assert_no_helper_text_under_owner()
            .assert_activate_enabled())
