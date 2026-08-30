"""
FW_ACT_008 — Validate the "Activation" callout box text and styling on
Step 2.
Feature: Framework Activate Wizard

Amber callout (`border-allendevaux-orange-500 bg-allendevaux-orange-50`)
under the "Activation" heading with the exact text: "Activating publishes the
framework into the library, and starts contributing the compliance coverage.
You can also save as draft and activate later from the framework detail
page." Note this text mentions a save-as-draft path that does not exist as a
control anywhere (see FW_ACT_002).
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT008:

    @pytest.mark.regression
    @allure.title("FW_ACT_008: Activation callout shows the exact amber-styled copy")
    def test_activation_callout_copy(self, framework_activate_wizard_page):
        (framework_activate_wizard_page
            .search("ISO 27001")
            .select_framework_card("ISO 27001 (2022)")
            .next()
            .assert_activation_callout_text())
