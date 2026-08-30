"""
FDO_021 — Validate that Audit Readiness renders as colored percentage
text only, with no distinct progress-bar/ring graphic, in the Framework
Metadata section.
Feature: Framework Detail Overview (data/grc/features/framework-detail-overview)

Confirmed live (2026-08-04) via a full outerHTML dump of the metadata
block: only the shield icon + a colored <span> text value, no
[role=progressbar]/<progress>/inline-width fill anywhere. This asserts
the app's actual (AC-violating, per the linked story's "visual progress
indicator" requirement) behavior, same convention as fwl-013's
assertDetailsPageShowsFramework deliberately not asserting a
known-broken field.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Detail Overview")
class TestFDO021:

    @pytest.mark.regression
    @allure.title("FDO_021: Audit Readiness renders as colored percentage text only, with no progress-bar/ring graphic")
    def test_readiness_text_only_no_progress_bar(self, framework_detail_overview_page):
        (framework_detail_overview_page
            .open("PB4ERG63zE")
            .assert_audit_readiness_no_progress_bar()
            .assert_audit_readiness_color("red"))
