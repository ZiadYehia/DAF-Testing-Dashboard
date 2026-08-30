"""
FW_ACT_001 — Validate that an Admin can activate a new framework through the
wizard and it appears as "Active" in the Framework Library with all clauses
initialized.
Feature: Framework Activate Wizard

Executed live once on 2026-07-29 against "ISO 21434 (2021)" + owner "Clara
Cogsworth" (full result recorded on the FW_ACT_001 test case): the wizard
closed and redirected to /grc/frameworks; the new "ISO 21434 (2021)" card
showed "Active" / "GENERAL" with clauses initialized ("Clauses 12",
"In-scope clauses 11 / 12", "Owners Clara Cogsworth"). KNOWN BUG confirmed on
that same run: NO success toast/confirmation of any kind is shown after
Activate (no `.p-toast`, no `[role="alert"]`), though design requires one —
asserted below via `assert_success_toast_shown()`.

This module is split into two tests so regression can safely replay the
non-destructive half every run:
 - The first test drives the wizard up to `assert_activate_enabled()` only —
   it never calls `.activate()`, so it creates no tenant data. "ISO 21434
   (2021)" is now Active (from the 2026-07-29 run above) and excluded from
   the Step 1 grid, so this uses "ISO 27001 (2022)" instead, which stays
   selectable across replays.
 - The second test documents the real submit + the missing-toast defect, but
   is `@pytest.mark.skip`ped so it never runs: calling `.activate()` for real
   would permanently activate another framework in the tenant on every
   regression run. The one real submit already happened manually as
   described above; this body only exists so the known-bug assertion stays a
   compiled, callable page-object method rather than a comment.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT001:

    @pytest.mark.regression
    @allure.title("FW_ACT_001: wizard reaches Activate-enabled state for a selected framework + owner")
    def test_activate_ready_state(self, framework_activate_wizard_page):
        (framework_activate_wizard_page
            .select_framework_card("ISO 27001 (2022)")
            .next()
            .open_owner_picker()
            .check_owner("Clara Cogsworth")
            .close_owner_picker()
            .assert_activate_enabled())

    @pytest.mark.regression
    @pytest.mark.skip(
        reason="Calling .activate() for real permanently activates another framework in the tenant on "
        "every regression run. The real submit was already executed manually once on 2026-07-29 "
        'against "ISO 21434 (2021)" + owner "Clara Cogsworth" (result recorded on the FW_ACT_001 test '
        "case: wizard closed, redirected to /grc/frameworks, new Active card appeared with clauses "
        "initialized) — including the confirmed missing-success-toast defect asserted below. Not replayed."
    )
    @allure.title("FW_ACT_001: Activate submits and shows a success confirmation (KNOWN BUG — no toast today)")
    def test_activate_shows_success_confirmation(self, framework_activate_wizard_page):
        (framework_activate_wizard_page
            .select_framework_card("ISO 27001 (2022)")
            .next()
            .open_owner_picker()
            .check_owner("Clara Cogsworth")
            .close_owner_picker()
            .activate()
            .assert_success_toast_shown())
