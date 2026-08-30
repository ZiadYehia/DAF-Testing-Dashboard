"""
FWC_001 — Validate that navigating to the "Clauses and mappings" tab
displays the left panel with domains/clauses and the right panel's default
empty-selection message.
Feature: Framework Clause Detail

Confirmed live (2026-08-03/04, build a146218221): on a framework that
actually HAS clauses, the FIRST clause of the FIRST domain auto-selects on
cold load, so the right panel's "Select a clause to view its details"
message never renders — the test case's original premise (clauses exist AND
the empty message shows) is internally contradictory on every non-empty
fixture in this build. The two halves genuinely co-exist only on a framework
with literally zero clauses, so this spec is pinned to the Draft fixture
fwXOGmGxko — the same one FWC_020 uses for its "No domains" copy, but this
test focuses on the general two-panel layout loading (heading, search box,
status filter) plus the right panel's default message, not the specific
"No domains" empty-state text (that's FWC_020's job).
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Clause Detail")
class TestFWC001:

    @pytest.mark.regression
    @allure.title("FWC_001: Clauses and Mappings tab loads two-panel layout with default empty-selection message")
    def test_tab_loads_two_panel_empty_selection(self, framework_clause_detail_page):
        (framework_clause_detail_page
            .open("fwXOGmGxko")
            .assert_two_panel_layout_visible()
            .assert_select_clause_message_visible())
