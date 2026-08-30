"""
CRT_045 — Validate that a duplicate 'Person' Work Email is rejected.
Feature: Asset Create Manual

Note: Person creation may also hit known bug DT-3260 ("Invalid fields schema
JSON format" — see CRT_055) on the fixture create step itself. This spec is
written against the expected/intended behavior regardless.
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT045:

    @pytest.mark.regression
    @allure.title("CRT_045: duplicate Person Work Email is rejected")
    def test_person_duplicate_reject(self, asset_create_page):
        uniq = unique_suffix()
        dup_email = f"qa.dup{uniq}@example.com"

        # Fixture create — establishes the asset that will collide
        assets_page = (asset_create_page
            .select_family("Organizational & Responsibility")
            .select_type("Person")
            .fill_asset_name(f"QA Person Dup A {uniq}")
            .fill_field("Work Email", dup_email, required=True)
            .next_step()
            .create()
            .back_to_asset_manager())

        # Attempt a second create with the same identifier
        (assets_page
            .add_new()
            .select_family("Organizational & Responsibility")
            .select_type("Person")
            .fill_asset_name(f"QA Person Dup B {uniq}")
            .fill_field("Work Email", dup_email, required=True)
            .next_step()
            .create_expect_no_redirect()
            .assert_duplicate_rejected()
            .assert_url_contains("/grc/assets/create"))
