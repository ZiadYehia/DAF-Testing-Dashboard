"""
FWC_007 — Validate that clicking the chevron next to a domain
expands/collapses its nested clauses and updates the chevron icon.
Feature: Framework Clause Detail

Confirmed live (2026-08-03/04, build a146218221): the domain/clause tree is a
PrimeVue single-expand accordion — the chevron carries a -rotate-90 class
while collapsed and no rotate class while expanded. Forces DMY.2 to a known
collapsed state first (rather than assuming the page's default expand
state), then exercises the full expand -> collapse cycle and confirms
single-expand behavior along the way.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Clause Detail")
class TestFWC007:

    @pytest.mark.regression
    @allure.title("FWC_007: Domain chevron expands/collapses nested clauses and updates icon state")
    def test_domain_chevron_expand_collapse(self, framework_clause_detail_page):
        (framework_clause_detail_page
            .open("PB4ERG63zE")
            .collapse_domain("DMY.2")
            .assert_domain_collapsed("DMY.2")
            .expand_domain("DMY.2")
            .assert_domain_expanded("DMY.2")
            .assert_only_domain_expanded("DMY.2")
            .collapse_domain("DMY.2")
            .assert_domain_collapsed("DMY.2"))
