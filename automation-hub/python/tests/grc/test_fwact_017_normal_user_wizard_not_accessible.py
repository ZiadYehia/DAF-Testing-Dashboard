"""
FW_ACT_017 — Validate that a "Normal user" role cannot access the Activate
Framework wizard entry point.
Feature: Framework Activate Wizard

KNOWN BUG — fails honestly today (P1): live investigation (2026-07-29)
confirmed a Normal user (user2@example.com) gets the FULL wizard with
nothing hidden, disabled, or 403'd when navigating directly to
/grc/frameworks/activate. This test asserts the REQUIRED behavior (wizard
inaccessible) via assert_wizard_not_accessible(), so it fails while the RBAC
gap is open — a red run here is expected until the gap is fixed.
The same session also enumerated all 219 directory users
(opening the owner picker as this same user).
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT017:

    @pytest.mark.regression
    @allure.title("FW_ACT_017: Normal user cannot access the Activate Framework wizard")
    def test_normal_user_wizard_not_accessible(self, framework_activate_wizard_page):
        framework_activate_wizard_page.open_as_normal_user().assert_wizard_not_accessible()
