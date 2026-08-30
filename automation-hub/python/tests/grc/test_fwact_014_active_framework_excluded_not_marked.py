"""
FW_ACT_014 — Validate handling of an already-active framework on Step 1.
Feature: Framework Activate Wizard

KNOWN BUG: FW_FR_ACTIVATE_02 requires an already-active framework to still
appear in the Step 1 grid, marked "Already in catalog", and not selectable —
instead, active frameworks are excluded from the grid entirely (verified for
"AICPA", "Alaska PIPA", and, post-activation, "ISO 21434 (2021)" — see
FW_ACT_001). This test asserts the CORRECT/required behaviour via
`assert_card_marked_already_in_catalog` and therefore fails honestly today,
since searching its name instead returns the "No results found!" empty state
with no card at all. Proven end-to-end live on 2026-07-29
against the framework activated live on 2026-07-29.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT014:

    @pytest.mark.regression
    @allure.title(
        'FW_ACT_014: an already-active framework should still be shown, marked "Already in catalog" '
        "(KNOWN BUG — excluded instead)"
    )
    def test_active_framework_excluded_not_marked(self, framework_activate_wizard_page):
        (framework_activate_wizard_page
            .search("ISO 21434")
            .assert_card_marked_already_in_catalog("ISO 21434 (2021)"))
