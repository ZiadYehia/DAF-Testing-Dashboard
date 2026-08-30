"""
FW_ACT_044 — Validate that deactivating an Active framework via the new
status toggle flips it to Inactive.
Feature: Framework Activate Wizard

New behaviour confirmed live 2026-08-04 (build dca9938158): a
deactivate/reactivate toggle now exists directly on the framework detail
page (the SAME control also present on every Library card). Clicking it
from Active opens a "Deactivate Framework" confirmation dialog; confirming
flips the toggle's own status word to Inactive.

Fixture: Argentina Privacy Law (2018) (AOhLM73phe), Active. Touches its
status only — deactivates it, confirms Inactive, then reactivates it via the
same toggle and re-confirms Active before finishing, so a passing run leaves
the catalog exactly as it found it.
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
class TestFWACT044:

    @pytest.mark.regression
    @allure.title("FW_ACT_044: Deactivating an Active framework flips it to Inactive")
    def test_deactivate_active_framework_yields_inactive(self, restored_framework_detail_overview_page):
        (restored_framework_detail_overview_page
            .open("AOhLM73phe")
            .toggle_status_and_confirm("Inactive")
            .assert_status_reflects("Inactive")
            .toggle_status_and_confirm("Active")
            .assert_status_reflects("Active"))
