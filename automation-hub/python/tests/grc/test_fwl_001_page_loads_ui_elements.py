"""
FWL_001 — Validate that the Frameworks Library page loads with the expected
header, KPI tiles, and toolbar controls.
Feature: Frameworks Library

Confirmed live (2026-08-03, build a146218221): the 'Framework Library'
heading/subtitle, the 'Activate Framework' button (no '+'), all 4 KPI tiles
with their sublabels, the 5 toolbar controls in the documented left-to-right
order, and 50 rendered cards on the default page all match as specified.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Frameworks Library")
class TestFWL001:

    @pytest.mark.regression
    @allure.title("FWL_001: Framework Library page loads with expected header, KPIs, and toolbar")
    def test_page_loads_ui_elements(self, frameworks_library_page):
        (frameworks_library_page
            .assert_on_library()
            .assert_page_heading_and_subtitle(
                "Framework Library",
                "Compliance frameworks — the entry point for requirements. Mapped to SCF controls.",
            )
            .assert_activate_button_visible()
            .assert_kpi_row_visible()
            .assert_kpi_labels_and_sublabels()
            .assert_toolbar_controls_in_order()
            .assert_card_count(50))
