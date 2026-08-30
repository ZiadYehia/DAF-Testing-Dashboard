"""
FW_ACT_043 — Validate that the 10-owner MAXIMUM still holds after the
"activation no longer requires an owner" change: checking a 10th owner keeps
Activate enabled and hard-disables every other option, with no error/
max-reached message anywhere.
Feature: Framework Activate Wizard

Confirmed live 2026-08-04 (build dca9938158): at exactly 10 checked, every
OTHER [role=option] becomes genuinely hard-disabled (aria-disabled/
data-p-disabled — not a cosmetic greyout; a real click on the 11th times out
with "element is not enabled"), with zero error/toast/inline text anywhere
on the page. The zero-owner-minimum change (FW_ACT_005) did not touch this
ceiling.

Fixture: Bahamas DPA (2003), Inactive. Deliberately never clicks Activate —
checking owners in the picker does not create/mutate a catalog record, so no
state restoration is needed.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT043:

    @pytest.mark.regression
    @allure.title("FW_ACT_043: Framework Owners selection is hard-capped at 10")
    def test_owner_selection_capped_at_ten(self, framework_activate_wizard_page):
        (framework_activate_wizard_page
            .search("Bahamas DPA")
            .select_framework_card("Bahamas DPA (2003)")
            .next()
            .open_owner_picker()
            .check_first_unchecked_owner_options(10)
            .assert_owner_selection_capped_at_ten())
