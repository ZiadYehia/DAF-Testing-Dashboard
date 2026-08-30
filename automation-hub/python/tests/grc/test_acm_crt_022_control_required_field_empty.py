"""
CRT_022 — inline error when Control's Control Code is left empty
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT022:

    @pytest.mark.regression
    @allure.title("CRT_022: inline error when Control's Control Code is left empty")
    def test_control_required_field_empty(self, asset_create_page):
        uniq = unique_suffix()
        name = f"QA Control Neg {uniq}"
        (asset_create_page
            .select_family("Governance & Compliance")
            .select_type("Control")
            .fill_asset_name(name)
            .assert_text_visible("Control Code", first=True)
            .next_step_expect_blocked()
            .assert_inline_error("Control Code")
            .assert_still_on_step1())
