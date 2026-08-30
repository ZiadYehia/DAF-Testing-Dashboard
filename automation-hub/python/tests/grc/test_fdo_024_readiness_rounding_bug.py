"""
FDO_024 — Validate that Audit Readiness rounds correctly when the
in-scope clause count doesn't divide evenly (e.g. 66.67% should render as
"67%", not a raw decimal).
Feature: Framework Detail Overview (data/grc/features/framework-detail-overview)

KNOWN BUG, this test will honestly FAIL today. Confirmed live (2026-08-04)
on OD3zPmaTGK (Alaska PIPA, 9 Partial + 2 Gap of 11 in-scope = raw
40.909090909090914%) and every other non-exact-quotient fixture sampled:
the Audit Readiness field NEVER rounds — it always renders the full raw JS
float expansion instead of a whole-percent integer. There is no need for a
purpose-built 3-clause fixture (the scripted "Test Rounding Framework"
doesn't exist) — any fractional-percentage framework demonstrates the bug,
so this uses the real Alaska PIPA fixture. assertAuditReadinessRoundedToWholePercent
is built exactly for this check and fails honestly against the raw float.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Detail Overview")
class TestFDO024:

    @pytest.mark.regression
    @allure.title("FDO_024: Audit Readiness rounds correctly when the in-scope count doesn't divide evenly")
    def test_readiness_rounding_bug(self, framework_detail_overview_page):
        (framework_detail_overview_page
            .open("OD3zPmaTGK")
            .assert_audit_readiness_rounded_to_whole_percent())
