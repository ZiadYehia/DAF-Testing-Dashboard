"""
FDO_001 — Validate that opening a specific framework from the Framework
Library displays its unique, correct header, not fixed content (P1
Navigation Bug).
Feature: Framework Detail Overview (data/grc/features/framework-detail-overview)

KNOWN BUG, this test will honestly FAIL today. Confirmed live (2026-08-04,
build a146218221) on 4 distinct frameworks (ISO 21434, Alaska PIPA, AICPA
PMF, APEC Privacy Framework) and the 0-clause Draft fixture: the <h5>
title and <p> subtitle are HARDCODED to "ISO 28033 - ISO/IEC 28033" /
"Information Security Management" regardless of which framework id is
opened. This asserts the REQUIRED per-framework header for the real "ISO
21434 (2021)" fixture (its Library-card title is independently confirmed
live; the subtitle text is not independently surfaced anywhere and is a
best-effort placeholder for "this framework's own description" — the title
mismatch alone is sufficient to fail this honestly against the hardcoded
constant) — same convention as fwact-006-step1-heading-subtitle-bug.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Detail Overview")
class TestFDO001:

    @pytest.mark.regression
    @allure.title("FDO_001: Opening a specific framework shows its own header, not a fixed record")
    def test_header_hardcoded_not_framework_specific(self, framework_detail_overview_page):
        (framework_detail_overview_page
            .open("PB4ERG63zE")
            .assert_header_shows_framework("ISO 21434 (2021)", "Road vehicles — Cybersecurity engineering"))
