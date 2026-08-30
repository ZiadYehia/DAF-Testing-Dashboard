"""
CRT_058 — Validate that a 'Person' asset cannot advance past Step 1 with a
malformed 'Work Email'. Known bug DT-3296: the portal currently accepts and
saves malformed email addresses without format validation.
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT058:

    @pytest.mark.regression
    @pytest.mark.xfail(reason="DT-3296", strict=False)
    @allure.title("CRT_058: Person asset with invalid Work Email is rejected")
    def test_person_invalid_work_email_rejected(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Bad Email Person {uniq}"

        # Bug-free expectation: the malformed Work Email must be rejected — the
        # wizard must not advance past Step 1 / the create flow.
        (asset_create_page
            .select_family("Organizational & Responsibility")
            .select_type("Person")
            .fill_asset_name(asset_name)
            .fill_field("Work Email", "not-an-email", required=True)
            .next_step_expect_blocked()
            .assert_still_on_step1())
