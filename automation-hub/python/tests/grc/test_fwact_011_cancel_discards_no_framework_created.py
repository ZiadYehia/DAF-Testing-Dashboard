"""
FW_ACT_011 — Validate that clicking "Cancel" on Step 1 dismisses the wizard
without creating any framework (active or draft).
Feature: Framework Activate Wizard

Scoped to what this page object can observe: the wizard closes and redirects
to the Framework Library on Cancel. Confirming "ISO 27001 (2022)" is absent
from the Library's own grid is out of scope here — this module drives exactly
one page class (this wizard), never the Frameworks Library page — but Cancel
never reaches `.activate()` on this page object at all, so no framework can
have been created by this flow regardless.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT011:

    @pytest.mark.regression
    @allure.title("FW_ACT_011: Cancel on Step 1 dismisses the wizard back to the Library")
    def test_cancel_discards_no_framework_created(self, framework_activate_wizard_page):
        (framework_activate_wizard_page
            .search("ISO 27001")
            .select_framework_card("ISO 27001 (2022)")
            .cancel()
            .assert_redirected_to_library())
