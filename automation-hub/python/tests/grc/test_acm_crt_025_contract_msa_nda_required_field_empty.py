"""
CRT_025 — inline error when Contract / MSA / NDA's Contract ID is left empty
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT025:

    @pytest.mark.regression
    @allure.title("CRT_025: inline error when Contract / MSA / NDA's Contract ID is left empty")
    def test_contract_msa_nda_required_field_empty(self, asset_create_page):
        uniq = unique_suffix()
        name = f"QA Contract Neg {uniq}"
        (asset_create_page
            .select_family("Legal & Contractual")
            .select_type("Contract / MSA / NDA")
            .fill_asset_name(name)
            .assert_text_visible("Contract ID", first=True)
            .next_step_expect_blocked()
            .assert_inline_error("Contract ID")
            .assert_still_on_step1())
