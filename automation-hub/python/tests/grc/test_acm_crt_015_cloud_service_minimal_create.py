"""
CRT_015 — Validate that a 'Cloud Service' asset can be created with only its
required field filled and Step 2 left blank.

Known backend bug DT-3260 may cause this submission to fail with an
'Invalid fields schema JSON format' error; per the test case's Expected
column this spec asserts SUCCESS.
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT015:

    @pytest.mark.regression
    @allure.title("CRT_015: Cloud Service asset created with required fields only")
    def test_cloud_service_minimal_create(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Cloud Service {uniq}"
        tenant_id = f"tenant-qa-{uniq}"
        (asset_create_page
            .select_family("Technology & Digital")
            .select_type("Cloud Service")
            .fill_asset_name(asset_name)
            .fill_field("Tenant ID", tenant_id)
            .next_step()
            .create()
            .assert_created(asset_name)
            .assert_field("Tenant ID", tenant_id))
