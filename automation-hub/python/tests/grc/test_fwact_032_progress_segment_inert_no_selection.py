"""
FW_ACT_032 — Validate that clicking progress segment 2 with no framework
selected is inert and does not bypass Step 1 validation.
Feature: Framework Activate Wizard

Confirmed live 2026-07-29: unlike FW_ACT_028 (a framework selected), this
click has no effect when nothing is selected yet — the page remains on
Step 1. Passes today.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT032:

    @pytest.mark.regression
    @allure.title("FW_ACT_032: Progress segment 2 is inert on Step 1 with no framework selected")
    def test_progress_segment_inert_no_selection(self, framework_activate_wizard_page):
        (framework_activate_wizard_page
            .click_progress_segment(2)
            .assert_on_step1())
