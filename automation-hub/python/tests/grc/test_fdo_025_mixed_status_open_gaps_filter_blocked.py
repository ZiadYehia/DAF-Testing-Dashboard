"""
FDO_025 — Validate that the "Open Gaps (Foundational First)" list
excludes Compliant, Partial, and Not Applicable clauses when statuses are
mixed.
Feature: Framework Detail Overview (data/grc/features/framework-detail-overview)

BLOCKED — cannot be evaluated as written. Confirmed live (2026-08-04): no
real framework in the catalog has a Compliant or Not Applicable clause (see
FDO_007/FDO_010), so the scripted "Mixed Status Framework" fixture cannot
be constructed from live data — and the Coverage tab's Open Gaps list is
100% hardcoded mock content regardless (see FDO_016), disconnected from any
real framework's actual clause statuses. The body below is illustrative
only and never runs; declared via test.fixme(title, body) so ONLY this
test is skipped.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Detail Overview")
class TestFDO025:

    @pytest.mark.regression
    @pytest.mark.skip(
        reason="The scripted \"Mixed Status Framework\" fixture (Compliant + Partial + Gap + Not Applicable clauses together) does not exist in the live catalog — no framework anywhere has a Compliant or Not Applicable clause, and the Coverage tab is static mock content disconnected from any real framework's clause statuses regardless."
    )
    @allure.title("FDO_025: Open Gaps list excludes Compliant, Partial, and Not Applicable clauses when statuses are mixed (BLOCKED — no mixed-status fixture exists)")
    def test_mixed_status_open_gaps_filter_blocked(self, framework_detail_overview_page):
        (framework_detail_overview_page
            .open("PB4ERG63zE")
            .switch_to_tab("Coverage")
            .assert_open_gaps_list_excludes("A.5.1 Policies"))
