"""
FW_ACT_028 — Validate that navigation is Back-only via the progress
indicator (progress segments must not be forward-navigable).
Feature: Framework Activate Wizard

KNOWN BUG — fails honestly today, re-scoped 2026-07-29: the catalog is no
longer empty (~219 frameworks), and progress segment 2 IS clickable and
jumps straight to Step 2 once a framework is selected, bypassing "Next"
entirely (reproduced twice live). This test selects a framework first, then
calls assert_progress_segments_not_interactive() — which clicks segment 2
and expects to remain on Step 1 ("Select Framework" heading still visible).
With a framework selected that expectation is false today (the page has
already jumped to Step 2), so the assertion throws — an honest red run
confirming the defect. Cross-reference FW_ACT_032 (the no-selection control
defect confirmation) and FW_ACT_032 (the no-selection case, where the same
click IS inert and this assertion would pass).
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT028:

    @pytest.mark.regression
    @allure.title("FW_ACT_028: progress segment 2 must not forward-navigate once a framework is selected")
    def test_progress_bar_not_interactive(self, framework_activate_wizard_page):
        (framework_activate_wizard_page
            .search("ISO 27001")
            .select_framework_card("ISO 27001 (2022)")
            .assert_progress_segments_not_interactive())
