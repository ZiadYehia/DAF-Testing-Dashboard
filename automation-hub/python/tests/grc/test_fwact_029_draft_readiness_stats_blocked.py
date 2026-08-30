"""
FW_ACT_029 — Validate that Draft frameworks do not display readiness/control
statistics in the Framework Library (DT-3168).
Feature: Framework Activate Wizard

BLOCKED: no "Save as Draft" action exists anywhere in the live Activate
Framework flow (confirmed by FW_ACT_002 — Step 2 has only Back + Activate),
so no Draft framework can be created or reached through this wizard at all.
The chain below exercises the concrete evidence for the block (no
save-as-draft control anywhere in the flow); it cannot progress to
inspecting a Draft framework's Library card since none is reachable.
Cross-reference the frameworks-library feature for handling of any
pre-existing Draft framework from before Save-as-Draft was removed/never
implemented in this build. Flag for product/design: confirm whether Draft
frameworks are now obsolete for this feature or achievable via another path.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT029:

    @pytest.mark.regression
    @pytest.mark.skip(
        reason='No "Save as Draft" action exists anywhere in the live Activate Framework flow (see '
        "FW_ACT_002) — no Draft framework can be created or reached through this wizard, so this "
        "scenario cannot be exercised end-to-end. Only a pre-existing Draft framework (if any remains "
        "in the tenant) could exercise it, via the frameworks-library feature, not this one."
    )
    @allure.title("FW_ACT_029: Draft frameworks show no readiness/control stats in Library (BLOCKED — no Save-as-Draft)")
    def test_draft_readiness_stats_blocked(self, framework_activate_wizard_page):
        (framework_activate_wizard_page
            .search("ISO 27001")
            .select_framework_card("ISO 27001 (2022)")
            .next()
            .open_owner_picker()
            .check_owner("Clara Cogsworth")
            .close_owner_picker()
            .assert_no_save_as_draft_control())
