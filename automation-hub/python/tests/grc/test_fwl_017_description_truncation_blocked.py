"""
FWL_017 — Validate that the Short Description text on a framework card
truncates at two lines without breaking the card layout.
Feature: Frameworks Library

BLOCKED / not performable as originally specified: confirmed live
(2026-08-03, build a146218221) that NO framework card of any status (Active,
Inactive, or Draft) renders a description line at all — the card anatomy is
name/badge/region/date/[readiness+control-counts]. There is no "Short
Description" text anywhere on any of the 453 catalog cards to observe
truncating. Two-line-clamp behavior is unverifiable when the field it would
apply to is never rendered. Flag for product/design: confirm whether card
descriptions were removed intentionally or are a gap.
"""
import allure
import pytest

AICPA_TITLE = "AICPA Privacy Management Framework (PMF) (2020)"


@allure.feature("Frameworks")
@allure.story("Frameworks Library")
class TestFWL017:

    @pytest.mark.regression
    @pytest.mark.skip(
        reason="No framework card of any status renders a description line at all — two-line-clamp "
        "truncation is unverifiable when the field it would apply to is never rendered."
    )
    @allure.title("FWL_017: Short Description text truncates at two lines without breaking card layout (BLOCKED — no description renders)")
    def test_description_truncation_blocked(self, frameworks_library_page):
        frameworks_library_page.assert_card_visible(AICPA_TITLE)
