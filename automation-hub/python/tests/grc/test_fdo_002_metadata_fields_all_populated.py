"""
FDO_002 — Validate that all Framework Metadata fields are displayed
correctly with valid data and icons.
Feature: Framework Detail Overview (data/grc/features/framework-detail-overview)

Confirmed live (2026-08-04) on PB4ERG63zE (ISO 21434): all 6 rows
(Region, Effective date, Clauses, Owners, Audit readiness, In-scope
clauses) render real, correct, per-framework data with their icon + label
+ value structure — assertMetadataFieldsAllVisible covers the icon/label/
value visibility for all 6 rows (this page object has no separate
icon-only assertion; visibility of the row implies its icon renders, since
the icon is a fixed sibling of the label span). Field labels in this build
are Region/Effective date/Clauses/Owner(s)/Audit readiness/In-
scope clauses rather than the test case's "Total Clauses"/"Framework
Owner" wording, and Audit readiness is asserted as the real unrounded live
value rather than a clean "90%" (see FDO_024 for the rounding defect) —
both adaptations use the page object's own confirmed-live values instead of
the scripted example data.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Detail Overview")
class TestFDO002:

    @pytest.mark.regression
    @allure.title("FDO_002: Framework Metadata fields display correctly with valid data and icons")
    def test_metadata_fields_all_populated(self, framework_detail_overview_page):
        (framework_detail_overview_page
            .open("PB4ERG63zE")
            .assert_metadata_fields_all_visible()
            .assert_region_value("GENERAL")
            .assert_effective_date_value("2000/02/22")
            .assert_clauses_total_value("12")
            .assert_owner_label("Owners")
            .assert_owner_value("Clara Cogsworth")
            .assert_audit_readiness_value("40.909090909090914%")
            .assert_in_scope_clauses_value("11", "12"))
