"""
CRT_020 — inline error when Evidence File's System File ID / File Hash is
left empty.
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT020:

    @pytest.mark.regression
    @allure.title("CRT_020: inline error when Evidence File's System File ID / File Hash is left empty")
    def test_evidence_file_required_field_empty(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Evidence File Neg {uniq}"
        (asset_create_page
            .select_family("Evidence")
            .select_type("Evidence File")
            .fill_asset_name(asset_name)
            .assert_text_visible("System File ID / File Hash", first=True)
            .next_step_expect_blocked()
            .assert_inline_error("System File ID / File Hash")
            .assert_still_on_step1())
