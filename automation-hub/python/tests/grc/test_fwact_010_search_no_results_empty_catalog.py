"""
FW_ACT_010 — Validate that searching for a non-existent framework displays
the exact "No results found!" empty state.
Feature: Framework Activate Wizard

Exact copy (`h4` + `p`): "No results found!" / "We couldn't find any matches
for your search. Try adjusting your search terms" — NOT "No frameworks match
your search.", a stale assertion from an earlier version of this test that
does not exist anywhere in the live app.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT010:

    @pytest.mark.regression
    @allure.title('FW_ACT_010: Searching a non-existent framework shows "No results found!"')
    def test_search_no_results_empty_catalog(self, framework_activate_wizard_page):
        (framework_activate_wizard_page
            .search("NonExistentFrameworkXYZ123")
            .assert_empty_state_message())
