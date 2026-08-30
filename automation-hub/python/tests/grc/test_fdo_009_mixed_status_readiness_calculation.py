"""
FDO_009 — Validate that Audit Readiness calculates correctly with a mix
of clause statuses.
Feature: Framework Detail Overview (data/grc/features/framework-detail-overview)

The scripted "SOC 2" fixture (5 Compliant/2 Partial/3 Gap = 60%) does not
exist in the live catalog — no framework anywhere in the 453-record catalog
has any Compliant/Implemented clause (see FDO_007/FDO_008). Substituted
with the real APEC Privacy Framework fixture (bSO72UIlmZ, 10 Partial + 1
Gap of 11 in-scope), whose readiness was independently verified against the
Clauses and Mappings tab's own Partial/Gap filter counts: (10*50 + 1*0)/11
= 45.45454545454545%, confirmed live to exactly match this page's Audit
Readiness value — proof the formula is genuinely computed from real
per-framework data, not hardcoded.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Detail Overview")
class TestFDO009:

    @pytest.mark.regression
    @allure.title("FDO_009: Audit Readiness calculates correctly with mixed clause statuses")
    def test_mixed_status_readiness_calculation(self, framework_detail_overview_page):
        (framework_detail_overview_page
            .open("bSO72UIlmZ")
            .assert_audit_readiness_value("45.45454545454545%")
            .assert_in_scope_clauses_value("11", "12"))
