"""
CRT_057 — Validate that a 'Device / Hardware' asset cannot be created with a
future 'Purchase Date'. Known bug DT-3295: the portal currently accepts and
saves future purchase dates without validation.
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT057:

    @pytest.mark.regression
    @pytest.mark.xfail(reason="DT-3295", strict=False)
    @allure.title("CRT_057: Device/Hardware asset with future Purchase Date is rejected")
    def test_device_hardware_future_purchase_date_rejected(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Future Purchase Date {uniq}"

        # portal build 2026-07-06: Serial Number no longer required (asterisk
        # removed). Typed dates are silently dropped — commit a FUTURE date
        # via the calendar panel: advance one month, pick day 15.
        (asset_create_page
            .select_family("Physical")
            .select_type("Device / Hardware")
            .fill_asset_name(asset_name)
            .fill_field("Asset Tag", f"TAG-BUG-DT3295-{uniq}", required=True)
            .fill_field("Serial Number", f"SN-BUG-DT3295-{uniq}", required=False)
            .pick_date("Purchase Date", "15", months_ahead=1)
            .next_step_expect_blocked()
            .assert_future_purchase_date_rejected())
