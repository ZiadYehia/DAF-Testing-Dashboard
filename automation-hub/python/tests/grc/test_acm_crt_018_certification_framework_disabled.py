"""
CRT_018 — Certification Framework dropdown is disabled (by design, pending
Frameworks module).
"""
import allure
import pytest


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT018:

    @pytest.mark.regression
    @allure.title("CRT_018: Certification Framework dropdown is disabled (by design, pending Frameworks module)")
    def test_certification_framework_disabled(self, asset_create_page):
        (asset_create_page
            .select_family("Trust & Public")
            .select_type("Certification")
            .assert_dropdown_disabled("Select Framework"))
