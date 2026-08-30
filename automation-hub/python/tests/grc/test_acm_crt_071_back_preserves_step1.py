"""
CRT_071 — Validate that Back on Step 2 returns to Step 1 with all
previously entered values preserved.
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT071:

    @pytest.mark.regression
    @allure.title("CRT_071: Back on Step 2 preserves previously entered Step 1 values")
    def test_back_preserves_step1(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Back Preserve {uniq}"

        (asset_create_page
            .select_family("Technology & Digital")
            .select_type("Application")
            .fill_asset_name(asset_name)
            .fill_field("Application Name", asset_name, required=True)
            .select_dropdown("Environment", "Staging")
            .next_step()
            .back()
            .assert_family_selected("Technology & Digital")
            .assert_type_selected("Application")
            .assert_field_value("Asset Name", asset_name, required=True)
            .assert_field_value("Application Name", asset_name, required=True)
            .assert_field_id_value("environment", "Staging"))
