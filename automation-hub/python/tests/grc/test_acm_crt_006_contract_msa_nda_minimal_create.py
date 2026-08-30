"""
CRT_006 — Validate that a 'Contract / MSA / NDA' asset can be created with
only its required field filled and Step 2 left blank.
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT006:

    @pytest.mark.regression
    @allure.title("CRT_006: Contract / MSA / NDA asset created with required fields only")
    def test_contract_msa_nda_minimal_create(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Contract {uniq}"
        value = f"CTR-QA-{uniq}"
        (asset_create_page
            .select_family("Legal & Contractual")
            .select_type("Contract / MSA / NDA")
            .fill_asset_name(asset_name)
            .fill_field("Contract ID", value)
            .next_step()
            .create()
            .assert_created(asset_name)
            .assert_field("Contract ID", value))
