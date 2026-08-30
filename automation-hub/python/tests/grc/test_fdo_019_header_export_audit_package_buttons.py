"""
FDO_019 — Validate that "Export" and "Generate audit package" buttons
are present in the page header.
Feature: Framework Detail Overview (data/grc/features/framework-detail-overview)

Confirmed live (2026-08-04): both buttons are present, visually distinct,
and enabled on every framework checked, including the 0-clause Draft.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Detail Overview")
class TestFDO019:

    @pytest.mark.regression
    @allure.title("FDO_019: Export and Generate audit package buttons are present in the page header")
    def test_header_export_audit_package_buttons(self, framework_detail_overview_page):
        (framework_detail_overview_page
            .open("PB4ERG63zE")
            .assert_header_buttons_visible())
