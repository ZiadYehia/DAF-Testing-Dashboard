"""
FW_ACT_002 — Validate that no "Save as Draft" action exists anywhere in the
Activate Framework flow — only a single "Activate" button is present on
Step 2 — contradicting FW_FR_ACTIVATE_04's documented Save-as-Draft path.
Feature: Framework Activate Wizard

This is a negative/contradiction test, not a KNOWN-BUG assertion: it confirms
the absence that is genuinely true of the live app today, so it PASSES.
Reaching Step 2 requires an owner checked (Activate stays disabled
otherwise), so the chain checks "Clara Cogsworth" purely to get there.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT002:

    @pytest.mark.regression
    @allure.title("FW_ACT_002: no Save as Draft control exists on Step 2")
    def test_no_save_as_draft_anywhere(self, framework_activate_wizard_page):
        (framework_activate_wizard_page
            .search("ISO 27001")
            .select_framework_card("ISO 27001 (2022)")
            .next()
            .open_owner_picker()
            .check_owner("Clara Cogsworth")
            .close_owner_picker()
            .assert_back_only_other_button_is_activate()
            .assert_no_save_as_draft_control())
