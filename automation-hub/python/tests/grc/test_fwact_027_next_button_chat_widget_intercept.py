"""
FW_ACT_027 — Validate whether the floating chat-support widget blocks direct
clicks on the wizard's Next/Activate button.
Feature: Framework Activate Wizard

============================================================================
REWRITTEN 2026-07-29 — the prior test's own interception probe was a FALSE
POSITIVE (its `elementFromPoint(...) !== btn` check matched the button's own
span.p-button-label child, so it "passed" even when nothing was actually
intercepting). The corrected probe (`not (el is btn or btn.contains(el))`)
shows the real, asymmetric picture: the chat FAB is right-anchored and
always covers the right ~29px of the footer's right-most button. "Next"
(58px wide) has its CENTRE land exactly on the FAB's edge, so a real click
there FAILS (measured at both 1920x1200 and 1366x768) — a genuine defect.
"Activate" (82px wide) keeps its centre clear, so a real click there
SUCCEEDS (this is how FW_ACT_001 was executed live). This test therefore has
ONE KNOWN-BUG half (Next) that fails honestly today via
assert_next_clickable_without_interception(), which is why the overall run
is red — that is expected until the FAB's positioning/z-index is fixed.
assert_activate_clickable_without_interception() would pass, but the chain
never reaches it once the Next assertion throws.
============================================================================
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT027:

    @pytest.mark.regression
    @allure.title("FW_ACT_027: chat-support FAB intercepts Next (fails) but not Activate (passes)")
    def test_next_button_chat_widget_intercept(self, framework_activate_wizard_page):
        (framework_activate_wizard_page
            .search("ISO 27001")
            .select_framework_card("ISO 27001 (2022)")
            .assert_next_clickable_without_interception()
            .next()
            .assert_activate_clickable_without_interception())
