"""
FWL_015 — Validate that clicking "Activate Framework" navigates to the
activation wizard. `click_activate_framework()` itself waits for the
`/grc/frameworks/activate` URL, so a timeout there is the failure signal.
Feature: Frameworks Library
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Frameworks Library")
class TestFWL015:

    @pytest.mark.regression
    @allure.title("FWL_015: Clicking Activate Framework navigates to the wizard")
    def test_activate_framework_navigates_wizard(self, frameworks_library_page):
        frameworks_library_page.click_activate_framework()
