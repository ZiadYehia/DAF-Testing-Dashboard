"""
CRT_012 — Validate that a 'ROPA Record' asset can be created with its
required fields filled, including Legal Basis, and Step 2 left blank.
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT012:

    @pytest.mark.regression
    @allure.title("CRT_012: ROPA Record asset created with required fields only")
    def test_ropa_record_minimal_create(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA ROPA {uniq}"
        processing_purpose = f"QA Marketing Outreach {uniq}"
        (asset_create_page
            .select_family("Privacy")
            .select_type("ROPA Record")
            .fill_asset_name(asset_name)
            .fill_field("Processing Purpose", processing_purpose, required=True)
            # Legal Basis is required together with Processing Purpose (the pair is validated for uniqueness)
            .select_dropdown_first("Legal Basis")
            .next_step()
            .create()
            .assert_created(asset_name)
            .assert_field("Processing Purpose", processing_purpose))
