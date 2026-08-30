"""
FDO_008 — Validate that Audit Readiness shows 0% when all in-scope
clauses are in "Gap" status.
Feature: Framework Detail Overview (data/grc/features/framework-detail-overview)

BLOCKED — cannot be evaluated as written. The formula is confirmed
correct via independent verification against the Clauses and Mappings
tab's Partial/Gap filter counts (see FDO_009), so a genuine all-Gap
fixture WOULD show 0% — but no such fixture (0 Partial, 100% Gap) exists
anywhere in the sampled catalog; the only 0% case observed live
(fwXOGmGxko, the Draft) is a 0/0 zero-clause edge case, not a real
all-Gap in-scope set. The body below is illustrative only and never runs;
declared via test.fixme(title, body) so ONLY this test is skipped.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Detail Overview")
class TestFDO008:

    @pytest.mark.regression
    @pytest.mark.skip(
        reason="No all-Gap (0 Partial, 0 Compliant) fixture exists in the catalog to independently prove a genuine, non-coincidental 0% reading — every sampled non-Draft fixture has a mix of Partial and Gap."
    )
    @allure.title("FDO_008: Audit Readiness shows 0% when all in-scope clauses are Gap (BLOCKED — no all-Gap fixture exists)")
    def test_all_gap_0_percent_blocked(self, framework_detail_overview_page):
        (framework_detail_overview_page
            .open("PB4ERG63zE")
            .assert_audit_readiness_value("0%"))
