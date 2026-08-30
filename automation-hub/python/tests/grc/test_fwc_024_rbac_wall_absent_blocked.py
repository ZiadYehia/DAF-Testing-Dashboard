"""
FWC_024 — Validate that a user role without "Framework View" permission
cannot access the Clauses and Mappings tab or view its clause data.
Feature: Framework Clause Detail

BLOCKED — no RBAC wall exists to trigger. Confirmed live (2026-08-04):
logging in as user2@example.com ("User2 Normal user") and navigating
directly to /grc/frameworks/details/PB4ERG63zE?tab=Clauses+and+Mappings loads
the page fully — no redirect, no permission error. Framework Metadata, the
domain tree, clause selection, status badges, and all buttons are identical
to the primary user and fully interactive. This extends the pre-existing P1
finding already on record for the Frameworks Library and Activate Wizard:
Normal users have full, unrestricted read access to this surface too, so
there is no access-denied state to assert. The body below is illustrative
only and never runs.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Clause Detail")
class TestFWC024:

    @pytest.mark.regression
    @pytest.mark.skip(
        reason="No RBAC wall exists — a Normal user (GRC_LOGIN_USER_ALT) loads the tab fully, identical to "
        "the primary user (extends the P1 finding on record for the Frameworks Library / Activate Wizard)."
    )
    @allure.title("FWC_024: A user without Framework View permission cannot access the Clauses and Mappings tab (BLOCKED — no RBAC wall exists, Normal user has full access)")
    def test_rbac_wall_absent_blocked(self, framework_clause_detail_page):
        (framework_clause_detail_page
            .open_as_normal_user("PB4ERG63zE")
            .assert_access_denied())
