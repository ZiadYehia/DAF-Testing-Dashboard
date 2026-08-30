"""
CRT_069 — Validate that changing Asset Type within the same Family swaps
the type-specific fields.
"""
import allure
import pytest


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT069:

    @pytest.mark.regression
    @allure.title("CRT_069: Changing Asset Type within same Family swaps type-specific fields")
    def test_type_change_swaps_fields(self, asset_create_page):
        (asset_create_page
            .select_family("Technology & Digital")
            .select_type("Application")
            .assert_type_specific_field_present("Application Name")
            .assert_dropdown_visible("Select Environment")
            .select_type("Cloud Service")
            .assert_type_specific_field_absent("Application Name")
            .assert_text_visible("Tenant ID"))
