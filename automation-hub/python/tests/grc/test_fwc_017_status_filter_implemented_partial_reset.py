"""
FWC_017 — Validate that selecting each value from the "All Status" filter
(Implemented, Partial, and All/reset) displays the correctly filtered clause
list in the tree.
Feature: Framework Clause Detail

Rewritten per live confirmation (2026-08-03/04, build a146218221): there is
NO "All" option in the filter's listbox — it's a 3-option single-select
(Implemented, Partial, Gap), reset via the select's own clear ("x") icon
rather than a 4th option. Implemented returns the shared "No results found!"
empty state on every real fixture (0 of 11 clauses qualify). Partial narrows
the tree so that DMY.1.1 (Partial) stays visible while DMY.1.4 (Gap, same
domain) is hidden — proving the filter hides individual clauses, not just
whole domains. Clearing via the "x" icon reverts to the unfiltered, full
3-domain tree.
"""
import allure
import pytest


@allure.feature("Frameworks")
@allure.story("Framework Clause Detail")
class TestFWC017:

    @pytest.mark.regression
    @allure.title("FWC_017: Status filter (Implemented/Partial) narrows the tree, and clear-icon resets it")
    def test_status_filter_implemented_partial_reset(self, framework_clause_detail_page):
        (framework_clause_detail_page
            .open("PB4ERG63zE")
            .select_status_filter("Implemented")
            .assert_no_results_found()
            .select_status_filter("Partial")
            .assert_clause_row_visible("DMY.1.1")
            .assert_clause_row_absent("DMY.1.4")
            .clear_status_filter()
            .assert_domain_count(3))
