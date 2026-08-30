"""
FW_ACT_021 — Validate that the progress indicator on Step 2 shows the first
segment solid dark-blue (complete) and the second segment reflects the
current step.
Feature: Framework Activate Wizard

Confirmed live (2026-07-29): both progress segments render
bg-allendevaux-dark-blue-300 once Step 2 is reached, and segment 2's
aria-label reads the selected framework's name (e.g. "ISO 27001 (2022)")
instead of "Activate Framework".
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT021:

    @pytest.mark.regression
    @allure.title("FW_ACT_021: Progress bar Step 2 segment state (both filled, segment 2 labeled with framework name)")
    def test_progress_bar_step2_state(self, framework_activate_wizard_page):
        (framework_activate_wizard_page
            .search("ISO 27001")
            .select_framework_card("ISO 27001 (2022)")
            .next()
            .assert_progress_bar_step2()
            .assert_progress_segment_labels(["Select Framework", "ISO 27001 (2022)"]))
