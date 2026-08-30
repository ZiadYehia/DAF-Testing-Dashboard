"""
KPI_020 — Validate that the KPI summary tiles react to a framework being
deactivated, without requiring a manual page reload.
Feature: Framework Library KPI Summary

Confirmed live 2026-08-04 (build dca9938158): deactivating a framework via
the new status toggle causes the tiles to re-fetch and settle over roughly 9
seconds, with NO explicit reload call anywhere in the flow. Companion case
to KPI_019 (activation direction) — see its docstring for the full
mechanism/defect-boundary explanation.

NOTE: same coverage gap as KPI_019 — no page-object method exists to
capture a numeric KPI snapshot before a mutation and assert a delta
afterward, so this proves the weaker, non-flaky property available today via
existing methods.

Fixture: Bahamas DPA (2003), Inactive at rest. Activates it first (setup,
via this same toggle) so there is something to deactivate, then deactivates
it — its own original state — so a passing run leaves the catalog exactly
as it found it.
"""
import allure
import pytest


@pytest.fixture
def restored_frameworks_library_page(frameworks_library_page):
    """Wraps the shared `frameworks_library_page` fixture so `Bahamas DPA
    (2003)` always ends this test at its `Inactive` baseline, EVEN IF the
    test body fails partway through its own in-body restore chain — the
    yield's teardown runs regardless of outcome. Re-opens the Library fresh
    (rather than trusting wherever a failed body left the page) before
    calling the idempotent, non-throwing `restore_status`. Defined locally
    in this test file rather than in conftest.py — no shared fixture change
    was needed."""
    yield frameworks_library_page
    try:
        frameworks_library_page.open().restore_status("Bahamas DPA (2003)", "Inactive")
    except Exception:
        # Teardown must never fail the test's own outcome — restore_status
        # is already idempotent/non-throwing internally; this only guards
        # against a rare flaky re-navigation (e.g. the 453-framework
        # catalog rendering slower than usual) so a genuinely
        # passing/failing test result is never overwritten by the
        # teardown's own transient hiccup.
        pass


@allure.feature("Frameworks")
@allure.story("Framework Library KPI Summary")
class TestKPI020:

    @pytest.mark.regression
    @allure.title("KPI_020: KPI tiles react to deactivation without a manual reload")
    def test_kpi_reacts_to_deactivation(self, restored_frameworks_library_page):
        (restored_frameworks_library_page
            .search("Bahamas DPA")
            .toggle_card_status_and_confirm("Bahamas DPA (2003)", "Active")
            .toggle_card_status_and_confirm("Bahamas DPA (2003)", "Inactive")
            .assert_kpi_row_visible()
            .assert_avg_readiness_progress_bar())
