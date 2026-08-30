"""
CRT_065 — Validate that the initial page load shows the correct breadcrumb,
title, subtitle, and 'Create manually' pre-selected.
"""
import allure
import pytest


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT065:

    @pytest.mark.regression
    @allure.title("CRT_065: Create Asset page loads with correct breadcrumb, title, and defaults")
    def test_initial_page_load(self, asset_create_page):
        (asset_create_page
            .assert_breadcrumb_link("Asset Manager")
            .assert_breadcrumb_link("Create New Asset")
            .assert_heading("Create New Asset")
            .assert_create_manually_selected()
            .assert_no_default_family_or_type()
            .assert_type_specific_field_absent("Application Name"))
