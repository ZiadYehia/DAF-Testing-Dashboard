"""
KPI_012 — Visual layout: the 4 KPI cards show the correct icons, headings,
and sublabels.
Feature: Framework Library KPI Summary

Confirmed live (2026-08-03, build a146218221): labels render as 'Total
Frameworks'/'Active'/'Drafts'/'Avg Readiness' (not the story/design's
'Active Frameworks'/'Draft Frameworks'/'Average Audit Readiness'), sublabels
are sentence-case 'In catalog'/'Contributing to coverage'/'Pending
activation', and each of the 4 tiles carries its own distinct <svg> icon
(network nodes / check-circle / clipboard / gauge). Rewritten to use the
page object's own KPI assertions instead of raw Playwright expect()/locator
calls against `frameworks_library_page.page` directly.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Library KPI Summary")
class TestKPI012:

    @pytest.mark.regression
    @allure.title("KPI_012: KPI cards render correct headings, sublabels, and icons")
    def test_kpi_card_labels_and_icons(self, frameworks_library_page):
        (frameworks_library_page
            .assert_kpi_row_visible()
            .assert_kpi_labels_and_sublabels()
            .assert_all_kpi_tiles_render_icon())
