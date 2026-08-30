"""
FWL_030 — Validate that deactivating an Active framework's card collapses it
to the reduced Inactive shape (status + region + date only — no Audit
Readiness, no control-count badges).
Feature: Frameworks Library

New behaviour confirmed live 2026-08-04 (build dca9938158): the Library card
status toggle (the SAME control also present on the framework detail page)
flips a card between the full Active shape and the reduced Inactive shape,
matching the pre-existing Active/Inactive card-anatomy rule.

Fixture: Bahamas DPA (2003), Inactive at rest. Brings it to Active first
(setup, via this same toggle) so there is something to deactivate, checks
the resulting reduced shape, then leaves it Inactive — its own original
state — so a passing run leaves the catalog exactly as it found it.
Re-searches after each toggle since the mutation's settle/re-render is not
guaranteed to preserve the search box's value.
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
@allure.story("Frameworks Library")
class TestFWL030:

    @pytest.mark.regression
    @allure.title("FWL_030: Deactivated framework card renders the reduced Inactive shape")
    def test_deactivated_card_reduced_shape(self, restored_frameworks_library_page):
        (restored_frameworks_library_page
            .search("Bahamas DPA")
            .toggle_card_status_and_confirm("Bahamas DPA (2003)", "Active")
            .search("Bahamas DPA")
            .toggle_card_status_and_confirm("Bahamas DPA (2003)", "Inactive")
            .search("Bahamas DPA")
            .assert_reduced_card_shape("Bahamas DPA (2003)", "Inactive", "2000-02-22", "AMERICAS"))
