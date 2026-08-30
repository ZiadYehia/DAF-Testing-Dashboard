"""
CRT_066 — Validate that the Asset Family dropdown lists all 10 families in
alphabetical order with no default.
"""
import allure
import pytest


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT066:

    @pytest.mark.regression
    @allure.title("CRT_066: Asset Family dropdown lists all 10 families in alphabetical order")
    def test_family_dropdown_order(self, asset_create_page):
        expected_families = [
            "Evidence",
            "Governance & Compliance",
            "Legal & Contractual",
            "Organizational & Responsibility",
            "Physical",
            "Privacy",
            "Security Operations",
            "Technology & Digital",
            "Third-Party",
            "Trust & Public",
        ]

        # MISSING: AssetCreatePage.assert_family_options_order(expected) not yet implemented.
        (asset_create_page
            .assert_family_options_order(expected_families))
