"""
FDO_020 — Validate that Audit Readiness percentage is color-coded based
on its value.
Feature: Framework Detail Overview (data/grc/features/framework-detail-overview)

BLOCKED — cannot be evaluated as written. Confirmed live (2026-08-04):
sorting the entire 47-Active-framework Library by Audit Readiness
ascending, the maximum value in the whole active catalog is 50% — and even
that renders red, the same class as every other sampled value (0%-50%).
The scripted 0%/50%/90%/100% four-fixture spread is unbuildable; no
amber or green tier has ever been observed. The body below is illustrative
only and never runs; declared via test.fixme(title, body) so ONLY this
test is skipped.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Detail Overview")
class TestFDO020:

    @pytest.mark.regression
    @pytest.mark.skip(
        reason="Every observed value across the whole 453-framework catalog (0%-50%) renders in the identical red class — no fixture exceeds 50% readiness, so the amber (41-50%, which the app also renders red) and green (>50%) tiers are unreachable and unconfirmable."
    )
    @allure.title("FDO_020: Audit Readiness percentage is color-coded based on its value (BLOCKED — no fixture exceeds 50%, amber/green unreachable)")
    def test_readiness_color_coding_blocked(self, framework_detail_overview_page):
        (framework_detail_overview_page
            .open("bSO72UIlmZ")
            .assert_audit_readiness_color("amber"))
