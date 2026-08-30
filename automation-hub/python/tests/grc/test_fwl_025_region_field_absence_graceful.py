"""
FWL_025 — Validate placeholder behaviour for unset optional card and
detail-page fields: a Draft card with no Region set omits the Region row
entirely (no placeholder, no empty gap), while the Framework Details page's
unset "Owner" field renders a bare "-" placeholder character.

Confirmed live (2026-08-03, build a146218221): all six "Test Framework Draft
<suffix>" records have no Region row in their DOM at all (not a "-"
placeholder — the region sub-container simply doesn't render); AICPA PMF's
details page shows "Owner -".
Feature: Frameworks Library
"""
import allure
import pytest

AICPA_TITLE = "AICPA Privacy Management Framework (PMF) (2020)"
DRAFT_TITLE = "Test Framework Draft aIjJnV"


@allure.feature("Frameworks")
@allure.story("Frameworks Library")
class TestFWL025:

    @pytest.mark.regression
    @allure.title('FWL_025: Draft card omits its Region row entirely; details page Owner shows a "-" placeholder')
    def test_region_field_absence_graceful(self, frameworks_library_page):
        (frameworks_library_page
            .toggle_filter_option("All status", "Draft")
            .assert_card_region_row_omitted(DRAFT_TITLE)
            .toggle_filter_option("All status", "Draft")
            .click_card(AICPA_TITLE)
            .assert_details_owner_placeholder())
