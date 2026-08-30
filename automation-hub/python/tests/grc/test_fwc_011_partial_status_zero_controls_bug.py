"""
FWC_011 — Validate that a clause with mapped control(s) but all are <80%
effectiveness or not Active is correctly displayed as "Partial".
Feature: Framework Clause Detail

KNOWN BUG, this test will honestly FAIL today. FW_FR_CLAUSE_03 requires a
"Partial" clause to have at least one mapped-but-substandard control — i.e.
>=1 mapped control card must render. Confirmed live (2026-08-03/04, build
a146218221) on DMY.1.1 (Partial): the Mapped Controls section renders ZERO
control cards, not one. Every one of the 9 Partial clauses checked across
all 3 non-empty frameworks shows this same zero-control "Partial" status,
which is itself a data-integrity defect distinct from the missing-fixture
problem covered by FWC_003/FWC_013/FWC_022/FWC_027 — this spec asserts the
REQUIRED >=1-mapped-control business rule directly, so it fails while a
Partial clause with zero mapped controls exists.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Clause Detail")
class TestFWC011:

    @pytest.mark.regression
    @allure.title("FWC_011: Partial clause must have at least one mapped control (currently has zero — data-integrity bug)")
    def test_partial_status_zero_controls_bug(self, framework_clause_detail_page):
        (framework_clause_detail_page
            .open("PB4ERG63zE")
            .expand_domain("DMY.1")
            .select_clause("DMY.1.1")
            .assert_mapped_controls_header_visible()
            .assert_mapped_controls_count(1))
