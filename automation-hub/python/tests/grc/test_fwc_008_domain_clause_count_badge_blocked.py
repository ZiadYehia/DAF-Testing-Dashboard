"""
FWC_008 — Validate that the domain's right-aligned badge accurately displays
the count of clauses within that domain.
Feature: Framework Clause Detail

BLOCKED — the feature this case tests does not exist. Confirmed live
(2026-08-03/04, build a146218221) by dumping the raw outerHTML of every
.p-accordionheader button across all 3 domains on all 3 non-empty frameworks
checked: there is no badge element, no number, nothing right-aligned on any
domain header, at any filter state. FW_FR_CLAUSE_01 requires this feature to
exist; since it doesn't, there is no "badge count" to assert against. The
body below illustrates the closest available proof — asserting the badge's
absence via assert_no_domain_count_badge — rather than a genuine count
assertion, which has no live element to target.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Clause Detail")
class TestFWC008:

    @pytest.mark.regression
    @pytest.mark.skip(
        reason="No domain header renders a clause-count badge at all (confirmed via raw outerHTML dump of "
        "every accordion header) — there is no badge count to assert against."
    )
    @allure.title("FWC_008: Domain header badge accurately reflects its clause count (BLOCKED — no clause-count badge exists on any domain header)")
    def test_domain_clause_count_badge_blocked(self, framework_clause_detail_page):
        (framework_clause_detail_page
            .open("PB4ERG63zE")
            .expand_domain("DMY.1")
            .assert_no_domain_count_badge("DMY.1"))
