"""
KPI_016 — Validate that a user with the 'Salesman' role cannot view the
Framework Library KPI Summary (design-only, RBAC not yet implemented).
Feature: Framework Library KPI Summary

BLOCKED — cannot be evaluated as written. Confirmed live (2026-08-03, build
a146218221): all three Salesman-persona DummyOIDC demo accounts, across
three separate tenants (sammy.sales@ionia.dusr..., peter.sellers@noxus.dusr...,
victor.merchant@piltover.dusr...), fail to authenticate into this GRC portal
at all — each redirects to /login-failed?message=Error:%20User%20identified,
%20but%20no%20account%20found. None of them ever reaches /grc/frameworks or
the KPI row, so there is no page on which to observe whether the row is
absent or disabled. This is stronger than "the KPI row is absent" (which
would imply the user reached the page) — the user cannot reach the page,
full stop. No page-object method exists (and per this suite's
page-object-only rule, none can be added here) to drive a login that ends in
this failure state. The body below is illustrative only and never runs.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Library KPI Summary")
class TestKPI016:

    @pytest.mark.regression
    @pytest.mark.skip(
        reason="All 3 Salesman-persona demo accounts (3 different tenants) fail OIDC authentication "
        "entirely ('User identified, but no account found') — no page is ever reached to observe the KPI row."
    )
    @allure.title("KPI_016: A 'Salesman'-role user cannot view the Framework Library KPI Summary (BLOCKED — all 3 Salesman demo accounts fail authentication entirely)")
    def test_salesman_role_blocked(self, frameworks_library_page):
        frameworks_library_page.assert_kpi_row_visible()
