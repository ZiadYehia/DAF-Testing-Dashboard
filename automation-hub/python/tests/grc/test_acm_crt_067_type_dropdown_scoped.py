"""
CRT_067 — Validate that the Asset Type dropdown is scoped to the selected
Family and alphabetical within it.
"""
import allure
import pytest


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT067:

    @pytest.mark.regression
    @allure.title("CRT_067: Asset Type dropdown is scoped to selected Family, alphabetical")
    def test_type_dropdown_scoped(self, asset_create_page):
        expected_types = ["Application", "Cloud Service", "Database / Data Storage"]

        # MISSING: AssetCreatePage.assert_type_options_order(expected) not yet implemented.
        (asset_create_page
            .select_family("Technology & Digital")
            .assert_type_options_order(expected_types))
