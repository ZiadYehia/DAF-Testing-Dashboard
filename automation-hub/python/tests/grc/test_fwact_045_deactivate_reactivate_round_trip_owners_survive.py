"""
FW_ACT_045 — Validate that a full deactivate-then-reactivate round trip via
the new status toggle preserves a framework's existing owners, with no data
loss.
Feature: Framework Activate Wizard

Confirmed live 2026-08-04 (build dca9938158) on this exact fixture:
deactivating leaves the Owner/Owners metadata visible and unchanged (the
detail page's metadata block is never hidden/cleared on deactivation, unlike
the Library card, which collapses to the reduced shape — see FWL_030), and
reactivating via the same toggle (no wizard involved) brings the framework
straight back to Active with the exact same owners.

Fixture: Argentina Privacy Law (2018) (AOhLM73phe), Active, owners
"Ziad YEhia 2, +3". The round trip IS its own restoration — it starts and
ends Active with the same owners, so a passing run leaves the catalog
exactly as it found it.
"""
import allure
import pytest


@pytest.fixture
def restored_framework_detail_overview_page(framework_detail_overview_page):
    """Wraps the shared `framework_detail_overview_page` fixture so
    `AOhLM73phe` (Argentina Privacy Law (2018)) always ends this test at its
    `Active` baseline, EVEN IF the test body fails partway through its own
    in-body restore chain — the yield's teardown runs regardless of outcome.
    Re-opens the fixture fresh (rather than trusting wherever a failed body
    left the page) before calling the idempotent, non-throwing
    `restore_status`. Defined locally in this test file rather than in
    conftest.py — no shared fixture change was needed."""
    yield framework_detail_overview_page
    try:
        framework_detail_overview_page.open("AOhLM73phe").restore_status("Active")
    except Exception:
        # Teardown must never fail the test's own outcome — restore_status
        # is already idempotent/non-throwing internally; this only guards
        # against a rare flaky re-navigation so a genuinely passing/failing
        # test result is never overwritten by the teardown's own transient
        # hiccup.
        pass


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT045:

    @pytest.mark.regression
    @allure.title("FW_ACT_045: Deactivate/reactivate round trip preserves owners")
    def test_deactivate_reactivate_round_trip_owners_survive(self, restored_framework_detail_overview_page):
        (restored_framework_detail_overview_page
            .open("AOhLM73phe")
            .assert_owner_value("Ziad YEhia 2, +3")
            .toggle_status_and_confirm("Inactive")
            .assert_status_reflects("Inactive")
            .assert_owner_value("Ziad YEhia 2, +3")
            .toggle_status_and_confirm("Active")
            .assert_status_reflects("Active")
            .assert_owner_value("Ziad YEhia 2, +3"))
