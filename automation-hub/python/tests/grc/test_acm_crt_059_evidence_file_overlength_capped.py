"""
CRT_059 — Validate that the Asset Name, System File ID / File Hash, Evidence
Type, and Notes & Links fields for an 'Evidence File' asset cap input at the
backend's max length instead of accepting an over-length value that the
backend later rejects (DT-3333). No frontend `maxlength` cap exists today.

KNOWN RED: this spec is designed to fail today (DT-3333 is unresolved) — the
assertions below encode the bug-free expectation, not current behavior.
"""
import allure
import pytest


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT059:

    @pytest.mark.regression
    @pytest.mark.xfail(reason="DT-3333", strict=False)
    @allure.title("CRT_059: Evidence File over-length input capped on Asset Name/System File ID/Evidence Type/Notes (DT-3333)")
    def test_evidence_file_overlength_fields_capped(self, asset_create_page):
        over_long = "X" * 500

        # Expected (bug-free) behavior: the frontend caps each field at the
        # backend's max length, so the actual value after "typing" 500
        # characters is shorter than 500 — never accepts the full
        # over-length string.
        # Assertion is purely about frontend capping while on Step 1 — do not
        # advance to Next/Create.
        (asset_create_page
            .select_family("Evidence")
            .select_type("Evidence File")
            .fill_asset_name(over_long)
            .fill_field("System File ID / File Hash", over_long, required=True)
            .fill_field("Evidence Type", over_long, required=False)
            .fill_field("Notes & Links", over_long, required=False)
            .assert_input_capped_below("Asset Name", 500, required=True)
            .assert_input_capped_below("System File ID / File Hash", 500, required=True)
            .assert_input_capped_below("Evidence Type", 500, required=False)
            .assert_input_capped_below("Notes & Links", 500, required=False))
