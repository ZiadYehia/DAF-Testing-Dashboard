"""
FW_ACT_006 — Validate the breadcrumb, heading, and subtitle on "Step 1 —
Select Framework" against the DT-3489 design copy.
Feature: Framework Activate Wizard

KNOWN BUG, this test will honestly FAIL today. Confirmed live 2026-07-29
(portal-grc.allendevaux.net): the breadcrumb matches ("Frameworks > Activate
Framework" — the wizard is a full page at /grc/frameworks/activate, not a
modal), but the live heading reads "Activate Framework" and the live subtitle
reads "Configure the framework activation." — NOT the design's "Activated
Frameworks" / "Activate a new Framework to your compliance" copy. This test
asserts the ORIGINAL/CORRECT design copy (per DT-3489), so it fails today and
becomes a regression-catch once the copy is fixed — same convention as
acm-crt-057's future-purchase-date rejection test.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT006:

    @pytest.mark.regression
    @allure.title("FW_ACT_006: Step 1 heading, subtitle, and breadcrumb match design copy")
    def test_step1_heading_subtitle_bug(self, framework_activate_wizard_page):
        (framework_activate_wizard_page
            .assert_breadcrumb()
            .assert_page_heading_and_subtitle("Activated Frameworks", "Activate a new Framework to your compliance"))
