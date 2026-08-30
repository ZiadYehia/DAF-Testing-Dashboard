"""
CRT_078 — Validate Description and Notes entered in Step 2 persist and
display correctly on the asset detail page.
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT078:

    @pytest.mark.regression
    @allure.title("CRT_078: Description and Notes entered in Step 2 persist on detail page")
    def test_description_notes_persist(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Notes Check {uniq}"
        supplier_name = f"QA Notes Vendor {uniq}"
        description = f"QA verification description {uniq}"
        notes = f"QA verification notes {uniq}"

        (asset_create_page
            .select_family("Third-Party")
            .select_type("Supplier / Vendor")
            .fill_asset_name(asset_name)
            .fill_field("Supplier Name", supplier_name)
            .next_step()
            # Step 2 — History & Collaboration
            .fill_field("Description", description, required=False)
            .fill_field("Notes", notes, required=False)
            .create()
            .assert_created(asset_name)
            # Description and Notes persisted and displayed on the Overview tab
            .assert_field("Description", description)
            .assert_field("Notes", notes))
