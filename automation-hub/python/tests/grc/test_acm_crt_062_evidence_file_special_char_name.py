"""
CRT_062 — Validate that an 'Evidence File' asset can be created with Asset Name
'@@@@@' without a Wazuh security-monitoring buffer-overflow false positive
blocking creation.
Bug: DT-3334 (P1)

Asset Name is intentionally NOT unique-suffixed — the literal '@@@@@' string is
the bug repro. Uniqueness constraint is enforced on System File ID / File Hash,
which is suffixed instead.
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT062:

    @pytest.mark.regression
    @pytest.mark.xfail(reason="DT-3334", strict=False)
    @allure.title("CRT_062: Evidence File asset created with special-char Asset Name '@@@@@'")
    def test_evidence_file_special_char_name(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = "@@@@@"

        # Created: portal redirects to the asset detail page with a generated
        # AST code, and no Wazuh false-positive block prevents creation of the
        # '@@@@@' asset name.
        (asset_create_page
            .select_family("Evidence")
            .select_type("Evidence File")
            .fill_asset_name(asset_name)
            .fill_field("System File ID / File Hash", f"EF-HASH-SPECIALCHAR-{uniq}", required=True)
            .next_step()
            .create()
            .assert_created(asset_name))
