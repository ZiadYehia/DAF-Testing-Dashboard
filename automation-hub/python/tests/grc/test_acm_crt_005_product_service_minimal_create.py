"""
CRT_005 — Validate that a 'Product / Service' asset can be created with only
its required field filled and Step 2 left blank.
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT005:

    @pytest.mark.regression
    @allure.title("CRT_005: Product / Service asset created with required fields only")
    def test_product_service_minimal_create(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Product {uniq}"
        value = f"PROD-QA-{uniq}"
        (asset_create_page
            .select_family("Governance & Compliance")
            .select_type("Product / Service")
            .fill_asset_name(asset_name)
            .fill_field("Product ID", value)
            .next_step()
            .create()
            .assert_created(asset_name)
            .assert_field("Product ID", value))
