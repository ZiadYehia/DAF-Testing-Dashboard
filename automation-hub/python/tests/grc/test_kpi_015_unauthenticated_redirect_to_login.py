"""
KPI_015 — Validate that an Unauthenticated user cannot access the Framework
Library KPI Summary and is redirected to the login page.
Feature: Framework Library KPI Summary

Uses a raw, unauthenticated page (no login at all) since the whole point of
this test is to hit /grc/frameworks with no session. Confirmed live
(2026-08-03, build a146218221): redirects to exactly
/login?returnUrl=%2Fgrc%2Fframeworks, byte-for-byte matching the test
case's expected result. The Framework Library page and its KPI summary are
never rendered. Passes today.

No `frameworks_library_page_unauthenticated` fixture exists in conftest.py
(only `framework_activate_wizard_page_unauthenticated` does, for the sibling
feature) — per this suite's "do not edit conftest.py" rule, this test
builds the unauthenticated page directly from the raw `page` fixture
instead, still importing only the FrameworksLibraryPage class.
"""
import allure
import pytest

from pages.grc.frameworks_library_page import FrameworksLibraryPage


@allure.feature("Frameworks")
@allure.story("Framework Library KPI Summary")
class TestKPI015:

    @pytest.mark.regression
    @allure.title("KPI_015: Unauthenticated deep link to the Frameworks Library redirects to login")
    def test_unauthenticated_redirect_to_login(self, page):
        FrameworksLibraryPage(page).open_unauthenticated().assert_redirected_to_login()
