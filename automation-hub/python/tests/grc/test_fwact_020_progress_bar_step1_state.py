"""
FW_ACT_020 — Validate Step 1's progress bar renders its first segment
filled/blue (current) and its second segment grey (upcoming).
Feature: Framework Activate Wizard

Confirmed live via screenshot (2026-07-21): a plain 2-segment horizontal bar,
not the design's discrete check/circle-icon step indicator.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT020:

    @pytest.mark.regression
    @allure.title("FW_ACT_020: Progress bar Step 1 segment state (first filled, second grey)")
    def test_progress_bar_step1_state(self, framework_activate_wizard_page):
        framework_activate_wizard_page.assert_progress_bar_step1()
