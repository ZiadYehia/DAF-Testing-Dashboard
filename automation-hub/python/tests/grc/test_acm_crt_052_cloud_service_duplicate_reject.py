"""
CRT_052 — Validate that a duplicate 'Cloud Service' Tenant ID is rejected.
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT052:

    @pytest.mark.regression
    @allure.title("CRT_052: duplicate Cloud Service Tenant ID is rejected")
    def test_cloud_service_duplicate_reject(self, asset_create_page):
        uniq = unique_suffix()
        dup_id = f"tenant-dup-{uniq}"

        # Fixture create — establishes the asset that will collide
        assets_page = (asset_create_page
            .select_family("Technology & Digital")
            .select_type("Cloud Service")
            .fill_asset_name(f"QA Cloud Service Dup A {uniq}")
            .fill_field("Tenant ID", dup_id, required=True)
            .next_step()
            .create()
            .back_to_asset_manager())

        # Attempt a second create with the same identifier
        (assets_page
            .add_new()
            .select_family("Technology & Digital")
            .select_type("Cloud Service")
            .fill_asset_name(f"QA Cloud Service Dup B {uniq}")
            .fill_field("Tenant ID", dup_id, required=True)
            .next_step()
            .create_expect_no_redirect()
            .assert_duplicate_rejected()
            .assert_url_contains("/grc/assets/create"))
