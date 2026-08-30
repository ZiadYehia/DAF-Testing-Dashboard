"""
FW_ACT_012 — Validate discarding an in-progress Step 2 selection.
Feature: Framework Activate Wizard

BLOCKED / not performable as originally specified: Step 2's footer contains
exactly two buttons, "Back" (left) and "Activate" (right) — there is no
"Cancel" button or equivalent discard control on Step 2 at all. "Click
Cancel directly on Step 2" cannot be driven because the control does not
exist to click. The only available discard path is "Back" (returns to
Step 1 with the selection intact — see FW_ACT_013) followed by "Cancel"
there (see FW_ACT_011). Flagged for product/design: confirm whether a direct
Step 2 cancel/discard action is intended; re-test once one exists.

CORRECTED 2026-08-04, build dca9938158: this case's original expected result
described "Activate" as "disabled until an owner is checked" — that premise
is now false (see FW_ACT_005: activation no longer requires an owner, so
Activate is enabled regardless of owner selection). That correction has no
bearing on why this case is blocked — Step 2 still has no Cancel control of
its own, for the unrelated reason above — so it remains skipped.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT012:

    @pytest.mark.regression
    @pytest.mark.skip(
        reason="Step 2 has no Cancel button at all (footer is exactly Back + Activate) — \"click Cancel "
        'directly on Step 2" is not a performable action. The only discard path from Step 2 is Back '
        "(to Step 1) then Cancel there — see FW_ACT_011/FW_ACT_013. Flag for product/design: confirm "
        "whether a direct Step 2 discard control is intended."
    )
    @allure.title("FW_ACT_012: discard an in-progress Step 2 selection directly (not performable — no Step 2 Cancel)")
    def test_step2_no_cancel_button_blocked(self, framework_activate_wizard_page):
        (framework_activate_wizard_page
            .select_framework_card("ISO 27001 (2022)")
            .next()
            .open_owner_picker()
            .check_owner("Clara Cogsworth")
            .close_owner_picker()
            .assert_cancel_present_on_step2())
