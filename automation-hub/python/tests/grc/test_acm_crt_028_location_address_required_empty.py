"""
CRT_028 — inline error when Location's Address is left empty
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT028:

    @pytest.mark.regression
    @allure.title("CRT_028: inline error when Location's Address is left empty")
    def test_location_address_required_empty(self, asset_create_page):
        uniq = unique_suffix()
        name = f"QA Location Neg {uniq}"
        (asset_create_page
            .select_family("Physical")
            .select_type("Location")
            .fill_asset_name(name)
            .assert_text_visible("Address", first=True)
            .next_step_expect_blocked()
            .assert_inline_error("Address")
            .assert_still_on_step1())
