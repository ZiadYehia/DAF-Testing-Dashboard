"""
CRT_026 — inline error when Person's Work Email is left empty
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT026:

    @pytest.mark.regression
    @allure.title("CRT_026: inline error when Person's Work Email is left empty")
    def test_person_work_email_required_empty(self, asset_create_page):
        uniq = unique_suffix()
        name = f"QA Person Neg {uniq}"
        (asset_create_page
            .select_family("Organizational & Responsibility")
            .select_type("Person")
            .fill_asset_name(name)
            .assert_text_visible("Work Email", first=True)
            .next_step_expect_blocked()
            .assert_inline_error("Work Email")
            .assert_still_on_step1())
