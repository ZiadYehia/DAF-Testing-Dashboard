"""
CRT_080 — Validate Business Unit / Department free-text entered in Step 2
persists and displays correctly.
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT080:

    @pytest.mark.regression
    @allure.title("CRT_080: Business Unit / Department persists and displays on Overview")
    def test_business_unit_persist(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Business Unit Check {uniq}"

        (asset_create_page
            .select_family("Governance & Compliance")
            .select_type("Product / Service")
            .fill_asset_name(asset_name)
            .fill_field("Product ID", f"PROD-BU-CHECK-{uniq}")
            .next_step()
            # Step 2 — Business Unit / Department is a verified optional textbox
            .fill_field("Business Unit / Department", "Information Security", required=False)
            .create()
            .assert_created(asset_name)
            # Business Unit / Department persisted and displays on the Overview tab
            .assert_field("Business Unit / Department", "Information Security"))
