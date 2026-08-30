"""
FW_ACT_047 — Validate that a user without activation permission cannot
deactivate a framework.
Feature: Framework Activate Wizard

KNOWN BUG — fails honestly today (mirrors the pre-existing activation RBAC
gap, FW_ACT_017). Confirmed live 2026-08-04 (build dca9938158): user2's
status toggle on a framework detail page is present AND fully enabled — the
same absence of a permission gate that already affects the Activate
Framework wizard now extends to the new deactivate/reactivate control.
Asserts the REQUIRED behaviour via assert_status_toggle_hidden_or_disabled(),
so it fails honestly while the toggle stays enabled.

Fixture: Argentina Privacy Law (2018) (AOhLM73phe), Active. Deliberately
never clicks the toggle (only reads its enabled/disabled state) — to avoid
actually deactivating a shared fixture as an unprivileged user — so this
spec makes NO mutation and needs no state restoration.

Reuses the framework_detail_overview_page fixture (constructed but not
opened, per conftest) and calls open_as_normal_user() directly — same
pattern as test_fwl_024_no_permission_access_not_blocked.py /
test_fwact_017_normal_user_wizard_not_accessible.py.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT047:

    @pytest.mark.regression
    @allure.title("FW_ACT_047: Normal user cannot deactivate a framework (fails today — toggle fully enabled)")
    def test_normal_user_cannot_deactivate(self, framework_detail_overview_page):
        (framework_detail_overview_page
            .open_as_normal_user("AOhLM73phe")
            .assert_status_toggle_hidden_or_disabled())
