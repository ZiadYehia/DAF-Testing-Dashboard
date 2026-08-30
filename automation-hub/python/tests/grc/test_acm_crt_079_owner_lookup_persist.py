"""
CRT_079 — Validate that Primary Owner and Secondary Owner selected in Step 2
via the user lookup persist and display correctly on the asset detail page.
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT079:

    @pytest.mark.regression
    @allure.title("CRT_079: Primary and Secondary Owner selected in Step 2 persist on detail page")
    def test_owner_lookup_persist(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Owner Check {uniq}"

        (asset_create_page
            .select_family("Technology & Digital")
            .select_type("Application")
            .fill_asset_name(asset_name)
            .fill_field("Application Name", asset_name, required=True)
            .select_dropdown("Environment", "Production")
            .next_step()
            # Step 2 — Ownership. exact=True: "Select a user or enter an email" is a
            # substring of the Secondary Owner's "...(optional)" accessible name too.
            .select_owner("Select a user or enter an email", exact=True)
            .select_owner("Select a user or enter an email (optional)", index=1)
            .create()
            .assert_created(asset_name))
