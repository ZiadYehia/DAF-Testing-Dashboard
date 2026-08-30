"""
FW_ACT_042 — Validate DOM/visibility scoping in both directions: Step 1's
card markup stays present in the DOM (hidden, not removed) once Step 2 is
displayed, and Step 2's "Assign Owner" markup stays present in the DOM
(hidden, not removed) while Step 1 is displayed.
Feature: Framework Activate Wizard

Confirmed live 2026-07-29: passes today, both directions. This spec exists
to protect every other spec in this suite from a presence/count false-pass —
Step 1's cards and Step 2's "Assign Owner" markup both remain mounted in the
DOM across both steps, just hidden via CSS, so any assertion here or
elsewhere against this wizard must stay visibility-scoped
(`to_be_visible`/`:visible`), never a bare presence or count check, or it
will silently pass on the wrong step.

Now covers both directions via assert_step1_cards_hidden_not_removed (Step
1's cards while on Step 2) and assert_step2_markup_hidden_not_removed (Step
2's markup while on Step 1) — the previous gap (only one direction
exercised) is closed.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT042:

    @pytest.mark.regression
    @allure.title("FW_ACT_042: Step 1 cards stay in the DOM (hidden) once Step 2 is shown")
    def test_step2_markup_hidden_not_removed(self, framework_activate_wizard_page):
        (framework_activate_wizard_page
            .assert_step2_markup_hidden_not_removed()
            .select_framework_card("APEC Privacy Framework (2015)")
            .next()
            .assert_step1_cards_hidden_not_removed())
