"""
CRT_075 — Validate that in Step 2's Relationships (Tagging) section only
'Relationship Type' is interactive and the other 7 dropdowns are disabled.
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT075:

    @pytest.mark.regression
    @allure.title("CRT_075: Relationships section only has Relationship Type enabled")
    def test_relationships_disabled_fields(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Relationships Check {uniq}"

        (asset_create_page
            .select_family("Technology & Digital")
            .select_type("Application")
            .fill_asset_name(asset_name)
            .fill_field("Application Name", asset_name, required=True)
            .select_dropdown("Environment", "Testing")
            .next_step()
            .assert_text_visible("Relationships (Tagging)")
            # Only Relationship Type should be interactive
            .assert_dropdown_enabled("Select or add a relationship type")
            # The other 7 dropdowns must be disabled (accessible names verified live)
            .assert_dropdown_disabled("Select linked controls")
            .assert_dropdown_disabled("Select linked risks")
            .assert_dropdown_disabled("Select linked policies")
            .assert_dropdown_disabled("Select linked vendors or systems")
            .assert_dropdown_disabled("Select frameworks")
            .assert_dropdown_disabled("Select contracts")
            .assert_dropdown_disabled("Select audits"))
