"""
FDO_010 — Validate that Not Applicable clauses are excluded from Audit
Readiness and In-Scope Clauses calculation.
Feature: Framework Detail Overview (data/grc/features/framework-detail-overview)

BLOCKED — cannot be evaluated as written. Confirmed live (2026-08-04): no
clause with a "Not Applicable" status was observed on any of the 3
non-empty frameworks checked (all in-scope clauses are Partial or Gap) —
there is no way to independently verify the exclusion behavior against real
data. The scripted "HIPAA" 12-total/10-in-scope fixture does not exist. The
body below is illustrative only and never runs; declared via
test.fixme(title, body) so ONLY this test is skipped.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Detail Overview")
class TestFDO010:

    @pytest.mark.regression
    @pytest.mark.skip(
        reason="No clause anywhere in the sampled catalog was observed with a \"Not Applicable\" status live, so the NA-exclusion behavior can't be independently proven or disproven against any real fixture."
    )
    @allure.title("FDO_010: Not Applicable clauses are excluded from Audit Readiness and In-Scope Clauses (BLOCKED — no NA-tagged fixture exists)")
    def test_not_applicable_excluded_blocked(self, framework_detail_overview_page):
        (framework_detail_overview_page
            .open("PB4ERG63zE")
            .assert_in_scope_clauses_value("10", "12"))
