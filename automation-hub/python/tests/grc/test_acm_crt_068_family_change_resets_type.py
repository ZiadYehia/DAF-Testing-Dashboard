"""
CRT_068 — Validate that changing Asset Family resets Asset Type and clears
already-entered type-specific fields.
"""
import allure
import pytest


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT068:

    @pytest.mark.regression
    @allure.title("CRT_068: Changing Asset Family resets Asset Type and clears type-specific fields")
    def test_family_change_resets_type(self, asset_create_page):
        (asset_create_page
            .select_family("Technology & Digital")
            .select_type("Application")
            .fill_field("Application Name", "QA Temp App", required=True)
            .assert_field_value("Application Name", "QA Temp App", required=True)
            .select_family("Physical")
            .assert_type_not_selected("Application")
            .assert_type_specific_field_absent("Application Name"))
