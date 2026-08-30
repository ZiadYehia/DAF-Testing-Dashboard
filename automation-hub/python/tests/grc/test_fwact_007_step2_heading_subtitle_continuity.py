"""
FW_ACT_007 — Validate the heading/subtitle continuity and the
selected-framework read-only context on "Step 2 — Assign Owner & Activate".
Feature: Framework Activate Wizard

The breadcrumb still reads "Frameworks > Activate Framework" (full page, not
a modal) and the page heading/subtitle stay "Activate Framework" / "Configure
the framework activation." unchanged from Step 1 — the copy does not change
per step. The selected framework is shown as a read-only `h2` context below
the progress bar, and the progress segment 2's `aria-label` changes from
"Activate Framework" to the selected framework's name.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT007:

    @pytest.mark.regression
    @allure.title("FW_ACT_007: Step 2 heading/subtitle continuity and read-only framework context")
    def test_step2_heading_subtitle_continuity(self, framework_activate_wizard_page):
        (framework_activate_wizard_page
            .search("ISO 27001")
            .select_framework_card("ISO 27001 (2022)")
            .next()
            .assert_breadcrumb()
            .assert_page_heading_and_subtitle("Activate Framework", "Configure the framework activation.")
            .assert_step2_context_heading("ISO 27001 (2022)")
            .assert_on_step2()
            .assert_progress_segment_labels(["Select Framework", "ISO 27001 (2022)"]))
