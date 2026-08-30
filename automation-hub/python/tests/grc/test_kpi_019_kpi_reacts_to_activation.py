"""
KPI_019 — Validate that the KPI summary tiles react to a framework being
activated, without requiring a manual page reload.
Feature: Framework Library KPI Summary

Confirmed live 2026-08-04 (build dca9938158): activating/deactivating a
framework via the new status toggle causes the tiles to re-fetch and settle
over roughly 9 seconds, with NO explicit reload call anywhere in the flow
(toggle_card_status_and_confirm never reloads the page — its own internal
poll is the only wait involved). This is a DIFFERENT, working code path from
the previously-filed FW_FR_KPI_SUMMARY_05 defect (tiles frozen when a
search/filter is applied on an already-loaded page).

NOTE: no page-object method exists to capture a numeric KPI snapshot before
a mutation and assert it changed by a specific delta afterward (the KPI-row
counterpart to capture_card_order/assert_card_order_changed_from_captured,
which exist for card sort order but not for the KPI tiles) — flagged as a
coverage gap in the task report. This spec proves the weaker, still-
meaningful, non-flaky property available today: the KPI row re-renders
correctly immediately after the mutation, with no reload anywhere in the
chain.

Fixture: Belgium Privacy Law (QJuSzjJZoC), Inactive at rest. Activates it,
then deactivates it again — its own original state — so a passing run
leaves the catalog exactly as it found it.
"""
import allure
import pytest


@pytest.fixture
def restored_frameworks_library_page(frameworks_library_page):
    """Wraps the shared `frameworks_library_page` fixture so `Belgium
    Privacy Law` always ends this test at its `Inactive` baseline, EVEN IF
    the test body fails partway through its own in-body restore chain — the
    yield's teardown runs regardless of outcome. Re-opens the Library fresh
    (rather than trusting wherever a failed body left the page) before
    calling the idempotent, non-throwing `restore_status`. Defined locally
    in this test file rather than in conftest.py — no shared fixture change
    was needed."""
    yield frameworks_library_page
    try:
        frameworks_library_page.open().restore_status("Belgium Privacy Law", "Inactive")
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
class TestKPI019:

    @pytest.mark.regression
    @allure.title("KPI_019: KPI tiles react to activation without a manual reload")
    def test_kpi_reacts_to_activation(self, restored_frameworks_library_page):
        (restored_frameworks_library_page
            .search("Belgium Privacy Law")
            .toggle_card_status_and_confirm("Belgium Privacy Law", "Active")
            .assert_kpi_row_visible()
            .assert_avg_readiness_progress_bar()
            .toggle_card_status_and_confirm("Belgium Privacy Law", "Inactive"))
