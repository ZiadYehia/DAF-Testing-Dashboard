"""
FDO_018 — Validate that "Applicability and Scoping" and "Audit Package"
tabs render as empty stubs without errors.
Feature: Framework Detail Overview (data/grc/features/framework-detail-overview)

Confirmed live (2026-08-04) and identical on every framework including
the 0-clause Draft: both tabs display only a bare text node (no heading
tag, no functional content, no error). Note the "Applicability and
Scoping" tab's panel body reads "Applicability & Scoping" with an
ampersand — deliberately different from the tab label's "and" — which is
what assertApplicabilityScopingTabContent checks for.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Detail Overview")
class TestFDO018:

    @pytest.mark.regression
    @allure.title("FDO_018: Applicability and Scoping / Audit Package tabs render as empty stubs without errors")
    def test_stub_tabs_render_empty(self, framework_detail_overview_page):
        (framework_detail_overview_page
            .open("PB4ERG63zE")
            .switch_to_tab("Applicability and Scoping")
            .assert_applicability_scoping_tab_content()
            .switch_to_tab("Audit Package")
            .assert_audit_package_tab_content())
