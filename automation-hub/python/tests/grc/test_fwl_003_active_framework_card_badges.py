"""
FWL_003 — Validate that Active framework cards render with the correct
status, region, date, readiness, and control-count fields.
Feature: Frameworks Library

Confirmed live (2026-08-03, build a146218221): the AICPA PMF card renders,
in order, its 'Active' badge, 'GENERAL' region, '2000-02-22' creation date,
'Audit Readiness' label with '50%', and the three control-count badges
'0 implemented' / '11 Partially implemented' / '0 Gaps'.
"""
import allure
import pytest

AICPA_TITLE = "AICPA Privacy Management Framework (PMF) (2020)"


@allure.feature("Frameworks")
@allure.story("Frameworks Library")
class TestFWL003:

    @pytest.mark.regression
    @allure.title("FWL_003: Active framework card renders status, region, date, readiness, and control-count badges")
    def test_active_framework_card_badges(self, frameworks_library_page):
        frameworks_library_page.assert_active_card_shape(AICPA_TITLE, "GENERAL", "2000-02-22", "50%", "0", "11", "0")
