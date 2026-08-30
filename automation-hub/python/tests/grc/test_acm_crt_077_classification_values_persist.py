"""
CRT_077 — Validate Confidentiality Level, Criticality/Business Impact, and
Data Sensitivity selected in Step 2 persist and display correctly on the
asset detail page.
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT077:

    @pytest.mark.regression
    @allure.title("CRT_077: Classification values selected in Step 2 persist on detail page")
    def test_classification_values_persist(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Classification Check {uniq}"
        data_store_name = f"QA-Classification-DB-{uniq}"

        (asset_create_page
            .select_family("Technology & Digital")
            .select_type("Database / Data Storage")
            .fill_asset_name(asset_name)
            .fill_field("Data Store Name", data_store_name)
            .next_step()
            # Step 2 — Classification & Criticality
            .select_dropdown("a confidentiality level", "Restricted")
            .select_dropdown("a criticality level", "Critical")
            .select_dropdown("a data sensitivity level", "Personal Data")
            .create()
            .assert_created(asset_name)
            # Classification values persisted and displayed on the Overview tab
            # (exact: the page also contains e.g. a 'Criticality' heading and 'CRITICAL' pill)
            .assert_field("Confidentiality", "Restricted", exact=True)
            .assert_field("Criticality", "Critical", exact=True)
            .assert_field("Data Sensitivity", "Personal Data", exact=True))
