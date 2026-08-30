"""
CRT_039 — Validate that a duplicate 'Evidence File' System File ID / File Hash
is rejected.
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT039:

    @pytest.mark.regression
    @allure.title("CRT_039: duplicate Evidence File System File ID / File Hash is rejected")
    def test_evidence_file_duplicate_reject(self, asset_create_page):
        uniq = unique_suffix()
        dup_id = f"EF-HASH-DUP-{uniq}"

        # Fixture create — establishes the asset that will collide
        assets_page = (asset_create_page
            .select_family("Evidence")
            .select_type("Evidence File")
            .fill_asset_name(f"QA Evidence File Dup A {uniq}")
            .fill_field("System File ID / File Hash", dup_id, required=True)
            .next_step()
            .create()
            .go_to_asset_manager())

        # Attempt a second create with the same identifier
        (assets_page
            .add_new()
            .select_family("Evidence")
            .select_type("Evidence File")
            .fill_asset_name(f"QA Evidence File Dup B {uniq}")
            .fill_field("System File ID / File Hash", dup_id, required=True)
            .next_step()
            .create_expect_no_redirect()
            .assert_duplicate_rejected()
            .assert_create_url_retained())
