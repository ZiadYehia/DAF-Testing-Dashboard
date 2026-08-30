"""
CRT_060 — Validate that the 'Scan Execution ID *' field for a 'Scan / Test
Result' asset (Evidence family) stops accepting input at 100 characters
instead of only surfacing an inline "Must be at most 100 characters" error
on Next (DT-3336).
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT060:

    @pytest.mark.regression
    @pytest.mark.xfail(reason="DT-3336", strict=False)
    @allure.title("CRT_060: Scan/Test Result — Scan Execution ID capped at 100 chars (DT-3336)")
    def test_scan_execution_id_capped(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Long Scan ID {uniq}"
        over_long = "A" * 110

        # Expected (bug-free) behavior: the field stops accepting input at 100
        # characters (frontend maxlength), so the actual value length is <= 100.
        # Assertion is about the field's value immediately after fill, on Step 1 —
        # do not advance to Next.
        (asset_create_page
            .select_family("Evidence")
            .select_type("Scan / Test Result")
            .fill_asset_name(asset_name)
            .fill_field("Scan Execution ID", over_long, required=True)
            .assert_input_max_length("Scan Execution ID", 100, required=True))
