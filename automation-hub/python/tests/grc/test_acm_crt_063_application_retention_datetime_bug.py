"""
CRT_063 — Validate that setting a 'Retention' value in Step 2 does not fail
asset creation with a backend datetime error, for an 'Application' asset
(DT-3335).
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT063:

    @pytest.mark.regression
    @pytest.mark.xfail(reason="DT-3335", strict=False)
    @allure.title("CRT_063: Application creation with Step 2 Retention set does not fail with backend datetime error (DT-3335)")
    def test_application_retention_datetime_bug(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Retention Bug App {uniq}"

        (asset_create_page
            .select_family("Technology & Digital")
            .select_type("Application")
            .fill_asset_name(asset_name)
            .fill_field("Application Name", asset_name, required=True)
            .select_dropdown("Environment", "Production")
            .next_step()
            .pick_date("Retention", "15", months_ahead=1)
            .create()
            .assert_created(asset_name))
