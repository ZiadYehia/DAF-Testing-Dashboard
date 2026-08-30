"""
FWC_022 — Validate that each mapped control card accurately displays Control
ID (linked), mapping type, applicability, name, owner, effectiveness %, and
evidence count.
Feature: Framework Clause Detail

BLOCKED — cannot be evaluated as written. Confirmed live (2026-08-03/04,
build a146218221): no clause anywhere (11 clauses, 3 non-empty frameworks)
has a mapped control card to inspect — every Mapped Controls section renders
only the heading and the + Propose Mapping button. There is no live element
for any of the fields (Control ID link, mapping type, applicability, name,
owner, effectiveness %, evidence count) to assert against. The body below is
illustrative only and never runs.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Clause Detail")
class TestFWC022:

    @pytest.mark.regression
    @pytest.mark.skip(
        reason="No clause anywhere has a mapped control card — every Mapped Controls section renders only "
        "the heading and the + Propose Mapping button, with no fields to assert against."
    )
    @allure.title("FWC_022: Mapped control card displays all required fields (BLOCKED — no clause anywhere has a mapped control card)")
    def test_mapped_control_card_fields_blocked(self, framework_clause_detail_page):
        (framework_clause_detail_page
            .open("PB4ERG63zE")
            .expand_domain("DMY.1")
            .select_clause("DMY.1.1")
            .assert_mapped_control_card(
                "CTL-G",
                "Primary",
                "Applicable",
                "Access Control Policy Enforcement",
                "Michael",
                90,
                5,
            ))
