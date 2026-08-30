"""
CRT_016 — Validate that a 'Database / Data Storage' asset can be created with
only its required field filled and Step 2 left blank.
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT016:

    @pytest.mark.regression
    @allure.title("CRT_016: Database asset created with required fields only")
    def test_database_minimal_create(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Database {uniq}"
        (asset_create_page
            .select_family("Technology & Digital")
            .select_type("Database / Data Storage")
            .fill_asset_name(asset_name)
            .fill_field("Data Store Name", f"QA-DB-{uniq}", required=True)
            .next_step()
            .create()
            .assert_created(asset_name)
            .assert_field("Data Store Name", f"QA-DB-{uniq}"))
