"""
CRT_070 — Validate that Cancel on Step 1 discards all entered data and
returns to the Assets Manager list.
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT070:

    @pytest.mark.regression
    @allure.title("CRT_070: Cancel on Step 1 discards data and returns to Assets Manager list")
    def test_cancel_discards_data(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Discard Test {uniq}"

        (asset_create_page
            .select_family("Technology & Digital")
            .select_type("Application")
            .fill_asset_name(asset_name)
            .fill_field("Application Name", asset_name, required=True)
            .select_dropdown("Environment", "Development")
            .cancel()
            .assert_on_list()
            .assert_asset_not_listed(asset_name))
