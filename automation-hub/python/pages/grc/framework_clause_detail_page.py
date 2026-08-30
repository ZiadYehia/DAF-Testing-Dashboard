"""Framework Clause Detail Page — GRC "Clauses and Mappings" tab on the
Framework Details screen (/grc/frameworks/details/<id>?tab=Clauses+and+Mappings,
story DT-3486).

Ported 1:1 from pages/grc/framework-clause-detail.page.ts — see that file's
docstring for the fully detailed writeup, kept in sync here:

HEADLINE MOCK-DATA DEFECT — read this before writing any test against this
page object: the tab renders BYTE-IDENTICAL content for every framework.
PB4ERG63zE (ISO 21434), OD3zPmaTGK (Alaska PIPA), and wtJEAZRF05 (AICPA PMF)
all show the exact same 3 domains (DMY.1 Governance & Oversight, DMY.2 Risk &
Controls, DMY.3 Monitoring & Improvement), the same 11 "DUMMY n.n ..."
clauses, the same Objective/Evidence Expectation text, and the same
9-Partial/2-Gap status split. The ONE framework that differs is the empty-
state fixture fwXOGmGxko ("Test Framework Draft aIjJnV") — a Draft with zero
domains/clauses, used for the "No domains" empty state. There is no fixture
anywhere in the 453-framework catalog with per-framework clause data, an
"Implemented" clause, or a clause with an actual mapped control — see the
unbuildable-assertion notes throughout this file for what that costs.

Quirks verified live (2026-08-03/04, build a146218221):
- Two-panel layout: left "Domain & Clauses" panel (search + status filter +
  domain/clause accordion) and a right clause-detail panel. Left heading is
  literally "Domain & Clauses" — no "s" on "Domain".
- The domain/clause tree is a PrimeVue SINGLE-EXPAND accordion
  (.p-accordionheader / .p-accordioncontent), not a plain multi-expand tree —
  opening one domain collapses whichever was open. The chevron carries a
  -rotate-90 class while collapsed and no rotate class while expanded.
- Domain headers render NO clause-count badge whatsoever — confirmed by
  dumping every accordion header's raw outerHTML. FWC_008/FWC_026 (badge
  assertions) are provided below anyway (documented as failing honestly)
  since the feature simply doesn't exist.
- The status filter (aria-label="All Status" PrimeVue p-select) is a
  single-select with exactly 3 options (Implemented, Partial, Gap) — there is
  NO "All" option in its listbox; reset is via the select's own clear ("x")
  icon. Selecting Implemented always returns zero results on every real
  fixture (no clause anywhere is Implemented). Like the Frameworks Library's
  "Sort by" combobox, this trigger's own displayed text IS its current value
  (reads the placeholder "All Status" only while unset, then becomes e.g.
  "Gap") — located STRUCTURALLY below, never by a label/aria-label that
  mutates the moment a value is picked.
- Clause rows show only TWO icon states, both the same warning-triangle SVG
  path — color is the only differentiator (text-allendevaux-yellow-400 =
  Partial, text-allendevaux-red-100 = Gap). No clause anywhere is
  "Implemented", so the design mock's checkmark-circle icon was never
  observed and cannot be asserted against a real fixture.
- Right panel renders (top to bottom): <h2> clause code+title, a status badge
  row (status badge + an "In Scope" badge, both undocumented in any test case
  except the status one), Objective, Evidence Expectation, and Mapped
  Controls. There is NO Requirement section anywhere — confirmed by dumping
  every h1-h6 for multiple clauses across all 3 frameworks. Mapped Controls
  NEVER shows a count suffix and is never prefixed "SCF" — the test cases'
  "MAPPED SCF CONTROLS (n)" string does not exist in any state, including Gap.
- No clause anywhere has a mapped control — checked all 11 clauses across all
  3 non-empty frameworks (9 Partial + 2 Gap). Every clause's Mapped Controls
  section renders only the heading and the + Propose Mapping button, zero
  control cards, zero keyword tags. This makes every FWC_002/003/011/013/
  014/015/022/027-style assertion unbuildable against live data; the methods
  below still exist (per the task brief) with a best-effort, documented-as-
  unconfirmed selector so a test can assert them inside a skipped test and
  fail honestly rather than silently pass.
- Gap clauses show a warning box reading verbatim (including the em dash)
  "No controls mapped — this clause is a Gap." plus + Propose Mapping.
  + Propose Mapping ALSO renders on Partial clauses (without the warning
  box). Clicking it produces no dialog/toast — a confirmed no-op inherited
  from the prior frameworks-library pass (section 9.6) — so
  assert_propose_mapping_modal_open documents the expected-but-absent modal.
- Status badges are clickable (cursor-pointer) and open a read-only
  [role=dialog] titled "About <Status> State" with fixed explanatory copy and
  a Close button.
- Gap clauses ONLY show an extra Create SOA button beside the <h2> heading —
  confirmed absent on every Partial clause checked.
- Selected clause row: bg-allendevaux-sky-blue-50 background PLUS a thicker
  border-l-2 !border-allendevaux-dark-blue-300 left border (overriding the
  unselected 1px border-l border-allendevaux-secondary-300). Selection
  persists across accordion collapse/expand of its own domain.
- Search filters by clause title AND hides whole non-matching domains (not
  just their children) — same behavior for the status filter. A non-matching
  search/filter shows the SAME shared "No results found!" empty-state widget
  used by the Frameworks Library grid, but with DIFFERENT body copy here:
  "We couldn't find any matches for your search. Try adjusting your filters
  or search terms" (note "filters or", absent from the Library's own copy —
  do not conflate the two).
- On a framework with real clause data, the FIRST clause of the FIRST domain
  auto-selects on cold load — the right panel's "Select a clause to view its
  details" default message is only reachable on a framework with literally
  zero clauses (the Draft fixture fwXOGmGxko), never on one with clauses.
  FWC_001's premise (clauses exist AND the empty message shows) is internally
  contradictory on every non-empty fixture in this build.
- No RBAC gate of any kind: a Normal user (GRC_LOGIN_USER_ALT) sees an
  identical, fully interactive tab — same as the Frameworks Library and
  Activate Wizard's own P1 findings.

Known framework ids for tests: PB4ERG63zE (ISO 21434, has clauses),
OD3zPmaTGK (Alaska PIPA, has clauses), fwXOGmGxko (Draft, zero
domains/clauses — the empty-state fixture).
"""
from __future__ import annotations

import os
import re

from playwright.sync_api import expect

from autotest_framework.config import config
from autotest_framework.src.pages.base_page import BasePage
from pages.grc.login_page import LoginPage

# Every clause row's class list STARTS with this exact prefix regardless of
# selection state (confirmed via an outerHTML diff of selected vs. unselected
# rows) — selection only APPENDS bg-allendevaux-sky-blue-50 and
# border-l-2 !border-allendevaux-dark-blue-300. Safe as a plain CSS class
# selector (no Tailwind arbitrary-value brackets to escape).
CLAUSE_ROW_SELECTOR = "button.border-l.border-allendevaux-secondary-300"
# PrimeVue 4 accordion header button — one per domain.
DOMAIN_HEADER_SELECTOR = "button.p-accordionheader"
SELECTED_BG_CLASS = "bg-allendevaux-sky-blue-50"
SELECTED_BORDER_CLASS = "border-l-2"
# Color class distinguishing the two (identically-shaped) status triangle
# icons. No "Implemented" entry — that icon/color was never observed live.
STATUS_ICON_COLOR = {
    "Partial": "text-allendevaux-yellow-400",
    "Gap": "text-allendevaux-red-100",
}


class FrameworkClauseDetailPage(BasePage):
    """Framework Details — "Clauses and Mappings" tab."""

    def __init__(self, page):
        super().__init__(page, "Framework Clause Detail Page")

    def open(self, framework_id: str) -> "FrameworkClauseDetailPage":
        self.navigate(f"{config.base_url}/grc/frameworks/details/{framework_id}?tab=Clauses+and+Mappings")
        self._wait_for_tab_ready()
        return self

    def open_as_normal_user(self, framework_id: str) -> "FrameworkClauseDetailPage":
        """Log in fresh as the second/normal-user credential (GRC_LOGIN_USER_ALT,
        =user2) and land straight on this tab. Mirrors
        FrameworksLibraryPage.open_as_normal_user / FrameworkActivateWizardPage.
        open_as_normal_user — temporarily repoints the username env var
        LoginPage/config reads, rather than hand-rolling a second login flow.
        Confirmed live (2026-08-04): this user sees an IDENTICAL, fully
        interactive tab — no permission wall at all — so assert_access_denied()
        is expected to fail honestly for FWC_024."""
        alt_user = os.environ.get("GRC_LOGIN_USER_ALT")
        if not alt_user:
            raise RuntimeError("Missing GRC_LOGIN_USER_ALT — set it in automation-hub/.env")
        previous = os.environ.get("GRC_LOGIN_USER")
        os.environ["GRC_LOGIN_USER"] = alt_user
        try:
            LoginPage(self.page).login()
        finally:
            if previous is None:
                os.environ.pop("GRC_LOGIN_USER", None)
            else:
                os.environ["GRC_LOGIN_USER"] = previous
        self.navigate(f"{config.base_url}/grc/frameworks/details/{framework_id}?tab=Clauses+and+Mappings")
        self._wait_for_tab_ready()
        return self

    # ==========================================
    #             INTERNAL HELPERS
    # ==========================================

    def _domain_headers(self):
        """All currently VISIBLE domain accordion headers."""
        return self.page.locator(f"{DOMAIN_HEADER_SELECTOR}:visible")

    def _domain_header(self, code_or_name: str):
        """The single domain header whose text contains `code_or_name` (e.g.
        'DMY.1' or 'Governance & Oversight')."""
        return self._domain_headers().filter(has_text=code_or_name)

    def _clause_rows(self):
        """All currently VISIBLE clause row buttons — since the accordion is
        single-expand, this is naturally scoped to whichever one domain is
        currently open."""
        return self.page.locator(f"{CLAUSE_ROW_SELECTOR}:visible")

    def _clause_row(self, code: str):
        """The single visible clause row whose text contains `code` (e.g.
        'DMY.1.1') — codes never collide as substrings across the 11 live
        clauses."""
        return self._clause_rows().filter(has_text=code)

    def _status_filter_trigger(self):
        """Located structurally as the tab's one-and-only PrimeVue `.p-select`
        trigger — never by its aria-label/displayed text, both of which mutate
        to the current selection the moment a status is picked (the exact
        "combobox accessible name becomes its value" trap that cost six rounds
        on the library page object)."""
        return self.page.locator(".p-select").first

    def _status_filter_clear_icon(self):
        """The status filter's clear ("x") icon — the ONLY way to reset it,
        since its listbox has no "All" option."""
        return self.page.locator(".p-select-clear-icon")

    def _is_header_collapsed(self, header) -> bool:
        """Whether `header`'s chevron currently carries the collapsed-state
        -rotate-90 class."""
        return header.evaluate(
            """el => {
                const icon = el.querySelector('svg');
                return icon ? icon.classList.contains('-rotate-90') : false;
            }"""
        )

    def _is_domain_collapsed(self, code_or_name: str) -> bool:
        return self._is_header_collapsed(self._domain_header(code_or_name))

    def _status_badge(self, status: str):
        """The "In Scope" badge sits right beside this one but never contains
        any of the 3 status words, so filtering on `status` text disambiguates
        cleanly without needing a narrower structural anchor."""
        return self.page.locator("span.cursor-pointer").filter(has_text=status)

    def _mapped_control_cards(self):
        """Best-effort locator for a mapped-control card — UNCONFIRMED against
        any live fixture, since no clause anywhere has ≥1 mapped control (see
        module docstring). Anchored structurally off the "Mapped Controls"
        heading rather than a class name mined from real markup, because no
        real markup to mine exists. Kept so assert_mapped_controls_count /
        assert_mapped_control_card fail with a clear "0 found" rather than
        being stubbed out."""
        return (
            self.page.get_by_role("heading", name="Mapped Controls", exact=True)
            .locator("xpath=following-sibling::*")
            .locator("div.border.rounded-lg")
        )

    def _tree_signature(self) -> str:
        """`<joined visible domain header texts>|<visible clause row count>` —
        enough to tell one tree state from another."""
        domain_texts = [t.strip() for t in self._domain_headers().all_inner_texts()]
        row_count = self._clause_rows().count()
        return f"{','.join(domain_texts)}|{row_count}"

    def _wait_for_tree_settled(self, before: str) -> None:
        """Wait for a search/filter change to actually take effect, given the
        tree signature captured BEFORE the change. Ported from the identical
        lesson in framework_activate_wizard_page.py/frameworks_library_page.py:
        waiting for "the count stops changing" alone isn't enough, since the
        PRE-change tree is already stable and two equal reads land before the
        debounced request is even sent. So: first wait for the signature to
        differ from `before` (or the empty state to appear), then wait for it
        to stop moving."""
        empty_state = self.page.get_by_role("heading", name="No results found!", exact=True)
        for _ in range(60):
            try:
                if empty_state.is_visible():
                    return
            except Exception:
                pass
            if self._tree_signature() != before:
                break
            self.page.wait_for_timeout(150)
        previous = ""
        for _ in range(40):
            try:
                if empty_state.is_visible():
                    return
            except Exception:
                pass
            signature = self._tree_signature()
            if signature != "|0" and signature == previous:
                return
            previous = signature
            self.page.wait_for_timeout(150)

    def _wait_for_tab_ready(self) -> None:
        """Wait for the tab to have actually hydrated. Works for BOTH the
        has-clauses case (the left tree + auto-selected clause render a beat
        after navigation) and the zero-clause case (the "No domains" empty
        state) — the "Domain & Clauses" heading is the one element common to
        both states."""
        expect(self.page.get_by_role("heading", name="Domain & Clauses", exact=True)).to_be_visible()

    # ==========================================
    #             ACTIONS — SEARCH / FILTER
    # ==========================================

    def search_clauses(self, term: str) -> "FrameworkClauseDetailPage":
        before = self._tree_signature()
        self.fill(self.page.get_by_placeholder("Search Clauses"), term)
        self._wait_for_tree_settled(before)
        return self

    def clear_search_clauses(self) -> "FrameworkClauseDetailPage":
        before = self._tree_signature()
        self.fill(self.page.get_by_placeholder("Search Clauses"), "")
        self._wait_for_tree_settled(before)
        return self

    def select_status_filter(self, status: str) -> "FrameworkClauseDetailPage":
        """Open the `All Status` filter and pick `status` ('Implemented' |
        'Partial' | 'Gap'). 'Implemented' always yields zero results on every
        live fixture (see module docstring)."""
        before = self._tree_signature()
        self.click(self._status_filter_trigger())
        self.page.get_by_role("listbox").last.wait_for(state="visible", timeout=3000)
        self.click(self.page.get_by_role("option", name=status, exact=True))
        self._wait_for_tree_settled(before)
        return self

    def clear_status_filter(self) -> "FrameworkClauseDetailPage":
        """Reset the status filter via its clear ("x") icon — there is no
        "All" listbox option to select instead."""
        before = self._tree_signature()
        self.click(self._status_filter_clear_icon())
        self._wait_for_tree_settled(before)
        return self

    # ==========================================
    #             ACTIONS — DOMAIN ACCORDION
    # ==========================================

    def expand_domain(self, code_or_name: str) -> "FrameworkClauseDetailPage":
        """Expand `code_or_name`'s domain if currently collapsed (no-op if
        already open). Single-expand accordion — this collapses whichever
        OTHER domain was open."""
        if self._is_domain_collapsed(code_or_name):
            self.click(self._domain_header(code_or_name))
            self._wait_for_domain_collapsed_state(code_or_name, False)
        return self

    def collapse_domain(self, code_or_name: str) -> "FrameworkClauseDetailPage":
        """Collapse `code_or_name`'s domain if currently expanded (no-op if
        already closed)."""
        if not self._is_domain_collapsed(code_or_name):
            self.click(self._domain_header(code_or_name))
            self._wait_for_domain_collapsed_state(code_or_name, True)
        return self

    def _wait_for_domain_collapsed_state(self, code_or_name: str, expected: bool) -> None:
        """Poll `_is_domain_collapsed` until it matches `expected`. The TS
        twin uses `expect.poll(...)` here, but that's a `@playwright/test`
        (JS-only) API with no equivalent on `playwright.sync_api.expect` —
        the Python `Expect` object only exposes `set_options`/`soft`. This is
        the manual equivalent, in the same polling style as
        `_wait_for_tree_settled`."""
        for _ in range(40):
            if self._is_domain_collapsed(code_or_name) == expected:
                return
            self.page.wait_for_timeout(150)
        assert self._is_domain_collapsed(code_or_name) == expected, (
            f"domain '{code_or_name}' did not reach collapsed={expected} state"
        )

    # ==========================================
    #             ACTIONS — CLAUSE SELECTION / DETAIL
    # ==========================================

    def select_clause(self, code: str) -> "FrameworkClauseDetailPage":
        """Click the clause row matching `code` and wait for the right
        panel's <h2> to reflect it."""
        self.click(self._clause_row(code))
        expect(self.page.get_by_role("heading", level=2).filter(has_text=code)).to_be_visible()
        return self

    def click_status_badge(self, status: str) -> "FrameworkClauseDetailPage":
        """Click the status badge (opens the read-only `About <Status> State`
        dialog)."""
        self.click(self._status_badge(status))
        return self

    def close_about_state_dialog(self) -> "FrameworkClauseDetailPage":
        """Close the currently open `About <Status> State` dialog via its
        `Close` button."""
        self.click(self.page.get_by_role("dialog").get_by_role("button", name="Close", exact=True))
        return self

    def click_propose_mapping(self) -> "FrameworkClauseDetailPage":
        """Click `+ Propose Mapping`. Confirmed live no-op — produces no
        dialog/toast (see module docstring)."""
        self.click(self.page.get_by_role("button", name="Propose Mapping", exact=True))
        return self

    def click_create_soa(self) -> "FrameworkClauseDetailPage":
        """Click `Create SOA` (Gap clauses only)."""
        self.click(self.page.get_by_role("button", name="Create SOA", exact=True))
        return self

    def click_control_id_link(self, control_id: str) -> "FrameworkClauseDetailPage":
        """Click a mapped-control card's linked Control ID. UNBUILDABLE
        against any live fixture — no clause anywhere has a mapped control,
        so no such link exists to click (see _mapped_control_cards's
        docstring). Kept so FWC_015 can fail honestly inside a skipped test."""
        self.click(
            self._mapped_control_cards()
            .filter(has_text=control_id)
            .get_by_role("link", name=control_id, exact=True)
        )
        return self

    # ==========================================
    #             ASSERTIONS — PAGE / TAB CHROME
    # ==========================================

    def assert_on_clauses_tab(self, framework_id: str) -> "FrameworkClauseDetailPage":
        """Assert the URL is still on this framework's Clauses and Mappings
        tab — used both as a landing check and (called before/after a clause
        click) as the "no full page reload / no URL change" proof for
        FWC_023."""
        expect(self.page).to_have_url(
            re.compile(rf".*/grc/frameworks/details/{re.escape(framework_id)}\?tab=Clauses\+and\+Mappings")
        )
        return self

    def assert_two_panel_layout_visible(self) -> "FrameworkClauseDetailPage":
        """Assert the left panel's heading, search input, and status filter
        all render — the two-panel layout's left half."""
        expect(self.page.get_by_role("heading", name="Domain & Clauses", exact=True)).to_be_visible()
        expect(self.page.get_by_placeholder("Search Clauses", exact=True)).to_be_visible()
        expect(self._status_filter_trigger()).to_be_visible()
        return self

    def assert_domain_clauses_heading_visible(self) -> "FrameworkClauseDetailPage":
        expect(self.page.get_by_role("heading", name="Domain & Clauses", exact=True)).to_be_visible()
        return self

    def assert_search_clauses_placeholder(self) -> "FrameworkClauseDetailPage":
        expect(self.page.get_by_placeholder("Search Clauses", exact=True)).to_be_visible()
        return self

    def assert_search_clauses_value(self, value: str) -> "FrameworkClauseDetailPage":
        expect(self.page.get_by_placeholder("Search Clauses")).to_have_value(value)
        return self

    # ==========================================
    #             ASSERTIONS — STATUS FILTER
    # ==========================================

    def assert_status_filter_placeholder(self) -> "FrameworkClauseDetailPage":
        """Assert the filter reads its literal unset placeholder "All
        Status" — only meaningful before any selection (its own displayed
        text becomes the current value once one is picked, see
        _status_filter_trigger's docstring)."""
        expect(self._status_filter_trigger()).to_have_text("All Status")
        return self

    def assert_status_filter_option_list(self, options: list[str]) -> "FrameworkClauseDetailPage":
        """Assert the filter's full, ordered option list — confirmed exactly
        ['Implemented', 'Partial', 'Gap'], no "All" entry. Leaves the panel
        closed again afterward."""
        self.click(self._status_filter_trigger())
        self.page.get_by_role("listbox").last.wait_for(state="visible", timeout=3000)
        texts = self.page.get_by_role("listbox").last.get_by_role("option").all_text_contents()
        assert [t.strip() for t in texts] == options
        self.page.keyboard.press("Escape")
        return self

    # ==========================================
    #             ASSERTIONS — DOMAIN ACCORDION
    # ==========================================

    def assert_domain_visible(self, code_or_name: str) -> "FrameworkClauseDetailPage":
        expect(self._domain_header(code_or_name)).to_be_visible()
        return self

    def assert_domain_absent(self, code_or_name: str) -> "FrameworkClauseDetailPage":
        """Assert no VISIBLE domain header matches `code_or_name` — used for
        the search/filter "whole domain disappears" behavior."""
        expect(self._domain_header(code_or_name)).to_have_count(0)
        return self

    def assert_domain_count(self, n: int) -> "FrameworkClauseDetailPage":
        expect(self._domain_headers()).to_have_count(n)
        return self

    def assert_no_domain_count_badge(self, code_or_name: str) -> "FrameworkClauseDetailPage":
        """Assert `code_or_name`'s header renders NO right-aligned count
        badge — confirmed live via raw outerHTML inspection of every domain
        header: no badge element exists at all, on any domain, at any filter
        state. FW_FR_CLAUSE_01/FWC_008 require this feature to exist;
        FWC_026 (a 0-count badge on an empty domain) is doubly unbuildable
        since no domain-level-empty fixture exists either (only whole-
        framework-empty). Kept so both fail honestly."""
        header = self._domain_header(code_or_name)
        badge_count = header.locator("span, div, p").filter(has_text=re.compile(r"^\d+$")).count()
        assert badge_count == 0
        return self

    def assert_domain_collapsed(self, code_or_name: str) -> "FrameworkClauseDetailPage":
        assert self._is_domain_collapsed(code_or_name) is True
        return self

    def assert_domain_expanded(self, code_or_name: str) -> "FrameworkClauseDetailPage":
        assert self._is_domain_collapsed(code_or_name) is False
        return self

    def assert_only_domain_expanded(self, code_or_name: str) -> "FrameworkClauseDetailPage":
        """Assert `code_or_name` is the ONLY expanded domain among all
        currently visible ones — proves the single-expand behavior confirmed
        live (opening one domain collapses whichever was open)."""
        headers = self._domain_headers()
        count = headers.count()
        for i in range(count):
            header = headers.nth(i)
            text = header.inner_text().strip()
            collapsed = self._is_header_collapsed(header)
            assert collapsed == (code_or_name not in text), f'domain "{text}" expand state'
        return self

    # ==========================================
    #             ASSERTIONS — CLAUSE ROWS
    # ==========================================

    def assert_clause_row_visible(self, code: str) -> "FrameworkClauseDetailPage":
        expect(self._clause_row(code)).to_be_visible()
        return self

    def assert_clause_row_absent(self, code: str) -> "FrameworkClauseDetailPage":
        """Assert no VISIBLE clause row matches `code` — used for
        search/filter narrowing."""
        expect(self._clause_row(code)).to_have_count(0)
        return self

    def assert_clause_row_count(self, n: int) -> "FrameworkClauseDetailPage":
        """Assert the number of currently VISIBLE clause rows — naturally
        scoped to whichever single domain is expanded (or the full filtered
        set, if the caller wants a cross-domain total while everything
        happens to be visible)."""
        expect(self._clause_rows()).to_have_count(n)
        return self

    def assert_clause_row_status_icon(self, code: str, status: str) -> "FrameworkClauseDetailPage":
        """Assert `code`'s row shows the correct-colored warning-triangle
        icon for `status` ('Partial' | 'Gap' only — see module docstring for
        why 'Implemented' isn't representable). Confirmed live that BOTH
        statuses render the identical triangle SVG path, color-only
        differentiated, and no clause anywhere is Implemented (so the design
        mock's separate checkmark-circle icon has no live counterpart to
        assert against — FWC_009's Implemented half stays unbuildable)."""
        icon = self._clause_row(code).locator("svg").first
        expect(icon).to_have_class(re.compile(STATUS_ICON_COLOR[status]))
        return self

    def assert_clause_selected(self, code: str) -> "FrameworkClauseDetailPage":
        """Assert `code`'s row carries the selected-state classes (light-blue
        background + thicker left border)."""
        row = self._clause_row(code)
        expect(row).to_have_class(re.compile(SELECTED_BG_CLASS))
        expect(row).to_have_class(re.compile(SELECTED_BORDER_CLASS))
        return self

    def assert_only_clause_selected(self, code: str) -> "FrameworkClauseDetailPage":
        """Assert exactly one visible clause row carries the selected-state
        classes, and it's `code`'s — proves the highlight moves off the
        previously-selected row (FWC_021)."""
        data = self._clause_rows().evaluate_all(
            """(els, { bgClass, borderClass }) => els.map(el => ({
                text: (el.innerText || '').trim(),
                selected: el.classList.contains(bgClass) && el.classList.contains(borderClass),
            }))""",
            {"bgClass": SELECTED_BG_CLASS, "borderClass": SELECTED_BORDER_CLASS},
        )
        selected = [d for d in data if d["selected"]]
        assert len(selected) == 1
        assert code in selected[0]["text"]
        return self

    # ==========================================
    #             ASSERTIONS — RIGHT PANEL / CLAUSE DETAIL
    # ==========================================

    def assert_select_clause_message_visible(self) -> "FrameworkClauseDetailPage":
        expect(self.page.get_by_text("Select a clause to view its details", exact=True)).to_be_visible()
        return self

    def assert_clause_heading_visible(self, code: str) -> "FrameworkClauseDetailPage":
        expect(self.page.get_by_role("heading", level=2).filter(has_text=code)).to_be_visible()
        return self

    def assert_objective_section_has_content(self) -> "FrameworkClauseDetailPage":
        """Assert the `Objective` heading renders with non-empty body text
        below it."""
        heading = self.page.get_by_role("heading", name="Objective", exact=True)
        expect(heading).to_be_visible()
        text = heading.locator("xpath=..").inner_text().replace("Objective", "").strip()
        assert len(text) > 0
        return self

    def assert_evidence_expectation_section_has_content(self) -> "FrameworkClauseDetailPage":
        """Assert the `Evidence Expectation` heading renders with non-empty
        body text below it."""
        heading = self.page.get_by_role("heading", name="Evidence Expectation", exact=True)
        expect(heading).to_be_visible()
        text = heading.locator("xpath=..").inner_text().replace("Evidence Expectation", "").strip()
        assert len(text) > 0
        return self

    def assert_requirement_section_visible(self) -> "FrameworkClauseDetailPage":
        """FW_FR_CLAUSE_02/FWC_025-required: the right panel must render a
        `Requirement` section alongside Objective and Evidence Expectation.
        Confirmed ABSENT — dumping every h1-h6 for multiple clauses across
        all 3 non-empty frameworks turns up only the other two. Kept so
        FWC_025 fails honestly (1 of 3 required sections missing) instead of
        being silently dropped."""
        expect(self.page.get_by_role("heading", name="Requirement", exact=True)).to_be_visible()
        return self

    def assert_mapped_controls_header_visible(self) -> "FrameworkClauseDetailPage":
        """Assert the real live heading — `Mapped Controls`, Title Case, no
        "SCF", no count, in any clause state."""
        expect(self.page.get_by_role("heading", name="Mapped Controls", exact=True)).to_be_visible()
        return self

    def assert_mapped_controls_header_count(self, n: int) -> "FrameworkClauseDetailPage":
        """FWC_004/FWC_013/FWC_022-required: the header must show an explicit
        count suffix (their own wording: "MAPPED SCF CONTROLS (n)").
        Confirmed ABSENT in every clause state checked, including Gap and
        0-control — the real heading is bare `Mapped Controls`. Kept so those
        cases fail honestly against the wrong string rather than silently
        passing."""
        expect(self.page.get_by_role("heading", name=f"Mapped Controls ({n})", exact=True)).to_be_visible()
        return self

    def assert_gap_warning_visible(self) -> "FrameworkClauseDetailPage":
        """Assert the Gap-only warning copy, verbatim (including the em
        dash)."""
        expect(self.page.get_by_text("No controls mapped — this clause is a Gap.", exact=True)).to_be_visible()
        return self

    def assert_propose_mapping_button_visible(self) -> "FrameworkClauseDetailPage":
        expect(self.page.get_by_role("button", name="Propose Mapping", exact=True)).to_be_visible()
        return self

    def assert_propose_mapping_button_absent(self) -> "FrameworkClauseDetailPage":
        expect(self.page.get_by_role("button", name="Propose Mapping", exact=True)).to_have_count(0)
        return self

    def assert_propose_mapping_modal_open(self) -> "FrameworkClauseDetailPage":
        """FWC_016-required: clicking `+ Propose Mapping` must open a
        "Propose Mapping" modal with a `Search Control` input and
        `Discard`/`Submit` buttons. Confirmed live this is a no-op — no
        dialog, toast, or [role=dialog] of any kind appears (see module
        docstring, citing the prior frameworks-library pass's identical
        finding). Kept so FWC_016 fails honestly against the real (absent)
        behavior."""
        dialog = self.page.get_by_role("dialog").filter(has_text="Propose Mapping")
        expect(dialog).to_be_visible()
        expect(dialog.get_by_placeholder("Search Control")).to_be_visible()
        expect(dialog.get_by_role("button", name="Discard", exact=True)).to_be_visible()
        expect(dialog.get_by_role("button", name="Submit", exact=True)).to_be_visible()
        return self

    def assert_in_scope_badge_visible(self) -> "FrameworkClauseDetailPage":
        """Assert the undocumented `In Scope` secondary badge renders beside
        the status badge."""
        expect(self.page.get_by_text("In Scope", exact=True)).to_be_visible()
        return self

    def assert_about_state_dialog_visible(self, status: str, body_text: str | None = None) -> "FrameworkClauseDetailPage":
        """Assert the `About <Status> State` dialog is open, optionally
        checking its body copy."""
        dialog = self.page.get_by_role("dialog").filter(has_text=f"About {status} State")
        expect(dialog).to_be_visible()
        if body_text:
            expect(dialog).to_contain_text(body_text)
        return self

    def assert_create_soa_button_visible(self) -> "FrameworkClauseDetailPage":
        expect(self.page.get_by_role("button", name="Create SOA", exact=True)).to_be_visible()
        return self

    def assert_create_soa_button_absent(self) -> "FrameworkClauseDetailPage":
        """Assert `Create SOA` is absent — confirmed live it never renders
        for Partial clauses (Gap-only affordance)."""
        expect(self.page.get_by_role("button", name="Create SOA", exact=True)).to_have_count(0)
        return self

    # ==========================================
    #             ASSERTIONS — MAPPED CONTROL CARDS (UNBUILDABLE LIVE)
    # ==========================================

    def assert_mapped_controls_count(self, n: int) -> "FrameworkClauseDetailPage":
        """Assert `n` mapped-control cards render. UNBUILDABLE against any
        live fixture — no clause anywhere (9 Partial + 2 Gap, across all 3
        non-empty frameworks) has ≥1 mapped control; every Mapped Controls
        section renders zero cards regardless of status. Satisfies FWC_013's
        card-count half; kept so it fails honestly (0 found) rather than
        being dropped."""
        expect(self._mapped_control_cards()).to_have_count(n)
        return self

    def assert_mapped_control_card(
        self,
        control_id: str,
        mapping_type: str,
        applicability: str,
        name: str,
        owner: str,
        effectiveness_pct: float,
        evidence_count: int,
    ) -> "FrameworkClauseDetailPage":
        """Assert a single mapped-control card for `control_id` renders every
        FW_FR_CLAUSE_04 field: mapping type, applicability, name, owner,
        effectiveness %, and evidence count (Control ID linking is covered
        separately by click_control_id_link/assert_navigated_to_control_
        detail). UNBUILDABLE — no clause anywhere has a mapped control card
        to inspect (see _mapped_control_cards's docstring). Satisfies
        FWC_002, FWC_003, FWC_011, FWC_022, FWC_027."""
        card = self._mapped_control_cards().filter(has_text=control_id)
        expect(card).to_be_visible()
        expect(card).to_contain_text(mapping_type)
        expect(card).to_contain_text(applicability)
        expect(card).to_contain_text(name)
        expect(card).to_contain_text(f"Owner {owner}")
        expect(card).to_contain_text(f"Effectiveness {effectiveness_pct}%")
        expect(card).to_contain_text(f"Evidence {evidence_count}")
        return self

    def assert_navigated_to_control_detail(self, control_id: str) -> "FrameworkClauseDetailPage":
        """Assert the page navigated to `control_id`'s detail route in the
        Controls module, after click_control_id_link. UNBUILDABLE — no
        Control ID link exists anywhere live (FWC_015)."""
        expect(self.page).to_have_url(re.compile(rf".*/controls/.*{re.escape(control_id)}"))
        return self

    def assert_keyword_tags_visible(self, tags: list[str]) -> "FrameworkClauseDetailPage":
        """Assert each of `tags` renders as a keyword tag below Mapped
        Controls. UNBUILDABLE — no clause with tag data was found on any
        fixture (FWC_014)."""
        for tag in tags:
            expect(self.page.get_by_text(tag, exact=True)).to_be_visible()
        return self

    # ==========================================
    #             ASSERTIONS — EMPTY / NO-RESULTS STATES
    # ==========================================

    def assert_no_domains_empty_state(self) -> "FrameworkClauseDetailPage":
        """Assert the zero-domains empty state (confirmed verbatim on the
        Draft fixture fwXOGmGxko): left panel's "No domains" heading + body,
        right panel's default select-a-clause message."""
        expect(self.page.get_by_role("heading", name="No domains", exact=True)).to_be_visible()
        expect(self.page.get_by_text("No domains available for this framework", exact=True)).to_be_visible()
        self.assert_select_clause_message_visible()
        return self

    def assert_no_results_found(self) -> "FrameworkClauseDetailPage":
        """Assert the shared "no results" empty state for a non-matching
        search/filter. NOTE the body copy differs from the Frameworks
        Library's own empty state ("Try adjusting your filters or search
        terms" here vs. "Try adjusting your search terms" there) — do not
        reuse one file's constant for the other."""
        expect(self.page.get_by_role("heading", name="No results found!", exact=True)).to_be_visible()
        expect(
            self.page.get_by_text(
                "We couldn't find any matches for your search. Try adjusting your filters or search terms",
                exact=True,
            )
        ).to_be_visible()
        return self

    # ==========================================
    #             ASSERTIONS — ACCESS CONTROL
    # ==========================================

    def assert_access_denied(self) -> "FrameworkClauseDetailPage":
        """Required RBAC behaviour for FWC_024: a user without "Framework
        View" permission should not reach this tab or see its data. Confirmed
        live (2026-08-04) a Normal user loads the full tab with no block, so
        this fails honestly today."""
        expect(self.page.get_by_role("heading", name="Domain & Clauses", exact=True)).to_have_count(0)
        return self
