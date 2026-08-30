"""
CRT_007 — Validate that a 'Person' asset can be created with only its
required field filled and Step 2 left blank.
Feature: Asset Create Manual

Known backend bug DT-3260 may cause this submission to fail with an
'Invalid fields schema JSON format' error; per the test case's Expected
column this spec asserts SUCCESS.
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT007:

    @pytest.mark.regression
    @allure.title("CRT_007: Person asset created with required fields only")
    def test_person_minimal_create(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Person {uniq}"
        work_email = f"qa.person{uniq}@example.com"
        (asset_create_page
            .select_family("Organizational & Responsibility")
            .select_type("Person")
            .fill_asset_name(asset_name)
            .fill_field("Work Email", work_email)
            .next_step()
            .create()
            .assert_created(asset_name)
            .assert_field("Work Email", work_email))
