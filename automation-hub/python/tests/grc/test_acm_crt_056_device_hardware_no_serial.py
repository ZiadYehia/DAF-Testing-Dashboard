"""
CRT_056 — Validate that a 'Device / Hardware' asset can be created with only
Asset Tag filled and Serial Number left EMPTY (DT-3294). Serial Number
carries no asterisk in the UI and is not actually required.
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT056:

    @pytest.mark.regression
    @pytest.mark.xfail(reason="DT-3294", strict=False)
    @allure.title("CRT_056: Device/Hardware asset created with Asset Tag only, no Serial Number (DT-3294)")
    def test_device_hardware_no_serial_number(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Bug Device {uniq}"

        # Serial Number intentionally left untouched — no asterisk in the UI,
        # not required. Step 2 intentionally left blank.
        (asset_create_page
            .select_family("Physical")
            .select_type("Device / Hardware")
            .fill_asset_name(asset_name)
            .fill_field("Asset Tag", f"TAG-BUG-DT3294-{uniq}", required=True)
            .next_step()
            .create()
            .assert_created(asset_name))
