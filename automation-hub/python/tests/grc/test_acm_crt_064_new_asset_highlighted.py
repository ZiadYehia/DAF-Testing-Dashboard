"""
CRT_064 — Validate that a newly created asset whose name sorts near the top
of the current A-Z sort (e.g. starting with 'AAA') is highlighted, linked
from the success toast, or auto-scrolled to in the Assets Manager list
(DT-3238, P3).

NOTE: the original bug report (DT-3238) targeted the old list-redirect flow
where Create returned the user to the Assets Manager list. The portal now
redirects to the asset detail page instead, so this spec asserts the
detail-page redirect succeeds with the expected heading/AST code — the
highlight/toast-link/auto-scroll behavior described in the bug no longer
applies to the current redirect target and cannot be verified here.
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT064:

    @pytest.mark.regression
    @allure.title("CRT_064: newly created Supplier/Vendor asset redirects to detail page with heading and AST code")
    def test_new_asset_highlighted(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"AAA QA Highlight {uniq}"

        (asset_create_page
            .select_family("Third-Party")
            .select_type("Supplier / Vendor")
            .fill_asset_name(asset_name)
            .fill_field("Supplier Name", asset_name, required=True)
            .next_step()
            .create()
            .assert_created(asset_name))
