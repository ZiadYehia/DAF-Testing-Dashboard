"""Frameworks Library Page — GRC Framework Library (/grc/frameworks).

Hosts both the card grid (frameworks-library feature, DT-3168) and the KPI
summary row above it (framework-library-kpi-summary feature, DT-3482) — one
page object serves both features since they're the same live page.

Ported 1:1 from pages/grc/frameworks-library.page.ts — see that file's
docstring for the full list of quirks verified live on 2026-07-21 (missing
library tabs, search-now-works, nav-mismatch bug, frozen KPI on filter,
2-badge card layout instead of the story's 4-badge one).

SUPERSEDED/CORRECTED 2026-08-03 (build `a146218221`) — the catalog grew from
a single-fixture tenant to a real 453-framework catalog and several of the
2026-07-21 premises moved with it. Current live truth (see the TS file's
docstring for the fully detailed writeup, kept in sync here):
- Toolbar is "Search Frameworks" input · "All status" multi-select ·
  "All Regions" multi-select · "Sort by" combobox · a "Sort Direction"
  toggle — there is NO "All categories"/"All Types"/"All Alerts" dropdown.
- Status options: Active, Inactive, Draft, Retired (Retired has zero live
  records. SUPERSEDED 2026-08-04 — the "no retire/archive/deactivate action
  exists anywhere in the UI" claim below is now WRONG: see the CARD STATUS
  TOGGLE block further down. The new action still only ever lands on
  Inactive, never Retired, so Retired remains unreachable via any confirmed
  UI action). Region options: APAC, US, EMEA, General, Americas — card region badges always
  render ALL CAPS while 2 of the 5 filter labels are title-case, so region
  comparisons here normalize case.
- Sort options: Name, Creation date, Audit readiness, Updated at. The
  "Sort by" combobox displays the literal placeholder "Sort by" when
  nothing is selected and the chosen key's label once picked.
- Every card carries a yyyy-mm-dd date; no KPI tile does — the decisive way
  to tell them apart, used by `_cards()` below instead of trusting a CSS
  class alone.
- Card anatomy differs sharply by status: ACTIVE renders name/Active badge/
  region/date/Audit Readiness %/3 control-count badges; INACTIVE renders
  the same minus the last 3 fields; DRAFT omits the region row entirely (no
  placeholder). No card of any status has a description line.
- Search/filter/sort do NOT persist across navigating away and back — no
  session/local-storage/query-string persistence mechanism exists at all.
- Cards have NO hover state and no cursor: pointer despite being genuinely
  clickable (the old nav-mismatch bug is FIXED — card click now lands on
  its own framework's detail page).
- A Normal user sees the identical unscoped 453-framework catalog, KPIs,
  and an enabled Activate Framework button — no tenant scoping, no
  permission gate.
- 50 framework cards render per page (no pagination control).

CARD STATUS TOGGLE (activate/deactivate), confirmed live 2026-08-04, build
dca9938158 — product change: activation no longer requires an owner (zero
owners is valid, see FrameworkActivateWizardPage), and a deactivate/
reactivate action now exists. The product owner confirmed this is the SAME
control that also lives on the framework detail page
(FrameworkDetailOverviewPage.toggle_status/toggle_status_and_confirm) — not
a separate Library-only affordance:
- Each card renders the toggle as an input.sr-only.peer inside a <label>,
  immediately beside the card's status text — [checked] when Active,
  unchecked when Inactive. The input itself is visually hidden behind a
  styled sibling (div.relative.w-10.h-6.rounded-full…), so a click MUST
  target the <label> (or that styled peer), never the sr-only input
  directly — a real click on the hidden input either fails or silently
  does nothing. get_by_role would also skip it entirely (it resolves
  against the accessibility tree, which excludes hidden nodes) — this is
  exactly the sr-only trap this framework's locator-discipline rule warns
  about.
- Clicking it opens a confirmation dialog: title "Deactivate Framework" /
  body 'Are you sure you want to deactivate "<Framework Name>"?' / buttons
  "Cancel", "Yes, Deactivate" when leaving Active; the mirror "Activate
  Framework" / 'Are you sure you want to activate "<Framework Name>"?' /
  "Cancel", "Yes, Activate" when leaving Inactive.
- After confirming, the mutation triggers a navigation and the grid/KPI
  values settle over roughly 9 seconds — _wait_for_card_status_settled
  below polls rather than asserting immediately, mirroring
  _wait_for_grid_settled.
- Card shape follows status exactly as already documented above (full
  Active shape vs. the reduced Inactive shape) — reactivating/deactivating
  a card flips it between the two, which is what assert_active_card_shape/
  assert_reduced_card_shape (already existing, reused here) confirm.

FRAMEWORK-LIBRARY-KPI-SUMMARY ground truth (DT-3482), confirmed live
2026-08-03, same build — the KPI row above the grid (`Total Frameworks 453 /
In catalog`, `Active 47 / Contributing to coverage`, `Drafts 6 / Pending
activation`, `Avg Readiness 16.55%`, no sub-label on the 4th tile):
- The Avg Readiness tile DOES render a real progress-bar fill (a plain div
  with an inline `width: NN.NN%` style, no ARIA role/`<progress>` tag) —
  contradicts both the KPI test cases' "no progress bar" premise and this
  file's own now-outdated `assert_no_avg_readiness_progress_bar` method name
  (kept for an existing test; see its docstring).
- Tiles are strictly view-only: no links/buttons/handlers/tabIndex/role,
  `cursor: auto`, clicking changes nothing (verified via a real click on all
  four, not a programmatic one).
- Tiles do NOT refresh on search/filter, including down to zero matches —
  they stay frozen at 453/47/6/16.55% (filed defect, FW_FR_KPI_SUMMARY_05).
"""
from __future__ import annotations

import os
import re

from playwright.sync_api import expect

from autotest_framework.config import config
from autotest_framework.src.pages.base_page import BasePage
from pages.grc.login_page import LoginPage

# Every framework card (any status) is a `div.p-4.rounded-lg.border` — the
# class list also picks up a border-color modifier class that varies (not
# matched here since `.p-4.rounded-lg.border` matches regardless of extra
# classes). This selector alone isn't unique to cards elsewhere on the page,
# so `_cards()` below ALWAYS additionally filters on the `yyyy-mm-dd` date
# text every card (and no KPI tile) carries — never rely on this class list
# alone without that filter.
CARD_SELECTOR = "div.p-4.rounded-lg.border"
DATE_TEXT_PATTERN = re.compile(r"\d{4}-\d{2}-\d{2}")
REGION_TOKENS = ["APAC", "US", "EMEA", "GENERAL", "AMERICAS"]


class FrameworksLibraryPage(BasePage):
    """Framework Library page — card grid + KPI summary row."""

    def __init__(self, page):
        super().__init__(page, "Frameworks Library Page")
        # Set by toggle_sort_direction(); read by assert_sort_direction_toggle_changed_state().
        self._last_sort_direction_changed: bool | None = None
        # Set by capture_card_order(); read by assert_card_order_{changed,reversed}_from_captured().
        self._last_card_order_before_sort: list[str] | None = None

    def open(self) -> "FrameworksLibraryPage":
        self.navigate(f"{config.base_url}/grc/frameworks")
        self._wait_for_library_ready()
        return self

    def open_as_normal_user(self) -> "FrameworksLibraryPage":
        """Log in fresh as the second/normal-user credential (GRC_LOGIN_USER_ALT,
        =user2) and land on the Library. Drives the SAME LoginPage/config
        mechanism as the primary user — it just temporarily points the
        username env var LoginPage/config reads at the alt user's value for
        the duration of the login call, rather than hand-rolling a second
        login flow. Mirrors FrameworkActivateWizardPage.open_as_normal_user.
        Used for FWL_023/FWL_024 — confirmed live (2026-08-03) this user sees
        the IDENTICAL unscoped catalog/KPIs and an enabled Activate button, so
        the access-control assertions below are expected to fail honestly
        today."""
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
        self.navigate(f"{config.base_url}/grc/frameworks")
        self._wait_for_library_ready()
        return self

    def open_unauthenticated(self) -> "FrameworksLibraryPage":
        """Navigate straight to the Library with no auth/storage state — used
        for the unauthenticated-redirect case (KPI_015). Mirrors
        FrameworkActivateWizardPage.open_unauthenticated. Deliberately
        doesn't call _wait_for_library_ready() — the whole point being
        tested is that the Library never renders; the app redirects to
        /login first."""
        self.navigate(f"{config.base_url}/grc/frameworks")
        return self

    # ==========================================
    #             INTERNAL HELPERS
    # ==========================================

    def _cards(self):
        """All currently VISIBLE framework cards.

        Two filters, both load-bearing:
        - has_text=DATE_TEXT_PATTERN separates framework cards from KPI tiles
          and any other bordered box — every card carries a yyyy-mm-dd date,
          no tile does.
        - has_not=CARD_SELECTOR keeps only the INNERMOST match. The card's own
          wrapper also satisfies CARD_SELECTOR, so without this every count came
          back doubled (a one-result search asserted 2), which silently broke
          every count- and shape-based assertion built on top of this."""
        return (self.page.locator(f"{CARD_SELECTOR}:visible")
                .filter(has_text=DATE_TEXT_PATTERN)
                .filter(has_not=self.page.locator(CARD_SELECTOR)))

    def _card_locator(self, name: str):
        """The single visible card container whose exact text (not a substring)
        equals `name` — never `get_by_text(name, exact=True).click()` alone,
        that hits the fragile nested text node."""
        return self._cards().filter(has=self.page.get_by_text(name, exact=True))

    def _visible_card_names(self) -> list[str]:
        """Ordered list of currently visible cards' names (each card's first rendered text line)."""
        inner_texts = self._cards().all_inner_texts()
        return [t.strip().split("\n")[0].strip() for t in inner_texts]

    def _visible_card_dates(self) -> list[str]:
        """Ordered list of currently visible cards' Creation Date values (the
        one date field every card, of any status, always renders)."""
        inner_texts = self._cards().all_inner_texts()
        out = []
        for t in inner_texts:
            m = DATE_TEXT_PATTERN.search(t)
            out.append(m.group(0) if m else "")
        return out

    def _visible_card_readiness_values(self) -> list[float]:
        """Ordered list of currently visible cards' Audit Readiness percentage
        as a number — float('nan') for a card with no readiness line
        (Inactive/Draft). Only meaningful once the grid is filtered to
        Active-only, matching how this sort key was verified live (Active
        filter + Sort by Audit readiness); callers sorting the unfiltered grid
        by this field will see NaN entries for every non-Active card."""
        inner_texts = self._cards().all_inner_texts()
        out = []
        for t in inner_texts:
            m = re.search(r"Audit Readiness[\s\S]*?(\d+)%", t)
            out.append(float(m.group(1)) if m else float("nan"))
        return out

    def _grid_signature(self) -> str:
        """`<count>|<first card name>` — enough to tell one result set from another."""
        names = self._visible_card_names()
        return f"{len(names)}|{names[0] if names else ''}"

    def _wait_for_grid_settled(self, before: str) -> None:
        """Wait for a search/filter/sort change to actually take effect, given
        the grid signature captured BEFORE the change. Ported from the
        identical lesson in framework_activate_wizard_page.py: waiting for
        "the card count stops changing" alone is not enough, since the
        PRE-change grid is already stable and two equal reads land before the
        debounced request is even sent. So: first wait for the grid to differ
        from `before` (or the empty state to appear), then wait for it to stop
        moving."""
        empty_state = self.page.get_by_role("heading", name="No results found!", exact=True)
        for _ in range(60):
            try:
                if empty_state.is_visible():
                    return
            except Exception:
                pass
            if self._grid_signature() != before:
                break
            self.page.wait_for_timeout(150)
        previous = ""
        for _ in range(40):
            try:
                if empty_state.is_visible():
                    return
            except Exception:
                pass
            signature = self._grid_signature()
            if not signature.startswith("0|") and signature == previous:
                return
            previous = signature
            self.page.wait_for_timeout(150)

    def _wait_for_library_ready(self) -> None:
        """Wait for the Library to have actually hydrated: cards render a beat
        after navigation, so reading DOM state immediately after open() can
        observe zero cards. Waits for the heading AND at least one visible
        card."""
        expect(self.page.get_by_role("heading", name="Framework Library")).to_be_visible()
        expect(self._cards().first).to_be_visible()

    def _sort_direction_toggle(self):
        """The sort-direction toggle is a plain <div title="Sort Direction"> — no
        role, no aria-label. get_by_label does NOT match title, so the earlier
        get_by_label("Sort Direction") never resolved, silently breaking every
        direction-related assertion and the toolbar-order check."""
        # Title-agnostic on purpose: the control's title is DYNAMIC — it reads
        # "Sort Direction" only before the first interaction and then becomes
        # "Ascending"/"Descending", so get_by_title("Sort Direction") stops
        # matching exactly when a direction assertion needs it. Match the
        # toolbar's single icon-only square control instead.
        return self.page.locator("div.h-10.w-8[title]").first

    def _sort_direction_signature(self) -> str:
        """Snapshot of the Sort Direction toggle's own visual/ARIA state
        (aria-pressed, aria-label, class list, computed transform) — used to
        prove the control itself signals a state change on click, without
        needing to know in advance which specific mechanism (icon rotation vs
        aria-pressed vs class) the live control uses."""
        return self._sort_direction_toggle().evaluate(
            """el => JSON.stringify({
                ariaPressed: el.getAttribute('aria-pressed'),
                ariaLabel: el.getAttribute('aria-label'),
                className: el.className,
                transform: getComputedStyle(el).transform,
            })"""
        )

    def _card_toggle_input(self, name: str):
        """`name`'s card's toggle <input> — always input.sr-only.peer,
        visually hidden (see module docstring's CARD STATUS TOGGLE block).
        Read-only lookups (e.g. checked state) are safe against this
        element; CLICKS must go through _card_toggle_label instead."""
        return self._card_locator(name).locator("input.sr-only.peer")

    def _card_toggle_label(self, name: str):
        """`name`'s card's toggle <label> wrapper — the only safe click
        target for the status toggle (see module docstring's CARD STATUS
        TOGGLE block: clicking the sr-only input itself either fails or
        no-ops). :has() is a Playwright-engine CSS extension, not a native
        browser feature — supported the same way :visible is used
        elsewhere in this file."""
        return self._card_locator(name).locator("label:has(input.sr-only.peer)")

    def _status_toggle_dialog(self):
        """The activate/deactivate confirmation dialog — same component
        whichever direction the toggle just flipped."""
        # The confirm overlay is a PLAIN div.fixed.inset-0 (z-[1200],
        # bg-black/50) with NO role=dialog and no PrimeVue dialog class, so
        # get_by_role("dialog") finds nothing and the visibility check times
        # out. Anchor on the overlay's own body copy, stable both directions.
        return (self.page.locator("div.fixed.inset-0:visible")
                .filter(has_text=re.compile(r"Are you sure you want to (activate|deactivate)", re.I))
                .first)

    def _wait_for_card_status_settled(self, name: str, expected_status: str) -> None:
        """Poll `name`'s card until its status text reads `expected_status`,
        mirroring _wait_for_grid_settled's manual-poll convention (there is
        no expect.poll equivalent in playwright.sync_api — see this
        framework's locator-discipline rule — so this is the same plain
        loop as the TS twin). Confirmed live the post-confirm mutation
        settles over roughly 9 seconds (60 * 150ms)."""
        pattern = re.compile(rf"\b{expected_status}\b")
        for _ in range(60):
            try:
                text = self._card_locator(name).inner_text()
            except Exception:
                text = ""
            if pattern.search(text):
                return
            self.page.wait_for_timeout(150)

    def _with_filter_panel_open(self, dropdown_label: str, fn):
        """Open `dropdown_label`'s panel, run `fn` against its freshly-opened
        listbox, then close the panel again (Escape) regardless of outcome."""
        # Click the multi-select STRUCTURALLY, via the wrapper containing the
        # filter's (hidden) placeholder input. Clicking get_by_text(label) only
        # works while nothing is selected — once an option is picked the
        # trigger's visible text becomes the selection (e.g. "Draft"), so the
        # text lookup finds nothing and the click times out.
        self.click(self.page.locator(".p-multiselect")
                   .filter(has=self.page.get_by_placeholder(dropdown_label)).first)
        self.page.get_by_role("listbox").last.wait_for(state="visible", timeout=3000)
        try:
            return fn()
        finally:
            self.page.keyboard.press("Escape")

    # ==========================================
    #             TOOLBAR
    # ==========================================

    def search(self, term: str) -> "FrameworksLibraryPage":
        """Type into the 'Search Frameworks' input (dynamic filter, no submit
        action needed) and wait for the debounced grid update to settle."""
        before = self._grid_signature()
        self.fill(self.page.get_by_placeholder("Search Frameworks"), term)
        self._wait_for_grid_settled(before)
        return self

    def toggle_filter_option(self, dropdown_label: str, option_label: str) -> "FrameworksLibraryPage":
        """dropdown_label one of 'All status' | 'All categories' | 'All Regions'.
        'All categories' is kept as an accepted value for source
        compatibility with existing tests that reference it — confirmed live
        (2026-08-03) that dropdown no longer exists at all (see module
        docstring's SUPERSEDED section); new cases should only pass
        'All status' or 'All Regions'. Waits for the debounced grid update to
        settle after selecting."""
        before = self._grid_signature()
        self.click(self.page.get_by_text(dropdown_label, exact=True))
        self.page.get_by_role("listbox").last.wait_for(state="visible", timeout=3000)
        self.click(self.page.get_by_role("option", name=option_label, exact=True))
        self.page.keyboard.press("Escape")
        self._wait_for_grid_settled(before)
        return self

    def sort_by(self, key: str) -> "FrameworksLibraryPage":
        """Open the 'Sort by' combobox and pick a sort key ('Name' |
        'Creation date' | 'Audit readiness' | 'Updated at'), then wait for the
        grid to settle into its new order."""
        before = self._grid_signature()
        self.click(self.page.get_by_role("combobox", name="Sort by"))
        self.page.get_by_role("listbox").last.wait_for(state="visible", timeout=3000)
        self.click(self.page.get_by_role("option", name=key, exact=True))
        self._wait_for_grid_settled(before)
        return self

    def toggle_sort_direction(self) -> "FrameworksLibraryPage":
        """Click the sort-direction toggle icon, wait for the grid to
        re-settle, and record whether the toggle's OWN visual/ARIA state
        changed (read via assert_sort_direction_toggle_changed_state()) — see
        that method's docstring for why this is captured generically rather
        than against one hardcoded mechanism."""
        before_toggle = self._sort_direction_signature()
        before_grid = self._grid_signature()
        self.click(self._sort_direction_toggle())
        self._wait_for_grid_settled(before_grid)
        after_toggle = self._sort_direction_signature()
        self._last_sort_direction_changed = before_toggle != after_toggle
        return self

    def click_activate_framework(self) -> "FrameworksLibraryPage":
        self.click(self.page.get_by_role("button", name="Activate Framework"))
        self.wait_for_url("**/grc/frameworks/activate**")
        return self

    def click_card(self, card_title: str) -> "FrameworksLibraryPage":
        """Click a framework card by its visible title; stays on this class
        (no details page object yet) — callers use assert_details_page_shows_
        framework (or the assert_details_* metadata assertions below) to
        verify the result."""
        self.click(self.page.get_by_text(card_title, exact=True).first)
        self.wait_for_url(re.compile(r".*/grc/frameworks/details/.*"))
        return self

    def return_to_library_via_sidebar(self) -> "FrameworksLibraryPage":
        """Click the GRC sidebar's 'Frameworks' nav item to return to the
        Library from any other GRC page — a plain in-app SPA nav click,
        distinct from a fresh open() (which re-runs the full login flow).
        Used for the navigate-away-and-back persistence checks (FWL_014).
        `.first` guards against a page that also renders a breadcrumb link
        with the same accessible name."""
        self.click(self.page.get_by_role("link", name="Frameworks", exact=True).first)
        expect(self.page).to_have_url(re.compile(r".*/grc/frameworks/?$"))
        self._wait_for_library_ready()
        return self

    def capture_card_order(self) -> "FrameworksLibraryPage":
        """Capture the current visible-card name order for later comparison
        via assert_card_order_changed_from_captured() /
        assert_card_order_reversed_from_captured() — the only way to verify a
        reorder for a sort key with no directly re-derivable per-card field
        (e.g. 'Updated at', which no card face displays)."""
        self._last_card_order_before_sort = self._visible_card_names()
        return self

    # ==========================================
    #             CARD STATUS TOGGLE
    # ==========================================

    def toggle_card_status(self, name: str) -> "FrameworksLibraryPage":
        """Click `name`'s card status toggle (via its <label>, never the
        hidden sr-only input — see _card_toggle_label's docstring) and wait
        for the confirmation dialog to open. Leaves the dialog open — pair
        with a real click on Cancel/Yes, Activate/Yes, Deactivate, or prefer
        toggle_card_status_and_confirm for the full flow."""
        self.click(self._card_toggle_label(name))
        expect(self._status_toggle_dialog()).to_be_visible()
        return self

    def toggle_card_status_and_confirm(self, name: str, expected_status: str) -> "FrameworksLibraryPage":
        """Toggle `name`'s card status, confirm the resulting dialog
        ("Yes, Activate" when expected_status is "Active", "Yes,
        Deactivate" when it's "Inactive"), and wait for the card to settle
        on expected_status (see _wait_for_card_status_settled — the
        mutation triggers a navigation that takes several seconds to
        reflect, so a plain post-confirm assertion flakes). Reversible —
        the same control can flip it right back."""
        self.click(self._card_toggle_label(name))
        expect(self._status_toggle_dialog()).to_be_visible()
        confirm_label = "Yes, Activate" if expected_status == "Active" else "Yes, Deactivate"
        self.click(self.page.get_by_role("button", name=confirm_label, exact=True))
        self._wait_for_card_status_settled(name, expected_status)
        return self

    def restore_status(self, name: str, target_status: str) -> "FrameworksLibraryPage":
        """Idempotent, non-throwing teardown helper for mutating tests (e.g.
        FWL_030/FWL_031/FWL_032/KPI_019/KPI_020/KPI_021) that toggle a
        fixture's status as part of their body: search for `name` so it's
        guaranteed present in the currently rendered (max-50-card) grid
        regardless of its default sort position, read its toggle's CURRENT
        checked state directly (never an assert-based check, which
        raises), and, only if it doesn't already match target_status,
        toggle + confirm + wait for settle to bring it back. Deliberately
        asserts nothing and swallows any error — a throwing teardown would
        mask the real test's outcome (see each mutating test's local
        restore fixture). The search step is inlined here rather than
        calling the public search() method, for consistency with the TS
        twin's "never call one public fluent method from inside another"
        rule; same reasoning for reusing
        _card_toggle_input/_card_toggle_label/_wait_for_card_status_settled
        instead of calling toggle_card_status_and_confirm. Mirrors
        FrameworkDetailOverviewPage.restore_status."""
        try:
            before = self._grid_signature()
            self.fill(self.page.get_by_placeholder("Search Frameworks"), name)
            self._wait_for_grid_settled(before)

            input_ = self._card_toggle_input(name)
            if input_.count() == 0:
                return self  # fixture not visible — nothing to repair
            is_active = input_.is_checked()
            if ("Active" if is_active else "Inactive") == target_status:
                return self

            self.click(self._card_toggle_label(name))
            confirm_label = "Yes, Activate" if target_status == "Active" else "Yes, Deactivate"
            self.click(self.page.get_by_role("button", name=confirm_label, exact=True))
            self._wait_for_card_status_settled(name, target_status)
        except Exception:
            # Best-effort repair only — a teardown helper must never raise
            # and mask the test's real outcome.
            pass
        return self

    # ==========================================
    #             ASSERTIONS — PAGE CHROME
    # ==========================================

    def assert_on_library(self) -> "FrameworksLibraryPage":
        expect(self.page).to_have_url(re.compile(r".*/grc/frameworks/?$"))
        expect(self.page.get_by_role("heading", name="Framework Library")).to_be_visible()
        return self

    def assert_no_library_tabs(self) -> "FrameworksLibraryPage":
        expect(self.page.get_by_text("Statement of applicability")).to_have_count(0)
        return self

    def assert_activate_button_visible(self) -> "FrameworksLibraryPage":
        expect(self.page.get_by_role("button", name="Activate Framework")).to_be_visible()
        return self

    def assert_page_heading_and_subtitle(self, heading: str, subtitle: str) -> "FrameworksLibraryPage":
        """Assert a heading + its exact subtitle text render together —
        generic, reused for the Library's own 'Framework Library' /
        'Compliance frameworks — the entry point for requirements. Mapped to
        SCF controls.' pairing (FWL_001)."""
        expect(self.page.get_by_role("heading", name=heading, exact=True)).to_be_visible()
        expect(self.page.get_by_text(subtitle, exact=True)).to_be_visible()
        return self

    def assert_toolbar_controls_in_order(self) -> "FrameworksLibraryPage":
        """Assert the 5 toolbar controls render left-to-right in the
        documented order: Search Frameworks input, All status multi-select,
        All Regions multi-select, Sort by combobox, Sort Direction toggle.
        Compared by each control's own bounding-box X position (visual order)
        rather than DOM order, since a horizontal toolbar's markup nesting
        doesn't have to match its rendered order. A hidden/undetached control
        yields a None bounding box (read as -1), which fails the ordering
        chain the same as a genuinely misplaced control."""
        locators = [
            # Locate the two filters by their PLACEHOLDER, not visible text:
            # once an option is picked the trigger's label becomes the selection
            # (e.g. "Retired"), so a get_by_text("All status") lookup finds
            # nothing and bounding_box below times out. Placeholder is stable.
            self.page.get_by_placeholder("Search Frameworks"),
            self.page.get_by_placeholder("All status"),
            self.page.get_by_placeholder("All Regions"),
            self.page.get_by_role("combobox", name="Sort by"),
            self._sort_direction_toggle(),
        ]
        lefts = []
        for locator in locators:
            box = locator.first.bounding_box()
            lefts.append(box["x"] if box else -1)
        for i in range(1, len(lefts)):
            assert lefts[i] > lefts[i - 1]
        return self

    def assert_only_status_and_region_filters_present(self) -> "FrameworksLibraryPage":
        """Assert the toolbar shows 'All status' and 'All Regions'
        multi-selects, and confirms no 'All Categories' dropdown exists
        (FWL_019, rewritten against the current toolbar — the design/
        earlier-live premise of these being ABSENT has flipped)."""
        expect(self.page.get_by_text("All status", exact=True)).to_be_visible()
        expect(self.page.get_by_text("All Regions", exact=True)).to_be_visible()
        expect(self.page.get_by_text("All Categories", exact=True)).to_have_count(0)
        return self

    def assert_no_filters_panel_trigger(self) -> "FrameworksLibraryPage":
        expect(self.page.get_by_role("button", name="Filters", exact=True)).to_have_count(0)
        return self

    # ==========================================
    #             ASSERTIONS — KPI ROW
    # ==========================================

    def _read_avg_readiness_displayed_value(self) -> str:
        """The Avg Readiness tile's own displayed value — the 4th entry of
        h6's text contents (e.g. '16.55%')."""
        values = self.page.locator("h6").all_text_contents()
        return values[3] if len(values) > 3 else ""

    def _kpi_tile_container(self, label: str):
        """The full outer container for one KPI tile, located structurally
        from its label text ('Total Frameworks' | 'Active' | 'Drafts' |
        'Avg Readiness'): the NEAREST ancestor div that also contains an
        <svg> icon descendant. A fixed `.locator("..")` climb (the
        convention used elsewhere in this file for narrower single-row
        scoping, e.g. the old assert_no_avg_readiness_progress_bar) would be
        fragile here since the icon badge and the label/value/sublabel block
        don't necessarily share a common parent just one level up — this
        XPath ancestor:: step returns the CLOSEST ancestor matching the
        predicate regardless of how many wrapper levels sit in between
        (XPath's reverse axes return position 1 = nearest, not the
        outermost/document-order-first match). `.first` on the label lookup
        matches this file's established convention (see
        assert_kpi_labels_and_sublabels): the KPI row renders before the
        card grid in DOM order, so the first exact-text match is always the
        tile, never a card badge that happens to share the same word (e.g.
        'Active')."""
        # Anchor on the TILE (div.rounded-lg.p-4), not the nearest
        # svg-containing ancestor. From the label,
        # ancestor::div[.//svg][1] resolves to an inner
        # "flex justify-between" wrapper holding the label and icon but
        # NOT the progress-bar fill, so fill/icon lookups missed.
        return self.page.get_by_text(label, exact=True).first.locator(
            'xpath=ancestor::div[contains(@class,"rounded-lg")][1]')

    def assert_kpi_values(self, total: str, active: str, drafts: str, avg_readiness: str) -> "FrameworksLibraryPage":
        """KPI headings in DOM order: [Total, Active, Drafts, Avg Readiness]."""
        expect(self.page.locator("h6")).to_have_text([total, active, drafts, avg_readiness])
        return self

    def assert_no_avg_readiness_progress_bar(self) -> "FrameworksLibraryPage":
        """Assert the Avg Readiness KPI card renders no [role=progressbar]/
        <progress> element. Kept verbatim — an existing test still calls
        this — but its PREMISE is disproven live (2026-08-03): the tile DOES
        render a real, visible progress-bar fill (a plain, non-semantic div
        with an inline width: NN.NN% style, no ARIA role, no <progress>
        tag). So this narrow check still reports "not found" and still
        passes — there genuinely is no element with THOSE specific
        semantics — without that meaning "no progress bar exists"; it just
        isn't built out of those particular primitives. Use
        assert_avg_readiness_progress_bar() below for the corrected,
        positive check that looks for the actual live fill element and its
        width."""
        kpi_card = self.page.get_by_text("Avg Readiness").locator("..")
        expect(kpi_card.locator("[role=progressbar], progress")).to_have_count(0)
        return self

    def assert_avg_readiness_progress_bar(self) -> "FrameworksLibraryPage":
        """Assert the Avg Readiness tile renders a REAL progress-bar fill
        whose inline width corresponds to the displayed percentage — the
        corrected, positive counterpart to assert_no_avg_readiness_progress_bar
        above (see that method's docstring for why both coexist without
        contradicting each other in practice). Confirmed live (2026-08-03):
        the fill is a plain div (no role=progressbar, no <progress> tag)
        whose inline style carries `width: NN.NN%`, e.g.
        `<div class="h-full ..." style="width: 16.55%;"></div>` nested
        inside a rounded track div — hence the CSS attribute-selector match
        here rather than get_by_role, since this element has no accessible
        semantics at all. Satisfies FW_FR_KPI_SUMMARY_04. KPI_005 /
        KPI_013."""
        displayed = self._read_avg_readiness_displayed_value()  # e.g. '16.55%'
        kpi_card = self._kpi_tile_container("Avg Readiness")
        fill = kpi_card.locator('div[style*="width"]:visible').first
        expect(fill).to_be_visible()
        style = fill.get_attribute("style") or ""
        width_match = re.search(r"width:\s*([\d.]+)%", style)
        assert width_match, f'progress-bar fill has no numeric width in style="{style}"'
        expected_pct = float(displayed.replace("%", ""))
        assert round(float(width_match.group(1)) - expected_pct, 2) == 0
        return self

    def assert_avg_readiness_has_decimal_places(self) -> "FrameworksLibraryPage":
        """Assert the Avg Readiness value renders with two decimal places
        (e.g. '16.55%'), NOT rounded to a whole number — contradicts
        KPI_005's whole-number-rounding premise. Confirmed live
        (2026-08-03). KPI_005 / KPI_013."""
        displayed = self._read_avg_readiness_displayed_value()
        assert re.match(r"^\d+\.\d{2}%$", displayed), f'Avg Readiness value has no decimal places: "{displayed}"'
        return self

    def assert_kpi_cards_view_only(self) -> "FrameworksLibraryPage":
        clickable = self.page.evaluate(
            """() => {
                const label = [...document.querySelectorAll('*')].find(
                    el => el.children.length === 0 && el.textContent.trim() === 'Total Frameworks'
                );
                return !!(label && label.closest('[role="button"], a, button'));
            }"""
        )
        assert clickable is False, "Expected KPI cards to have no clickable ancestor"
        return self

    def assert_all_kpi_tiles_view_only(self) -> "FrameworksLibraryPage":
        """Assert ALL FOUR KPI tiles (not just the one
        assert_kpi_cards_view_only above checks) are fully non-interactive:
        cursor: auto (never pointer), no role attribute, tabIndex === -1, no
        <a>/<button> descendant, and clicking each tile leaves the URL
        unchanged. Confirmed live (2026-08-03) — clicked all four tiles via
        a real click, not a programmatic one — the URL never changed,
        cursor stayed auto before and after hover, and no tile had an
        onclick, tabIndex, or role. KPI_017."""
        url_before = self.page.url
        for label in ["Total Frameworks", "Active", "Drafts", "Avg Readiness"]:
            tile = self._kpi_tile_container(label)
            state = tile.evaluate(
                """el => ({
                    cursor: getComputedStyle(el).cursor,
                    role: el.getAttribute('role'),
                    tabIndex: el.tabIndex,
                })"""
            )
            assert state["cursor"] == "auto", f"{label} tile cursor"
            assert state["role"] is None, f"{label} tile role"
            assert state["tabIndex"] == -1, f"{label} tile tabIndex"
            expect(tile.locator("a, button")).to_have_count(0)
            tile.click()
            assert self.page.url == url_before, f"{label} tile click changed the URL"
        return self

    def assert_kpi_row_visible(self) -> "FrameworksLibraryPage":
        """Assert all 4 KPI tiles render (one <h6> value each)."""
        expect(self.page.locator("h6")).to_have_count(4)
        return self

    def assert_kpi_labels_and_sublabels(self) -> "FrameworksLibraryPage":
        """Assert the 4 KPI tiles' headings and their sublabels (the 4th, Avg
        Readiness, carries no sublabel — matches live copy)."""
        # The KPI LABELS are plain text; it's the VALUES that render as <h6>
        # (see assert_kpi_values, which reads h6). Asserting the labels as
        # level-6 headings finds nothing.
        for label in ["Total Frameworks", "Active", "Drafts", "Avg Readiness"]:
            expect(self.page.get_by_text(label, exact=True).first).to_be_visible()
        for sublabel in ["In catalog", "Contributing to coverage", "Pending activation"]:
            expect(self.page.get_by_text(sublabel, exact=True)).to_be_visible()
        return self

    def assert_avg_readiness_has_no_sublabel(self) -> "FrameworksLibraryPage":
        """Assert the Avg Readiness tile renders NO sub-label at all —
        distinct from the other 3 tiles, which each carry one (see
        assert_kpi_labels_and_sublabels above). Confirmed live (2026-08-03):
        the DOM leaves a Vue comment placeholder (<!---->) where a sub-label
        would sit rather than an empty string, so this checks that none of
        the 3 known sub-label strings render anywhere inside the tile,
        rather than looking for an empty text node. KPI_012 / KPI_018."""
        tile = self._kpi_tile_container("Avg Readiness")
        for sublabel in ["In catalog", "Contributing to coverage", "Pending activation"]:
            expect(tile.get_by_text(sublabel, exact=True)).to_have_count(0)
        return self

    def assert_all_kpi_tiles_render_icon(self) -> "FrameworksLibraryPage":
        """Assert each of the 4 KPI tiles renders its own icon (an <svg>
        inside a colored badge). Confirmed live (2026-08-03): one <svg> per
        tile with unique path data (network nodes / check-circle /
        clipboard / gauge). KPI_012."""
        for label in ["Total Frameworks", "Active", "Drafts", "Avg Readiness"]:
            expect(self._kpi_tile_container(label).locator("svg")).not_to_have_count(0)
        return self

    def _compute_expected_kpis_from_visible_cards(self) -> dict:
        """Compute the KPI values the tiles SHOULD show given the currently
        visible (already filtered/searched) card grid: total visible count,
        count of Active cards, count of Draft cards, and the average Audit
        Readiness across only the visible ACTIVE cards (rounded to 2 decimal
        places, matching the live NN.NN% formatting) — '0.00%' when no
        Active cards are visible. Caveat inherited from _cards()/the grid's
        own hard 50-card render cap: a filtered set with MORE than 50 true
        matches will read back as only 50 here — the same
        testing-environment limitation noted for KPI_001 in the live
        findings, not a defect in this helper."""
        texts = self._cards().all_inner_texts()
        total = len(texts)
        active = len([t for t in texts if re.search(r"\bActive\b", t)])
        drafts = len([t for t in texts if re.search(r"\bDraft\b", t)])
        readiness_values = [v for v in self._visible_card_readiness_values() if v == v]  # `v == v` is False for NaN
        avg = sum(readiness_values) / len(readiness_values) if readiness_values else 0.0
        return {"total": total, "active": active, "drafts": drafts, "avg_readiness": f"{avg:.2f}%"}

    def assert_kpi_values_match_visible_cards(self) -> "FrameworksLibraryPage":
        """Assert the 4 KPI tile values equal the stats derivable from the
        currently visible (filtered/searched) card grid — the REQUIRED
        behaviour KPI_009/010 need, expressed generically against the real
        453-framework catalog rather than the test cases' own hardcoded
        synthetic F1-F5 numbers (which don't exist live). Confirmed live
        (2026-08-03) the tiles do NOT update on search/filter — they stay
        frozen at the unfiltered 453/47/6/16.55% (a filed defect, DT-3482 /
        FW_FR_KPI_SUMMARY_05) — so this fails honestly rather than passing
        on a stale value."""
        expected = self._compute_expected_kpis_from_visible_cards()
        expect(self.page.locator("h6")).to_have_text(
            [str(expected["total"]), str(expected["active"]), str(expected["drafts"]), expected["avg_readiness"]]
        )
        return self

    def assert_all_kpi_values_zeroed(self) -> "FrameworksLibraryPage":
        """Assert all 4 KPI tiles read zero — the REQUIRED behaviour when the
        current filter/search matches nothing (KPI_011), or the catalog is
        genuinely empty (KPI_004 — precondition currently unreachable live,
        see the KPI ground-truth notes; this method still applies if that
        ever changes). Avg Readiness accepts both '0%' and '0.00%' since the
        live formatting convention for a zero-division case (no Active
        frameworks to average) isn't independently confirmed. Confirmed live
        (2026-08-03) the tiles do NOT zero out on a zero-match search — they
        stay frozen at 453/47/6/16.55% — so this fails honestly against the
        same filed non-refresh defect assert_kpi_values_match_visible_cards
        documents."""
        values = self.page.locator("h6").all_text_contents()
        assert values[:3] == ["0", "0", "0"]
        assert re.match(r"^0(\.00)?%$", values[3])
        return self

    # ==========================================
    #             ASSERTIONS — CARD GRID
    # ==========================================

    def assert_card_visible(self, card_title: str) -> "FrameworksLibraryPage":
        expect(self.page.get_by_text(card_title, exact=True).first).to_be_visible()
        return self

    def assert_card_not_visible(self, card_title: str) -> "FrameworksLibraryPage":
        expect(self.page.get_by_text(card_title, exact=True)).to_have_count(0)
        return self

    def assert_card_count(self, n: int) -> "FrameworksLibraryPage":
        """Assert the current number of VISIBLE framework cards (e.g. 50 for
        the default unfiltered page, 6 for the Draft filter)."""
        expect(self._cards()).to_have_count(n)
        return self

    def assert_empty_grid_message(self) -> "FrameworksLibraryPage":
        """Original 18-method-era empty-grid assertion — kept verbatim for the
        tests that already call it. Prefer assert_empty_state_message() for
        the corrected live copy ("No results found!")."""
        expect(self.page.get_by_text(re.compile("no active frameworks", re.I))).to_be_visible()
        return self

    def assert_empty_state_message(self) -> "FrameworksLibraryPage":
        """Assert the grid's real live empty-state copy: heading "No results
        found!" and the exact body text. Used by FWL_002 (Retired filter) and
        FWL_027 (non-matching search)."""
        expect(self.page.get_by_role("heading", name="No results found!", exact=True)).to_be_visible()
        expect(
            self.page.get_by_text(
                "We couldn't find any matches for your search. Try adjusting your search terms", exact=True
            )
        ).to_be_visible()
        return self

    def assert_active_card_shape(
        self,
        name: str,
        region: str,
        date: str,
        readiness_pct: str,
        implemented: str,
        partially_implemented: str,
        gaps: str,
    ) -> "FrameworksLibraryPage":
        """Assert `name`'s ACTIVE card renders, in order, its 'Active' badge,
        region, creation date, 'Audit Readiness' label + percentage, and the
        three control-count badges ('N implemented' / 'N Partially
        implemented' / 'N Gaps'). FWL_003."""
        card = self._card_locator(name)
        expect(card).to_be_visible()
        expect(card).to_contain_text("Active")
        expect(card).to_contain_text(region)
        expect(card).to_contain_text(date)
        expect(card).to_contain_text("Audit Readiness")
        expect(card).to_contain_text(readiness_pct)
        # The count and its label sit in separate adjacent elements, so the
        # card's textContent reads "0implemented" with no separator — compare
        # against inner_text (which preserves the line break) with whitespace
        # collapsed, rather than a to_contain_text on a space-joined string.
        text = re.sub(r"\s+", " ", card.inner_text())
        assert f"{implemented} implemented" in text, text
        assert f"{partially_implemented} Partially implemented" in text, text
        assert f"{gaps} Gaps" in text, text
        return self

    def assert_reduced_card_shape(self, name: str, status: str, date: str, region: str | None = None) -> "FrameworksLibraryPage":
        """Assert `name`'s reduced-shape card (INACTIVE or DRAFT, `status`)
        shows only its status badge and creation date — plus `region` when
        given (Inactive cards carry a region; Draft cards never do, so
        callers omit `region` for Draft and this method additionally asserts
        the region row is fully absent, matching
        assert_card_region_row_omitted). Asserts no 'Audit Readiness' or
        control-count badges render either way. FWL_004 / FWL_005."""
        card = self._card_locator(name)
        expect(card).to_be_visible()
        expect(card).to_contain_text(status)
        expect(card).to_contain_text(date)
        expect(card).not_to_contain_text("Audit Readiness")
        expect(card).not_to_contain_text("implemented")
        expect(card).not_to_contain_text("Gaps")
        if region:
            expect(card).to_contain_text(region)
        else:
            text = card.inner_text().upper()
            for token in REGION_TOKENS:
                assert not re.search(rf"\b{token}\b", text)
        return self

    def assert_card_toggle_reflects_status(self, name: str, status: str) -> "FrameworksLibraryPage":
        """Assert `name`'s card status toggle reflects `status`: [checked]
        for "Active", unchecked for "Inactive" — see the module docstring's
        CARD STATUS TOGGLE block for why this reads the sr-only input
        directly rather than via get_by_role."""
        input_ = self._card_toggle_input(name)
        if status == "Active":
            expect(input_).to_be_checked()
        else:
            expect(input_).not_to_be_checked()
        return self

    def assert_status_toggle_dialog(self, action: str, framework_name: str) -> "FrameworksLibraryPage":
        """Assert the currently-open activate/deactivate confirmation
        dialog's title and body copy for `action` ("Activate" | "Deactivate")
        on `framework_name` — verbatim per the live findings: "Deactivate
        Framework" / 'Are you sure you want to deactivate "<name>"?' (and
        the Activate/activate mirror), with "Cancel" and the matching
        "Yes, <action>" button. Matched by plain text, not a heading role —
        the dialog's title element's semantics weren't independently
        confirmed live."""
        dialog = self._status_toggle_dialog()
        expect(dialog).to_be_visible()
        expect(dialog.get_by_text(f"{action} Framework", exact=True)).to_be_visible()
        expect(dialog).to_contain_text(f'Are you sure you want to {action.lower()} "{framework_name}"?')
        expect(dialog.get_by_role("button", name="Cancel", exact=True)).to_be_visible()
        expect(dialog.get_by_role("button", name=f"Yes, {action}", exact=True)).to_be_visible()
        return self

    def assert_card_region_row_omitted(self, name: str) -> "FrameworksLibraryPage":
        """Assert `name`'s card renders NO region row at all — none of the 5
        known region tokens (APAC/US/EMEA/GENERAL/AMERICAS) appear anywhere in
        the card, matching the Draft-card behavior of omitting the row
        entirely rather than a "—" placeholder. FWL_025."""
        text = self._card_locator(name).inner_text().upper()
        for token in REGION_TOKENS:
            assert not re.search(rf"\b{token}\b", text)
        return self

    def assert_all_visible_cards_have_status(self, status: str) -> "FrameworksLibraryPage":
        """Assert every currently VISIBLE card carries exactly `status` as its
        status badge — no card of a different status is present. Used both
        for "the filter narrowed correctly" (FWL_007) and its negative framing
        "every result matches, none don't" (FWL_026). Caveat: this scans each
        card's full text for the 4 known status words, so it would false-flag
        a framework whose OWN NAME happens to contain one of them — not an
        issue for the live catalog's names, but worth knowing if new fixtures
        are added."""
        statuses = ["Active", "Inactive", "Draft", "Retired"]
        texts = self._cards().all_inner_texts()
        for text in texts:
            found = [s for s in statuses if re.search(rf"\b{s}\b", text)]
            assert found == [status]
        return self

    def assert_all_visible_cards_have_region(self, region: str) -> "FrameworksLibraryPage":
        """Assert every currently VISIBLE card's region badge equals `region`
        (case-insensitive — card badges render ALL CAPS while some filter
        option labels are title-case; see module docstring). Used for the
        Regions-filter narrowing check (FWL_008)."""
        target = region.upper()
        pattern = re.compile(rf"\b{target}\b")
        texts = self._cards().all_inner_texts()
        for text in texts:
            assert pattern.search(text.upper())
        return self

    def assert_no_duplicate_card_names(self) -> "FrameworksLibraryPage":
        """Assert no two currently VISIBLE cards share a Framework Name. FWL_022."""
        names = self._visible_card_names()
        assert len(set(names)) == len(names)
        return self

    def assert_search_value(self, expected: str) -> "FrameworksLibraryPage":
        expect(self.page.get_by_placeholder("Search Frameworks")).to_have_value(expected)
        return self

    # ==========================================
    #             ASSERTIONS — FILTERS
    # ==========================================

    def assert_filter_option_list(self, dropdown_label: str, option_labels: list[str]) -> "FrameworksLibraryPage":
        """Open `dropdown_label`'s panel and assert its full, ordered option
        list — used to prove the option set stays intact/unbroken even when
        the current search matches zero frameworks (FWL_027). Leaves the
        panel closed again afterward."""
        texts = self._with_filter_panel_open(
            dropdown_label, lambda: self.page.get_by_role("listbox").last.get_by_role("option").all_text_contents()
        )
        assert [t.strip() for t in texts] == option_labels
        return self

    def assert_filter_options_checked(self, dropdown_label: str, option_labels: list[str]) -> "FrameworksLibraryPage":
        """Open `dropdown_label`'s panel and assert exactly the given options
        are checked (pass [] to assert NONE are checked). Used both to
        confirm a filter selection took ("Inactive" is checked) and, after a
        navigate-away-and-back, that it reverted to no selection (FWL_014).
        Leaves the panel closed again afterward."""

        def _read():
            options = self.page.get_by_role("listbox").last.get_by_role("option")
            return options.evaluate_all(
                """els => els
                    .filter(el => !!el.querySelector('input[type=checkbox]:checked') || el.getAttribute('aria-selected') === 'true')
                    .map(el => (el.textContent || '').trim())"""
            )

        checked = self._with_filter_panel_open(dropdown_label, _read)
        assert sorted(checked) == sorted(option_labels)
        return self

    # ==========================================
    #             ASSERTIONS — SORT
    # ==========================================

    def assert_sort_by_value(self, value: str) -> "FrameworksLibraryPage":
        """Assert the 'Sort by' control's displayed value. The `combobox` role
        sits on PrimeVue's hidden input, which carries no text — the displayed
        value lives on the surrounding `.p-select` wrapper, so assert there."""
        # Locate the select STRUCTURALLY. Its accessible name is the *current
        # value*, not a stable label: it reads "Sort by" only while nothing is
        # selected and becomes e.g. "Name" afterwards, so
        # get_by_role("combobox", name="Sort by") stops matching the moment a
        # sort key is chosen — which is exactly when this assertion runs.
        expect(self.page.locator(".p-select").first).to_have_text(value)
        return self

    def assert_cards_sorted_by_name(self, direction: str = "asc") -> "FrameworksLibraryPage":
        """Assert the currently visible cards' names are alphabetically
        ordered. FWL_011 / FWL_012."""
        names = self._visible_card_names()
        sorted_names = sorted(names)
        expected = sorted_names if direction == "asc" else list(reversed(sorted_names))
        assert names == expected
        return self

    def assert_cards_sorted_by_date(self, direction: str = "asc") -> "FrameworksLibraryPage":
        """Assert the currently visible cards' Creation Dates are ordered
        (safe as a plain string sort — every date is yyyy-mm-dd). FWL_028."""
        dates = self._visible_card_dates()
        sorted_dates = sorted(dates)
        expected = sorted_dates if direction == "asc" else list(reversed(sorted_dates))
        assert dates == expected
        return self

    def assert_cards_sorted_by_readiness(self, direction: str = "asc") -> "FrameworksLibraryPage":
        """Assert the currently visible cards' Audit Readiness percentages
        are numerically ordered — pair with an Active-only filter first (see
        _visible_card_readiness_values()'s docstring). FWL_028."""
        values = self._visible_card_readiness_values()
        sorted_values = sorted(values)
        expected = sorted_values if direction == "asc" else list(reversed(sorted_values))
        assert values == expected
        return self

    def assert_card_order_changed_from_captured(self) -> "FrameworksLibraryPage":
        """Assert the current visible-card name order differs from the order
        captured by capture_card_order() — used to prove a sort actually
        reordered the grid when the sort key has no directly re-derivable
        per-card field (e.g. 'Updated at')."""
        current = self._visible_card_names()
        assert current != (self._last_card_order_before_sort or [])
        return self

    def assert_card_order_reversed_from_captured(self) -> "FrameworksLibraryPage":
        """Assert the current visible-card name order is the EXACT REVERSE of
        the order captured by capture_card_order() — used for direction-
        toggle reversal checks on sort keys with no visible per-card field to
        re-derive order from (e.g. 'Updated at', FWL_028)."""
        current = self._visible_card_names()
        assert current == list(reversed(self._last_card_order_before_sort or []))
        return self

    def assert_sort_direction_toggle_changed_state(self) -> "FrameworksLibraryPage":
        """Assert the Sort Direction toggle's OWN visual/ARIA state changed
        the last time toggle_sort_direction() ran (captured via
        _sort_direction_signature) — proves the control itself signals the
        new direction (icon rotation, aria-pressed, a class flip, whichever
        mechanism the live control uses), independent of whether the grid
        itself reordered. FWL_012."""
        assert self._last_sort_direction_changed is True
        return self

    # ==========================================
    #             ASSERTIONS — HOVER / CURSOR
    # ==========================================

    def assert_card_hover_highlights_card(self, name: str) -> "FrameworksLibraryPage":
        """Hover `name`'s card and assert its computed border/background/box-
        shadow differ from the pre-hover baseline (a real, distinguishable
        highlighted state — not required to match any specific value), then
        assert moving the mouse off the card reverts it back to that
        baseline. Confirmed live (2026-08-03) every one of these properties is
        byte-identical before/during/after hover, so this fails honestly
        today. FWL_018."""
        card = self._card_locator(name)

        def style_of():
            return card.evaluate(
                """el => {
                    const s = getComputedStyle(el);
                    return { border: s.border, background: s.backgroundColor, boxShadow: s.boxShadow };
                }"""
            )

        before = style_of()
        card.hover()
        during = style_of()
        self.page.mouse.move(0, 0)
        after = style_of()
        assert during != before
        assert after == before
        return self

    def assert_card_cursor_is_pointer(self, name: str) -> "FrameworksLibraryPage":
        """Assert `name`'s card cursor is 'pointer' while hovered. Confirmed
        live (2026-08-03) it stays 'auto' despite the card being genuinely
        clickable, so this fails honestly today. FWL_018."""
        card = self._card_locator(name)
        card.hover()
        cursor = card.evaluate("el => getComputedStyle(el).cursor")
        assert cursor == "pointer"
        return self

    # ==========================================
    #             ASSERTIONS — DETAILS-PAGE HANDOFF
    # ==========================================

    def assert_details_page_shows_framework(self, clicked_card_title: str) -> "FrameworksLibraryPage":
        """Assert a card click landed on a per-framework details route.

        Deliberately does NOT assert the clicked framework's NAME appears: the
        detail page's title block is hardcoded to "ISO 28033 - ISO/IEC 28033"
        for every framework — a framework-detail-overview (DT-3167) defect with
        its own bug and test case. Asserting the name would make this Frameworks
        Library navigation case fail for another feature's defect."""
        self.wait_for_url(re.compile(r".*/grc/frameworks/details/\w+"))
        expect(self.page.get_by_text("Framework Metadata", exact=True)).to_be_visible()
        return self

    def assert_details_clauses_total(self, total: str) -> "FrameworksLibraryPage":
        """Assert the Framework Details page's 'Clauses' metadata field
        renders `total`. FWL_021."""
        row = self.page.get_by_text("Clauses", exact=True).locator("..")
        expect(row).to_contain_text(total)
        return self

    def assert_details_in_scope_clauses(self, numerator: str, denominator: str) -> "FrameworksLibraryPage":
        """Assert the Framework Details page's 'In-scope clauses' metadata
        field renders '{numerator} / {denominator}'. FWL_021."""
        row = self.page.get_by_text("In-scope clauses", exact=True).locator("..")
        expect(row).to_contain_text(f"{numerator} / {denominator}")
        return self

    def assert_control_count_badges_sum_to_in_scope_clauses(
        self, implemented: str, partially_implemented: str, gaps: str, in_scope_numerator: str
    ) -> "FrameworksLibraryPage":
        """Pure-arithmetic check (no DOM read): assert implemented + partial +
        gaps equals in_scope_numerator — the documented live relationship
        (badge sum reconciles with the 'In-scope clauses' numerator, NOT the
        total 'Clauses' count). Pair with assert_details_clauses_total /
        assert_details_in_scope_clauses to also verify those DOM values
        themselves. FWL_021."""
        total = int(implemented) + int(partially_implemented) + int(gaps)
        assert str(total) == in_scope_numerator
        return self

    def assert_details_owner_placeholder(self) -> "FrameworksLibraryPage":
        """Assert the Framework Details page's 'Owner' metadata field renders
        the bare '-' placeholder when unset (distinct from the card-level
        omission pattern — see assert_card_region_row_omitted). FWL_025."""
        owner_row = self.page.get_by_text("Owner", exact=True).locator("..")
        expect(owner_row).to_contain_text("-")
        return self

    # ==========================================
    #             ASSERTIONS — ACCESS CONTROL
    # ==========================================

    def assert_access_denied(self) -> "FrameworksLibraryPage":
        """Required RBAC behaviour for a user without 'Framework View'
        permission: the Library shows an access-denied message or redirects
        away, rather than rendering. Confirmed live (2026-08-03) a Normal
        user loads the full page with no block, so this fails honestly
        today. FWL_024."""
        expect(self.page.get_by_role("heading", name="Framework Library")).to_have_count(0)
        return self

    def assert_activate_button_hidden_or_disabled(self) -> "FrameworksLibraryPage":
        """Required RBAC behaviour: the 'Activate Framework' button/action is
        hidden or disabled for a user without permission. Confirmed live
        (2026-08-03) it's visible AND enabled for a Normal user, so this
        fails honestly today. FWL_024."""
        button = self.page.get_by_role("button", name="Activate Framework")
        if button.count() == 0:
            return self
        expect(button).to_be_disabled()
        return self

    def assert_redirected_to_login(self) -> "FrameworksLibraryPage":
        """Assert the app redirected to the login page with the Library's
        own return URL — the exact string KPI_015 checks byte-for-byte.
        Confirmed live (2026-08-03), both via a fresh navigation and via a
        'Log Out' menu action: /login?returnUrl=%2Fgrc%2Fframeworks. Mirrors
        FrameworkActivateWizardPage.assert_redirected_to_login. KPI_015."""
        expect(self.page).to_have_url(re.compile(r".*/login\?returnUrl=%2Fgrc%2Fframeworks$"))
        return self
