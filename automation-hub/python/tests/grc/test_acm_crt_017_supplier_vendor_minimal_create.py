"""
CRT_017 — Validate that a 'Supplier / Vendor' asset can be created with only
its required field filled and Step 2 left blank.
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT017:

    @pytest.mark.regression
    @allure.title("CRT_017: Supplier / Vendor asset created with required fields only")
    def test_supplier_vendor_minimal_create(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Supplier {uniq}"
        (asset_create_page
            .select_family("Third-Party")
            .select_type("Supplier / Vendor")
            .fill_asset_name(asset_name)
            .fill_field("Supplier Name", f"QA Vendor {uniq}", required=True)
            .next_step()
            .create()
            .assert_created(asset_name)
            .assert_field("Supplier Name", f"QA Vendor {uniq}"))
