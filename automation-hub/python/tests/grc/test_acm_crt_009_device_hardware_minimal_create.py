"""
CRT_009 — Validate that a 'Device / Hardware' asset can be created with only
its required fields filled and Step 2 left blank.

Note: per known bug DT-3294, the 'Serial Number' field label is not marked
with an asterisk in the UI even though it is required — it is still filled
here alongside 'Asset Tag *'.
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT009:

    @pytest.mark.regression
    @allure.title("CRT_009: Device / Hardware asset created with required fields only")
    def test_device_hardware_minimal_create(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Device {uniq}"
        asset_tag = f"TAG-QA-{uniq}"
        serial_number = f"SN-QA-{uniq}"
        (asset_create_page
            .select_family("Physical")
            .select_type("Device / Hardware")
            .fill_asset_name(asset_name)
            .fill_field("Asset Tag", asset_tag)
            # Known quirk (DT-3294 / portal build 2026-07-06): 'Serial Number' has
            # no asterisk in the UI — matched via the bare label, not '{label} *'.
            .fill_field("Serial Number", serial_number, required=False)
            .next_step()
            .create()
            .assert_created(asset_name)
            .assert_field("Asset Tag", asset_tag)
            .assert_field("Serial Number", serial_number))
