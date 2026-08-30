"""
FW_ACT_018 — Validate that the framework catalog never lists two selectable
cards for the same framework.
Feature: Framework Activate Wizard

REFRAMED from the original premise: no framework in this catalog has two
independently selectable versions — the year/version is baked inline into a
single name string (e.g. "ISO 27001 (2022)"). Confirmed live (2026-07-29):
searching "ISO 2" returns ISO 22301 (2019), ISO 27001 (2022), ISO 27002
(2022), ISO 27017 (2015), ISO 27701 (2025), ISO 29100 (2024) — six distinct
name+version strings, no repeats. "ISO 21434 (2021)" is intentionally NOT
part of this result set: it was activated in FW_ACT_001 and is now excluded
from the Step 1 grid entirely (see FW_ACT_014), so this test never selects
it.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT018:

    @pytest.mark.regression
    @allure.title("FW_ACT_018: no duplicate/multi-version cards for the same framework")
    def test_no_duplicate_card_names(self, framework_activate_wizard_page):
        (framework_activate_wizard_page
            .search("ISO 2")
            .assert_no_duplicate_card_names())
