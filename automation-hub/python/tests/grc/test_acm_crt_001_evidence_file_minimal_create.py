import allure
import pytest

from autotest_framework.src.utils.data import unique_suffix


@allure.feature("Asset Manager")
@allure.story("Asset Create Manual")
class TestCRT001:

    @pytest.mark.regression
    @allure.title("CRT_001: Evidence File asset created with required fields only")
    def test_evidence_file_minimal_create(self, asset_create_page):
        uniq = unique_suffix()
        name = f"QA Evidence File {uniq}"
        (asset_create_page
            .select_family("Evidence")
            .select_type("Evidence File")
            .fill_asset_name(name)
            .fill_field("System File ID / File Hash", f"EF-HASH-{uniq}")
            .next_step()
            .create()
            .assert_created(name)
            .assert_field("System File ID / File Hash", f"EF-HASH-{uniq}"))
