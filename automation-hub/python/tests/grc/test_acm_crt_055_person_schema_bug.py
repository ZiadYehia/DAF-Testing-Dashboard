"""
CRT_055 — Validate that a 'Person' asset can be created successfully without
the "Invalid fields schema JSON format" error (DT-3260). Testing the Person
asset type is sufficient to cover this regression across the affected types
(Person / Cloud Service / Vulnerability).
Feature: Asset Create Manual
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT055:

    @pytest.mark.regression
    @pytest.mark.xfail(reason="DT-3260", strict=False)
    @allure.title("CRT_055: Person asset created successfully (schema bug DT-3260)")
    def test_person_schema_bug_create(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Schema Bug Person {uniq}"

        # Step 2 intentionally left blank; portal redirects to the asset
        # detail page with a generated AST code when the create succeeds.
        (asset_create_page
            .select_family("Organizational & Responsibility")
            .select_type("Person")
            .fill_asset_name(asset_name)
            .fill_field("Work Email", f"qa.schemabug{uniq}@example.com", required=True)
            .next_step()
            .create()
            .assert_created(asset_name))
