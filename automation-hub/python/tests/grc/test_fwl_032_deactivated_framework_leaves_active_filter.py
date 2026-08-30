"""
FWL_032 — Validate that deactivating a framework removes it from the
"All status" = Active filter and makes it appear under Inactive instead.
Feature: Frameworks Library

New behaviour confirmed live 2026-08-04 (build dca9938158): the status
toggle's mutation is a real status change, not a cosmetic label swap — it
moves the record between filter buckets exactly like any pre-existing
Inactive framework. The search term stays applied alongside the status
filter throughout, so the assertions below are never at the mercy of the
grid's 50-card-per-page render cap.

Fixture: Argentina Privacy Law (2018) (Active at rest). Deactivates it,
confirms it drops out of the Active filter and shows up under Inactive, then
reactivates it — its own original state — so a passing run leaves the
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
@allure.story("Frameworks Library")
class TestFWL032:

    @pytest.mark.regression
    @allure.title("FWL_032: Deactivated framework leaves the Active filter and appears under Inactive")
    def test_deactivated_framework_leaves_active_filter(self, restored_frameworks_library_page):
        (restored_frameworks_library_page
            .search("Argentina Privacy Law")
            .toggle_card_status_and_confirm("Argentina Privacy Law (2018)", "Inactive")
            .search("Argentina Privacy Law")
            .toggle_filter_option("All status", "Active")
            .assert_card_not_visible("Argentina Privacy Law (2018)")
            .toggle_filter_option("All status", "Active")
            .toggle_filter_option("All status", "Inactive")
            .assert_card_visible("Argentina Privacy Law (2018)")
            .toggle_filter_option("All status", "Inactive")
            .toggle_card_status_and_confirm("Argentina Privacy Law (2018)", "Active"))
