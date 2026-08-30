"""
CRT_003 — Validate that a 'Control' asset can be created with only its
required field filled and Step 2 left blank.
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT003:

    @pytest.mark.regression
    @allure.title("CRT_003: Control asset created with required fields only")
    def test_control_minimal_create(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Control {uniq}"
        value = f"CTRL-QA-{uniq}"
        (asset_create_page
            .select_family("Governance & Compliance")
            .select_type("Control")
            .fill_asset_name(asset_name)
            .fill_field("Control Code", value)
            .next_step()
            .create()
            .assert_created(asset_name)
            .assert_field("Control Code", value))
