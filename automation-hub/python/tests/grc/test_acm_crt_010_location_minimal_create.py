"""
CRT_010 — Validate that a 'Location' asset can be created with only its
required field filled and Step 2 left blank.
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT010:

    @pytest.mark.regression
    @allure.title("CRT_010: Location asset created with required fields only")
    def test_location_minimal_create(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Location {uniq}"
        address = f"1 QA Street, Test City {uniq}"
        (asset_create_page
            .select_family("Physical")
            .select_type("Location")
            .fill_asset_name(asset_name)
            .fill_field("Address", address)
            .next_step()
            .create()
            .assert_created(asset_name)
            .assert_field("Address", address))
