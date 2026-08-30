"""
CRT_038 — inline errors when Certification's Framework, Certification Body, and Issue Date are all left empty
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT038:

    @pytest.mark.regression
    @allure.title("CRT_038: inline errors when Certification's Framework, Certification Body, and Issue Date are all left empty")
    def test_certification_all_fields_empty(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Certification Neg {uniq}"

        (asset_create_page
            .select_family("Trust & Public")
            .select_type("Certification")
            .fill_asset_name(asset_name)
            # Framework, Certification Body, Issue Date all intentionally left empty
            .assert_text_visible("Certification Body", first=True)
            .next_step_expect_blocked()
            .assert_inline_error("Framework")
            .assert_inline_error("Certification Body")
            .assert_inline_error("Issue Date")
            .assert_still_on_step1())
