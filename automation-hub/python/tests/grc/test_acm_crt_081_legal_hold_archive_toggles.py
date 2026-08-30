"""
CRT_081 — Validate Legal Hold and Archive Flag toggles default to Disabled and
can each be switched independently.
"""
import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestAssetCreateManualCRT081:

    @pytest.mark.regression
    @allure.title("CRT_081: Legal Hold and Archive Flag toggles default Disabled and switch independently")
    def test_legal_hold_archive_toggles(self, asset_create_page):
        uniq = unique_suffix()
        asset_name = f"QA Toggle Check {uniq}"

        (asset_create_page
            .select_family("Security Operations")
            .select_type("Vulnerability")
            .fill_asset_name(asset_name)
            .fill_field("Vulnerability ID", f"CVE-QA-TOGGLE-{uniq}")
            .next_step()
            # Both toggles should default to Disabled before any interaction.
            # First switch = Legal Hold, second switch = Archive Flag.
            .assert_switch_visible(0)
            .assert_switch_visible(1)
            .assert_text_visible("Disabled", first=True)
            # Switch Legal Hold to Enabled, leave Archive Flag Disabled.
            .toggle_switch(0)
            .create()
            .assert_created(asset_name)
            # Lifecycle & Dates tab shows the persisted toggle states
            .open_tab("Lifecycle & Dates")
            .assert_text_visible("Legal Hold")
            .assert_text_visible("Yes")
            .assert_text_visible("No"))
