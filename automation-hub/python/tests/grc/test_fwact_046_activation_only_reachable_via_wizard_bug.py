"""
FW_ACT_046 — Validate that activation is only reachable through the Activate
Framework wizard.
Feature: Framework Activate Wizard

KNOWN BUG — fails honestly today. Confirmed live 2026-08-04 (build
dca9938158): the new detail-page status toggle activates ANY Inactive
framework directly — including one that has never been through the wizard
at all — with zero owners, completely bypassing the wizard and its owner
step. Reproduced on Belgium Privacy Law (QJuSzjJZoC), a fixture that had
never been activated by any prior automated or manual pass: opening its
detail page and clicking the toggle flips it straight to Active.

This asserts the REQUIRED behaviour — a never-activated framework's
detail-page toggle should be disabled/hidden, forcing activation through the
wizard — via assert_status_toggle_hidden_or_disabled(), so it fails honestly
while the toggle stays fully enabled.

Deliberately never clicks the toggle (only reads its enabled/disabled
state), so this spec makes NO mutation and needs no state restoration.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT046:

    @pytest.mark.regression
    @allure.title("FW_ACT_046: Activation is only reachable through the wizard (fails today — direct toggle bypass)")
    def test_activation_only_reachable_via_wizard(self, framework_detail_overview_page):
        (framework_detail_overview_page
            .open("QJuSzjJZoC")
            .assert_status_toggle_hidden_or_disabled())
