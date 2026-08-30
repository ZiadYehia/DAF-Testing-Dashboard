"""
CRT_030 — inline error when ROPA Record's Processing Purpose is left empty
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT030:

    @pytest.mark.regression
    @allure.title("CRT_030: inline error when ROPA Record's Processing Purpose is left empty")
    def test_ropa_record_required_field_empty(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA ROPA Neg {uniq}"

        (asset_create_page
            .select_family("Privacy")
            .select_type("ROPA Record")
            .fill_asset_name(asset_name)
            # 'Processing Purpose' intentionally left empty
            .assert_text_visible("Processing Purpose", first=True)
            .next_step_expect_blocked()
            .assert_inline_error("Processing Purpose")
            .assert_still_on_step1())
