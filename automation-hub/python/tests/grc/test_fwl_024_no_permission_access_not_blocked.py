"""
FWL_024 — Validate that a user without "Framework View" permission cannot
access the Frameworks Library page or its Activate action.
Feature: Frameworks Library

KNOWN BUG — fails honestly today (P1). Confirmed live (2026-08-03, build
a146218221): user2@example.com (Normal user, assumed not to hold "Framework
View") loads /grc/frameworks fully — no access-denied message, no redirect —
and the "Activate Framework" button is visible AND enabled (disabled: false,
aria-disabled: null). This reconfirms the same P1 RBAC gap already on record
for the Activate Framework wizard itself (FW_ACT_017) at the Library entry
point. This test asserts the REQUIRED behavior (blocked page, hidden/
disabled Activate action), so it fails while that gap is open.

Uses the frameworks_library_page fixture (already logged in as Admin) and
immediately re-logs-in as the Normal-user credential via
open_as_normal_user() — same pattern as test_fwl_023_tenant_scoping_not_
enforced.py and test_fwact_017_normal_user_wizard_not_accessible.py.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Frameworks Library")
class TestFWL024:

    @pytest.mark.regression
    @pytest.mark.xfail(reason="Normal user loads the full Library with an enabled Activate button — no RBAC gate", strict=False)
    @allure.title("FWL_024: User without Framework View permission is blocked from the Library and its Activate action")
    def test_no_permission_access_not_blocked(self, frameworks_library_page):
        (frameworks_library_page
            .open_as_normal_user()
            .assert_access_denied()
            .assert_activate_button_hidden_or_disabled())
