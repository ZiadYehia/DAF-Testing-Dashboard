"""
CRT_083 — Validate Data Sensitivity can be explicitly set to a non-default
value and displays on the detail page.
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT083:

    @pytest.mark.regression
    @allure.title("CRT_083: Data Sensitivity set explicitly and displays on Overview")
    def test_data_sensitivity_explicit(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Data Sensitivity Check {uniq}"

        (asset_create_page
            .select_family("Privacy")
            .select_type("Data Category")
            .fill_asset_name(asset_name)
            .fill_field("Data Category Name", f"QA Sensitivity Category {uniq}")
            .next_step()
            # Step 2 — Data Sensitivity combobox (accessible name verified live)
            .select_dropdown("a data sensitivity level", "Highly Sensitive")
            .create()
            .assert_created(asset_name)
            # Data Sensitivity persisted and displays on the Overview tab
            .assert_field("Data Sensitivity", "Highly Sensitive"))
