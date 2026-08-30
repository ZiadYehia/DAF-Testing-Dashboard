"""
FW_ACT_026 — Validate that Step 1 framework cards show the category and
version-count fields required by FW_FR_ACTIVATE_02, in addition to name,
region, and the `Inactive` badge (defect).
Feature: Framework Activate Wizard

KNOWN BUG — fails honestly today. FW_FR_ACTIVATE_02 requires name, category,
region, and version count on each card. Live investigation (2026-07-29)
confirmed "ISO 27001 (2022)"'s card renders only its name, an "Inactive"
badge, and region "GENERAL" — its description div renders empty, and no
category label or "N versions" count appears anywhere on the card. This test
asserts the REQUIRED fields via assert_card_shows_category_and_version_count,
so it fails while the fields are missing — no longer documenting the
defective state as a pass (its absence-style counterpart
assert_card_has_no_category_or_version_count stays available for tests that
need to document the current state instead).
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Activate Wizard")
class TestFWACT026:

    @pytest.mark.regression
    @allure.title("FW_ACT_026: framework card is missing category and version-count fields")
    def test_card_fields_missing_category_version(self, framework_activate_wizard_page):
        (framework_activate_wizard_page
            .search("ISO 27001")
            .assert_card_shows_region_and_inactive_badge("ISO 27001 (2022)", "GENERAL")
            .assert_card_description_empty("ISO 27001 (2022)")
            .assert_card_shows_category_and_version_count("ISO 27001 (2022)"))
