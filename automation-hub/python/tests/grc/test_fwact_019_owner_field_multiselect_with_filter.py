"""
FW_ACT_019 — Validate that the "Framework Owners" field on Step 2 shows the
correct plural label and placeholder, and opens a multi-select checkbox list
with its own filter input.
Feature: Framework Activate Wizard

Confirmed as specified live (2026-07-29): label reads "Framework Owners"
(plural), placeholder reads "Select Framework Owners", and opening the field
renders a PrimeVue MultiSelect overlay (.p-multiselect-overlay) with 219
directory-user options (each its own checkbox) plus a filter input in the
overlay header — satisfying the FW_FR_ACTIVATE_03 type-ahead requirement.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT019:

    @pytest.mark.regression
    @allure.title("FW_ACT_019: Framework Owners field is a plural-labeled multi-select with a filter input")
    def test_owner_field_multiselect_with_filter(self, framework_activate_wizard_page):
        (framework_activate_wizard_page
            .search("ISO 27001")
            .select_framework_card("ISO 27001 (2022)")
            .next()
            .assert_owner_label_is_plural()
            .assert_owner_placeholder("Select Framework Owners")
            .open_owner_picker()
            .assert_owner_picker_is_multi_select_with_checkboxes()
            .assert_owner_picker_has_filter_input()
            .assert_owner_option_count_at_least(200))
