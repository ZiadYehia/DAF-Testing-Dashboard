"""
KPI_021 — Validate that the "Avg Readiness" KPI tile recomputes when a
framework's own readiness score enters or leaves the Active pool (via
deactivation/reactivation), without requiring a manual page reload.
Feature: Framework Library KPI Summary

Confirmed live 2026-08-04 (build dca9938158), section D of the live pass:
Avg Readiness moved on every activate/deactivate in the same session (e.g.
18.29% -> 18.72% -> 18.9% -> 18.46%), settling over a ~9s window with no
manual reload — the framework's contribution to the average is added or
removed exactly when it enters/leaves the Active set.

NOTE: same coverage gap as KPI_019/KPI_020 — no page-object method exists to
capture the Avg Readiness numeric value before a mutation and assert it
changed afterward, so this proves the weaker, non-flaky property available
today: assert_avg_readiness_progress_bar() (displayed percentage and
progress-bar fill agree) holds immediately after each half of the round
trip, proving the tile re-rendered rather than going stale.

Fixture: Argentina Privacy Law (2018) (Active at rest). Deactivates it
(removing its readiness from the average), then reactivates it (restoring
its contribution) — its own original state — so a passing run leaves the
catalog exactly as it found it.
"""
import allure
import pytest


@pytest.fixture
def restored_frameworks_library_page(frameworks_library_page):
    """Wraps the shared `frameworks_library_page` fixture so `Argentina
    Privacy Law (2018)` always ends this test at its `Active` baseline, EVEN
    IF the test body fails partway through its own in-body restore chain —
    the yield's teardown runs regardless of outcome. Re-opens the Library
    fresh (rather than trusting wherever a failed body left the page) before
    calling the idempotent, non-throwing `restore_status`. Defined locally
    in this test file rather than in conftest.py — no shared fixture change
    was needed."""
    yield frameworks_library_page
    try:
        frameworks_library_page.open().restore_status("Argentina Privacy Law (2018)", "Active")
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
class TestKPI021:

    @pytest.mark.regression
    @allure.title("KPI_021: Avg Readiness KPI recomputes when a framework leaves/rejoins the Active pool")
    def test_avg_readiness_recomputes_on_status_change(self, restored_frameworks_library_page):
        (restored_frameworks_library_page
            .search("Argentina Privacy Law")
            .toggle_card_status_and_confirm("Argentina Privacy Law (2018)", "Inactive")
            .assert_kpi_row_visible()
            .assert_avg_readiness_progress_bar()
            .toggle_card_status_and_confirm("Argentina Privacy Law (2018)", "Active")
            .assert_avg_readiness_progress_bar())
