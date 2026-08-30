"""
CRT_061 — Validate that fields specific to the 'Control' asset type
(Governance & Compliance family) — e.g. "Control Description" / "Notes" —
cap input at the backend's max character limit instead of accepting an
unbounded value.
Bug: DT-3337

KNOWN RED: this spec is designed to fail today (DT-3337 is unresolved) — the
assertion below encodes the bug-free expectation, not current behavior.
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT061:

    @pytest.mark.regression
    @pytest.mark.xfail(reason="DT-3337", strict=False)
    @allure.title("CRT_061: Control over-length fields capped at backend max length")
    def test_control_overlength_fields_capped(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Long Control {uniq}"
        over_long = "X" * 500

        # UNVERIFIED: 'Control Description' vs 'Notes' may be a single combined field —
        # targeting 'Control Description' as the primary field under test.
        #
        # Assert capping: frontend should truncate to the backend's max length, so the
        # resulting value must be shorter than the 500-char string we attempted to paste.
        #
        # Step 2 / Create intentionally not exercised — this assertion is about
        # Step-1 frontend capping only.
        (asset_create_page
            .select_family("Governance & Compliance")
            .select_type("Control")
            .fill_asset_name(asset_name)
            .fill_field("Control Code", f"CTRL-QA-LONG-{uniq}", required=True)
            .fill_field("Control Description", over_long, required=False)
            .assert_input_capped_below("Control Description", 500, required=False))
