"""
FDO_022 — Validate the exact "Implemeneted" (sic) label text and values
on the Coverage tab's first stat card.
Feature: Framework Detail Overview (data/grc/features/framework-detail-overview)

Confirmed live (2026-08-04), byte-identical on every framework sampled
including the 0-clause Draft (Coverage is 100% hardcoded mock content): the
first stat card's label reads exactly "Implemeneted" (the live app's own
misspelling, not "Implemented") with count 5 (40%), the second reads
"Partial" with count 4 (20%), and the third reads "Gaps" with count 20
(40%).
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Detail Overview")
class TestFDO022:

    @pytest.mark.regression
    @allure.title("FDO_022: Coverage tab's first stat card reads the literal \"Implemeneted\" label with correct counts")
    def test_coverage_stat_card_labels_values(self, framework_detail_overview_page):
        (framework_detail_overview_page
            .open("PB4ERG63zE")
            .switch_to_tab("Coverage")
            .assert_coverage_stat_card("Implemeneted", 5, 40)
            .assert_coverage_stat_card("Partial", 4, 20)
            .assert_coverage_stat_card("Gaps", 20, 40))
