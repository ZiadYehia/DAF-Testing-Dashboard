"""
FW_ACT_009 — Validate that the "Search Frameworks" input filters the
framework grid dynamically by name, including entries beyond the initially
loaded page (server-side search).
Feature: Framework Activate Wizard

"ISO 21434 (2021)" was activated live via FW_ACT_001 and is therefore
excluded from results (see FW_ACT_014), so searching "ISO" returns exactly
the 9 remaining ISO-named cards below rather than the original 10 — this set
spans beyond the first loaded page of 12, confirming the search is
server-side rather than a client-side filter of only the visible cards.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT009:

    @pytest.mark.regression
    @allure.title('FW_ACT_009: "ISO" search returns exactly the 9 non-activated ISO frameworks')
    def test_search_filters_grid_server_side(self, framework_activate_wizard_page):
        (framework_activate_wizard_page
            .search("ISO")
            .assert_visible_card_names([
                "ISO 22301 (2019)",
                "ISO 27001 (2022)",
                "ISO 27002 (2022)",
                "ISO 27017 (2015)",
                "ISO 27701 (2025)",
                "ISO 29100 (2024)",
                "ISO 31000 (2018)",
                "ISO 31010 (2009)",
                "ISO 42001 (2023)",
            ]))
