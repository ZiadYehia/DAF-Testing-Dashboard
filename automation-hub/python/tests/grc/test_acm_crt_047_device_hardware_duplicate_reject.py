"""
CRT_047 — Validate that a duplicate 'Device / Hardware' Asset Tag is
rejected.
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT047:

    @pytest.mark.regression
    @allure.title("CRT_047: duplicate Device / Hardware Asset Tag is rejected")
    def test_device_hardware_duplicate_reject(self, asset_create_page):
        uniq = unique_suffix()
        dup_tag = f"TAG-DUP-{uniq}"

        # Fixture create — establishes the asset that will collide
        # Serial Number carries no asterisk in the UI (not required).
        assets_page = (asset_create_page
            .select_family("Physical")
            .select_type("Device / Hardware")
            .fill_asset_name(f"QA Device Dup A {uniq}")
            .fill_field("Asset Tag", dup_tag, required=True)
            .fill_field("Serial Number", f"SN-DUP-{uniq}-A", required=False)
            .next_step()
            .create()
            .back_to_asset_manager())

        # Attempt a second create with the same Asset Tag, different Serial Number
        (assets_page
            .add_new()
            .select_family("Physical")
            .select_type("Device / Hardware")
            .fill_asset_name(f"QA Device Dup B {uniq}")
            .fill_field("Asset Tag", dup_tag, required=True)
            .fill_field("Serial Number", f"SN-DUP-{uniq}-B", required=False)
            .next_step()
            .create_expect_no_redirect()
            .assert_duplicate_rejected()
            .assert_url_contains("/grc/assets/create"))
