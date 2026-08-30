"""
FWL_023 — Validate that a user only sees frameworks belonging to their own
tenant, rather than the entire platform-wide catalog.
Feature: Frameworks Library

BLOCKED — not verifiable in this environment, so it is skipped rather than
asserted. Tenant scoping can only be proven by showing identity A sees
framework X while identity B does not, and there is no second-tenant fixture
here: every available credential resolves to the same catalog.

What IS established (live 2026-08-03, build a146218221) is recorded on the
DT-3168 access-control bug and asserted directly by FWL_024:
user2@example.com (Normal user) sees the identical KPI values
(453/47/6/16.55%) and the identical 50-card grid as user1@example.com
(Admin), with no scoping applied.

It deliberately does NOT assert an invented "scoped" figure. An earlier draft
asserted KPIs of 0/0/0/0% purely because that differs from today's values — a
test that fails against a made-up number proves nothing, and would pass for
the wrong reason the moment the app showed zeros for any other cause.

To unblock: seed a framework owned by a second tenant, then assert the first
tenant's user cannot see it. assert_card_not_visible already exists for that.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Frameworks Library")
class TestFWL023:

    @pytest.mark.regression
    @pytest.mark.skip(reason="No second-tenant fixture exists, so tenant scoping cannot be proven either way. See FWL_024 for the access-control assertion that IS checkable.")
    @allure.title("FWL_023: a user sees only their own tenant's frameworks")
    def test_tenant_scoping_not_enforced(self, frameworks_library_page):
        (frameworks_library_page
            .open_as_normal_user()
            .assert_card_not_visible("<second-tenant framework>"))
