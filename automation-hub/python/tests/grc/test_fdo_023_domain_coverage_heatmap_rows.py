"""
FDO_023 — Validate that the Domain Coverage Heatmap renders one
horizontal bar and count per domain.
Feature: Framework Detail Overview (data/grc/features/framework-detail-overview)

Confirmed live (2026-08-04), byte-identical on every framework sampled
(Coverage is 100% hardcoded mock content): the heatmap shows exactly three
rows — "A.5 Organizational Controls" (2), "A.8 Technological Controls" (2),
and "A.5 People Controls" (1) — matching the scripted example verbatim.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Detail Overview")
class TestFDO023:

    @pytest.mark.regression
    @allure.title("FDO_023: Domain Coverage Heatmap renders one horizontal bar and count per domain")
    def test_domain_coverage_heatmap_rows(self, framework_detail_overview_page):
        (framework_detail_overview_page
            .open("PB4ERG63zE")
            .switch_to_tab("Coverage")
            .assert_coverage_heatmap_row("A.5 Organizational Controls", 2)
            .assert_coverage_heatmap_row("A.8 Technological Controls", 2)
            .assert_coverage_heatmap_row("A.5 People Controls", 1))
