"""Framework Activate Wizard Page — GRC /grc/frameworks/activate.

A full page (own URL/breadcrumb), not a modal, despite the design mock.
Two steps: Select Framework, then Assign Owner(s) & Activate.

Ported 1:1 from pages/grc/framework-activate-wizard.page.ts — see that
file's docstring for the full list of quirks verified live on 2026-07-29:

- Full page, not a modal — own URL/breadcrumb (`Frameworks` > `Activate
  Framework`), unlike the design mock's dialog treatment.
- Live copy deviates from design copy throughout: the Step 1 subtitle is
  "Configure the framework activation." (not the design's "Activate a new
  Framework to your compliance"); the empty-state copy is "No results
  found!" / "We couldn't find any matches for your search. Try adjusting
  your search terms" — NOT "No frameworks match your search.", which does
  not exist anywhere in the live app.
- The floating chat-support FAB (fixed bottom-right) always covers the
  right ~29px of the footer's right-most button. `Next` (58px wide) has its
  centre land exactly on the FAB's edge — a real click there fails — while
  `Activate` (82px) stays clear at its centre and a real click succeeds.
  This Next/Activate asymmetry means `next()`/`cancel()` MUST keep using
  the dispatchEvent-safe click, but `activate()` MUST use a real click
  (dispatch there would silently hide a regression).
- Step 2's "Framework Owners" control is a PrimeVue MultiSelect
  (`.p-multiselect` trigger, `.p-multiselect-overlay` panel), not a plain
  type-ahead: one checkbox per `[role=option]`, ~219 options, a filter
  input in the overlay header, no "select all". Options' accessible name is
  literally the string "[object Object]" — never locate an option by
  role+name, only by its visible text.
- There is NO "Save as Draft" control anywhere in the live flow — Step 2
  has only Back + Activate. The amber Activation callout's OWN COPY
  mentions "save as draft" in prose, so any save-as-draft-absence
  assertion must be scoped to `button`/`a` elements, never page text.
- Frameworks that are already Active are excluded from the Step 1 grid
  entirely (no greyed-out card, no "Already in catalog" badge) — the
  catalog itself is large (~219 frameworks), so the old "catalog can be
  EMPTY" quirk documented here previously no longer applies.
- Step 2's whole DOM (Assign Owner, the MultiSelect, the Activation
  callout) is present while Step 1 is showing (just hidden), and Step 1's
  cards stay in the DOM while Step 2 is showing. Every step assertion here
  is visibility-scoped (`:visible` / `to_be_visible`) rather than a bare
  presence/count check — those silently pass on the wrong step.
- The 2-segment progress bar is clickable enough to jump forward: clicking
  segment 2 while a framework IS selected navigates straight to Step 2,
  bypassing `Next` — a real defect (the segments are focusable
  `<button tabindex="0">`s that look inert but aren't). With no framework
  selected the same click is inert.

SUPERSEDED 2026-08-04, build dca9938158 — product change: activation no
longer requires an owner. Confirmed live with a real Step-2 run: with ZERO
owners checked, Activate is already enabled (assert_activate_enabled below,
called with no check_owner in between, now covers this — no new method
needed). This directly contradicts assert_owner_label_has_required_marker
(kept verbatim below since it still fails honestly — there was never a
required-marker, and the field is now genuinely optional rather than just
missing a visual cue). The 10-owner MAXIMUM still applies and is newly
confirmed exact: at precisely 10 checked, Activate stays enabled and EVERY
other option becomes genuinely hard-disabled (aria-disabled/data-p-disabled,
confirmed via a real click on the 11th timing out with "element is not
enabled" — not a cosmetic/CSS-only greyout), with zero error/toast/inline
text anywhere — see check_first_unchecked_owner_options and
assert_owner_selection_capped_at_ten below.
"""
from __future__ import annotations

import os
import re

from playwright.sync_api import expect

from autotest_framework.config import config
from autotest_framework.src.pages.base_page import BasePage
from pages.grc.login_page import LoginPage

CARD_SELECTOR = "div.p-4.rounded-lg.border.cursor-pointer"
PROGRESS_SEGMENT_SELECTOR = "button.h-2.w-8.rounded-full"
SELECTED_BORDER_CLASS = "border-allendevaux-dark-blue-300"


class FrameworkActivateWizardPage(BasePage):
    """Activate Framework wizard — Select Framework -> Assign Owner & Activate."""

    def __init__(self, page):
        super().__init__(page, "Framework Activate Wizard Page")

    def open(self) -> "FrameworkActivateWizardPage":
        self.navigate(f"{config.base_url}/grc/frameworks/activate")
        self._wait_for_step1_ready()
        return self

    def open_as_normal_user(self) -> "FrameworkActivateWizardPage":
        """Log in fresh as the second/normal-user credential (GRC_LOGIN_USER_ALT,
        =user2) and land on the wizard. Drives the SAME LoginPage/config
        mechanism as the primary user — it just temporarily points the
        username env var LoginPage/config reads at the alt user's value for
        the duration of the login call, rather than hand-rolling a second
        login flow. Used for the RBAC checks that were previously blocked on
        "no second credential configured" (see acm-ovr-015 / acm-crt-082)."""
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
        self.navigate(f"{config.base_url}/grc/frameworks/activate")
        self._wait_for_step1_ready()
        return self

    def open_unauthenticated(self) -> "FrameworkActivateWizardPage":
        """Navigate straight to the wizard with no auth/storage state — used for the unauthenticated-redirect case."""
        self.navigate(f"{config.base_url}/grc/frameworks/activate")
        return self

    # ==========================================
    #             INTERNAL HELPERS
    # ==========================================

    def _cards(self):
        """All currently VISIBLE framework cards (Step 1's cards stay in the DOM, hidden, while Step 2 shows)."""
        return self.page.locator(f"{CARD_SELECTOR}:visible")

    def _card_locator(self, name: str):
        """The single visible card container whose exact text (not a substring) equals `name` — never the nested text node."""
        return self._cards().filter(has=self.page.get_by_text(name, exact=True))

    def _card_grid(self):
        return self.page.locator("div.grid.grid-cols-12.gap-6.overflow-y-auto")

    def _progress_segments(self):
        return self.page.locator(PROGRESS_SEGMENT_SELECTOR)

    def _visible_card_names(self) -> list[str]:
        """Ordered list of currently visible cards' names (each card's first rendered text line)."""
        inner_texts = self._cards().all_inner_texts()
        return [t.strip().split("\n")[0].strip() for t in inner_texts]

    def _is_point_intercepted(self, button_name: str, probe: str) -> bool:
        """Whether the point at the given button's centre (or 3px in from its
        right edge, probe="right_edge") resolves to something OTHER than the
        button itself — i.e. is intercepted by an overlapping element (the
        chat FAB). Correct form per the live investigation:
        `not (el is btn or btn.contains(el))` — a bare
        `elementFromPoint(...) !== btn` is a false positive because it also
        matches the button's own `span.p-button-label` child."""
        return self.page.evaluate(
            """({ buttonName, probe }) => {
                const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === buttonName);
                if (!btn) return true;
                const r = btn.getBoundingClientRect();
                const x = probe === 'centre' ? r.left + r.width / 2 : r.right - 3;
                const y = r.top + r.height / 2;
                const el = document.elementFromPoint(x, y);
                if (!el) return true;
                return !(el === btn || btn.contains(el));
            }""",
            {"buttonName": button_name, "probe": probe},
        )

    def _with_owner_picker_open(self, fn):
        """Open the owner MultiSelect if not already open, run `fn`, then restore the prior open/closed state."""
        overlay = self.page.locator(".p-multiselect-overlay")
        try:
            was_open = overlay.is_visible()
        except Exception:
            was_open = False
        if not was_open:
            self.page.locator(".p-multiselect").click()
            expect(overlay).to_be_visible()
        result = fn()
        if not was_open:
            self.page.keyboard.press("Escape")
        return result

    def _wait_for_step1_ready(self) -> None:
        """Wait for Step 1 to have actually hydrated: cards take ~2-4s to
        render after navigation, and reading DOM state immediately after
        open() (rather than through an auto-waiting locator assertion) can
        observe zero cards even though Step 1 IS the current step. Waits for
        the visible `Select Framework` heading AND at least one visible card
        before letting the rest of the chain proceed."""
        expect(self.page.get_by_role("heading", name="Select Framework", exact=True)).to_be_visible()
        expect(self._cards().first).to_be_visible()

    def _grid_signature(self) -> str:
        """`<count>|<first card name>` — enough to tell one result set from another."""
        names = self._visible_card_names()
        return f"{len(names)}|{names[0] if names else ''}"

    def _wait_for_search_settled(self, before: str) -> None:
        """Wait for a search to actually take effect, given the signature the
        grid had BEFORE the term was typed.

        Waiting for "the card count stops changing" is not enough on its own:
        the pre-search grid is already stable, so two equal reads land before
        the debounced request is even sent and the caller reads the OLD result
        set. So: first wait for the grid to differ from `before` (or the empty
        state to appear), then wait for it to stop moving."""
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

    # ==========================================
    #             STEP 1 — SELECT FRAMEWORK
    # ==========================================

    def search(self, term: str) -> "FrameworkActivateWizardPage":
        before = self._grid_signature()
        self.fill(self.page.get_by_placeholder("Search Frameworks"), term)
        self._wait_for_search_settled(before)
        return self

    def clear_search(self) -> "FrameworkActivateWizardPage":
        before = self._grid_signature()
        self.fill(self.page.get_by_placeholder("Search Frameworks"), "")
        self._wait_for_search_settled(before)
        return self

    def select_framework_card(self, name: str) -> "FrameworkActivateWizardPage":
        """Click the card CONTAINER whose exact text equals `name` (never
        `get_by_text(name, exact=True).click()` — that hits the fragile
        nested text node)."""
        self.click(self._card_locator(name))
        return self

    def _click_safe(self, locator) -> None:
        """dispatchEvent-based click — the chat FAB overlaps wizard nav buttons at certain viewports."""
        locator.dispatch_event("click")

    def next(self) -> "FrameworkActivateWizardPage":
        """Click Next (chat-FAB-safe — its centre is intercepted, see module docstring) and wait for the visible Step 2 heading."""
        self._click_safe(self.page.get_by_role("button", name="Next", exact=True))
        expect(self.page.get_by_role("heading", name="Assign Owner", exact=True)).to_be_visible()
        return self

    def cancel(self) -> "FrameworkActivateWizardPage":
        """Click Cancel (chat-FAB-safe) from either step and wait for the Library redirect."""
        self._click_safe(self.page.get_by_role("button", name="Cancel", exact=True))
        self.wait_for_url(re.compile(r".*/grc/frameworks/?$"))
        return self

    def scroll_grid_to_bottom(self) -> "FrameworkActivateWizardPage":
        """Scroll the card grid until infinite scroll appends the next page.

        One scroll + a fixed wait is not enough — live, the scroll had to be
        re-issued several times over ~3s before the next 12 cards arrived (the
        container's scrollHeight only grows once they render, so each nudge
        re-triggers the loader)."""
        before = self._cards().count()
        for _ in range(12):
            self._card_grid().evaluate("el => { el.scrollTop = el.scrollHeight; }")
            self.page.wait_for_timeout(500)
            if self._cards().count() > before:
                return self
        return self

    def click_progress_segment(self, n: int) -> "FrameworkActivateWizardPage":
        """Click progress segment 1 or 2. Segments are focusable
        `<button tabindex="0">`s — clicking segment 2 with a card selected
        jumps to Step 2, bypassing Next (see module docstring)."""
        self.click(self._progress_segments().nth(n - 1))
        return self

    def focus_first_card_by_keyboard(self) -> "FrameworkActivateWizardPage":
        """Attempt to reach the first card via keyboard Tab from the search
        input — cards are plain unfocusable `<div>`s (see
        assert_cards_not_keyboard_operable)."""
        self.page.get_by_placeholder("Search Frameworks").focus()
        self.page.keyboard.press("Tab")
        return self

    # ==========================================
    #             STEP 2 — OWNER + ACTIVATE
    # ==========================================

    def back(self) -> "FrameworkActivateWizardPage":
        """Click Back (chat-FAB-safe, though Back is never actually intercepted).
        Selected card and search term are preserved on Step 1."""
        self._click_safe(self.page.get_by_role("button", name="Back", exact=True))
        return self

    def open_owner_picker(self) -> "FrameworkActivateWizardPage":
        """Open the `Framework Owners` PrimeVue MultiSelect overlay."""
        self.click(self.page.locator(".p-multiselect"))
        expect(self.page.locator(".p-multiselect-overlay")).to_be_visible()
        return self

    def filter_owners(self, term: str) -> "FrameworkActivateWizardPage":
        """Type into the overlay's filter input (in the overlay header).
        Requires the picker to already be open. The input is
        `role="searchbox"`, not `textbox` — never resolve it via
        `get_by_role("textbox")`."""
        self.fill(self.page.locator(".p-multiselect-overlay input.p-multiselect-filter"), term)
        return self

    def check_owner(self, name_or_email: str) -> "FrameworkActivateWizardPage":
        """Check the owner option matching `name_or_email` (matched by visible
        text — option accessible names are all literally "[object Object]").
        Requires the picker to already be open."""
        option = self.page.locator(".p-multiselect-overlay [role=option]").filter(has_text=name_or_email)
        self.check(option.locator("input[type=checkbox]"))
        return self

    def check_first_unchecked_owner_options(self, n: int) -> "FrameworkActivateWizardPage":
        """Check the first `n` NOT-YET-checked owner options, in whatever
        order they currently render — used for the 10-owner-cap test, where
        the exact identities of the first `n` users don't matter, only that
        exactly `n` end up checked. Re-queries "first unchecked" on every
        iteration rather than caching indexes, since checking an option can
        move it (PrimeVue commonly re-sorts checked items to the top).
        Requires the picker to already be open."""
        first_unchecked = (
            self.page.locator(".p-multiselect-overlay [role=option]")
            .filter(has=self.page.locator("input[type=checkbox]:not(:checked)"))
            .first
        )
        for _ in range(n):
            self.check(first_unchecked.locator("input[type=checkbox]"))
        return self

    def close_owner_picker(self) -> "FrameworkActivateWizardPage":
        """Close the owner MultiSelect overlay."""
        self.page.keyboard.press("Escape")
        return self

    def activate(self) -> "FrameworkActivateWizardPage":
        """Click Activate with a REAL click (never dispatchEvent) — its centre
        is verified clear of the chat FAB at every measured viewport, so a
        real click here should always succeed; masking that with dispatch
        would hide a regression. Creates an irreversible catalog entry — use
        only with intent."""
        self.click(self.page.get_by_role("button", name="Activate", exact=True))
        return self

    # ==========================================
    #             ASSERTIONS — STEP 1
    # ==========================================

    def assert_on_step1(self) -> "FrameworkActivateWizardPage":
        expect(self.page).to_have_url(re.compile(r".*/grc/frameworks/activate/?$"))
        expect(self.page.get_by_role("heading", name="Select Framework", exact=True)).to_be_visible()
        return self

    def assert_breadcrumb(self) -> "FrameworkActivateWizardPage":
        expect(self.page.get_by_role("link", name="Frameworks", exact=True)).to_be_visible()
        expect(self.page.locator("nav").get_by_text("Activate Framework", exact=True)).to_be_visible()
        return self

    def assert_page_heading_and_subtitle(self, heading: str, subtitle: str) -> "FrameworkActivateWizardPage":
        expect(self.page.get_by_role("heading", name=heading, exact=True)).to_be_visible()
        expect(self.page.get_by_text(subtitle, exact=True)).to_be_visible()
        return self

    def assert_next_disabled(self) -> "FrameworkActivateWizardPage":
        expect(self.page.get_by_role("button", name="Next", exact=True)).to_be_disabled()
        return self

    def assert_next_enabled(self) -> "FrameworkActivateWizardPage":
        expect(self.page.get_by_role("button", name="Next", exact=True)).to_be_enabled()
        return self

    def assert_cancel_before_next(self) -> "FrameworkActivateWizardPage":
        """Assert the footer's Cancel button renders before Next among currently VISIBLE buttons."""
        order = self.page.evaluate(
            """() => {
                const buttons = [...document.querySelectorAll('button')].filter(b => b.offsetParent !== null);
                const texts = buttons.map(b => b.textContent.trim());
                return { cancel: texts.indexOf('Cancel'), next: texts.findIndex(t => t === 'Next') };
            }"""
        )
        assert order["cancel"] >= 0
        assert order["next"] > order["cancel"]
        return self

    def assert_card_visible(self, name: str) -> "FrameworkActivateWizardPage":
        expect(self._card_locator(name)).to_be_visible()
        return self

    def assert_card_absent(self, name: str) -> "FrameworkActivateWizardPage":
        """Assert no VISIBLE card named `name` exists — used both for
        search-filters-it-out and for the post-activation exclusion rule."""
        expect(self._card_locator(name)).to_have_count(0)
        return self

    def assert_visible_card_names(self, names: list[str]) -> "FrameworkActivateWizardPage":
        """Assert the exact ordered list of currently visible cards' names."""
        assert self._visible_card_names() == names
        return self

    def assert_card_count(self, n: int) -> "FrameworkActivateWizardPage":
        expect(self._cards()).to_have_count(n)
        return self

    def assert_card_count_at_least(self, n: int) -> "FrameworkActivateWizardPage":
        assert self._cards().count() >= n
        return self

    def assert_only_card_selected(self, name: str) -> "FrameworkActivateWizardPage":
        """Assert exactly one visible card carries the selected-state border, and it's `name`'s."""
        data = self._cards().evaluate_all(
            """(els, selectedClass) => els.map(el => ({
                name: (el.innerText || '').trim().split('\\n')[0]?.trim() ?? '',
                selected: el.classList.contains(selectedClass),
            }))""",
            SELECTED_BORDER_CLASS,
        )
        selected = [d for d in data if d["selected"]]
        assert len(selected) == 1
        assert selected[0]["name"] == name
        return self

    def assert_card_shows_region_and_inactive_badge(self, name: str, region: str) -> "FrameworkActivateWizardPage":
        card = self._card_locator(name)
        expect(card).to_contain_text("Inactive")
        expect(card).to_contain_text(region)
        return self

    def assert_card_has_no_category_or_version_count(self, name: str) -> "FrameworkActivateWizardPage":
        """Assert the card shows no category label and no "N versions"-style count (live cards never render either)."""
        text = self._card_locator(name).inner_text()
        assert not re.search(r"categor(y|ies)", text, re.I)
        assert not re.search(r"\d+\s*versions?", text, re.I)
        return self

    def assert_card_shows_category_and_version_count(self, name: str) -> "FrameworkActivateWizardPage":
        """FW_FR_ACTIVATE_02-required card fields: the card must show a
        category label AND a version count in addition to its name. Fails
        today: live cards render neither (see
        assert_card_has_no_category_or_version_count, which stays as the
        absence-side counterpart documenting the current state)."""
        text = self._card_locator(name).inner_text()
        assert re.search(r"categor(y|ies)", text, re.I)
        assert re.search(r"\d+\s*versions?", text, re.I)
        return self

    def assert_card_description_empty(self, name: str) -> "FrameworkActivateWizardPage":
        """Assert the card's description div renders empty — the card shows
        only its name, the `Inactive` badge, and its region footer (3
        non-empty text lines), never a 4th description line."""
        text = self._card_locator(name).inner_text().strip()
        lines = [line.strip() for line in text.split("\n") if line.strip()]
        assert len(lines) <= 3
        return self

    def assert_no_card_marked_already_in_catalog(self) -> "FrameworkActivateWizardPage":
        expect(self.page.get_by_text(re.compile("already in catalog", re.I))).to_have_count(0)
        return self

    def assert_card_marked_already_in_catalog(self, name: str) -> "FrameworkActivateWizardPage":
        """FW_FR_ACTIVATE_02-required behaviour for an already-activated
        framework: its card must stay PRESENT in the Step 1 grid, visibly
        marked "Already in catalog", and must NOT be selectable — clicking
        it must not put it into the selected-border state. Fails today:
        active frameworks are removed from the grid entirely instead (see
        `assert_card_absent` / `assert_no_card_marked_already_in_catalog` and
        the module docstring §"already Active"). See FW_ACT_014."""
        card = self._card_locator(name)
        expect(card).to_be_visible()
        expect(card).to_contain_text("Already in catalog")
        card.click()
        expect(card).not_to_have_class(re.compile(SELECTED_BORDER_CLASS))
        return self

    def assert_no_duplicate_card_names(self) -> "FrameworkActivateWizardPage":
        names = self._visible_card_names()
        assert len(set(names)) == len(names)
        return self

    def assert_empty_state_message(self) -> "FrameworkActivateWizardPage":
        expect(self.page.get_by_role("heading", name="No results found!", exact=True)).to_be_visible()
        expect(
            self.page.get_by_text(
                "We couldn't find any matches for your search. Try adjusting your search terms", exact=True
            )
        ).to_be_visible()
        return self

    def assert_search_term(self, term: str) -> "FrameworkActivateWizardPage":
        expect(self.page.get_by_placeholder("Search Frameworks")).to_have_value(term)
        return self

    def assert_progress_bar_step1(self) -> "FrameworkActivateWizardPage":
        """Assert the 2-segment progress bar's Step-1 fill state (segment 1 filled/current, segment 2 unfilled)."""
        expect(self._progress_segments().nth(0)).to_have_class(re.compile("bg-allendevaux-dark-blue-300"))
        expect(self._progress_segments().nth(1)).to_have_class(re.compile("bg-allendevaux-primary-50"))
        return self

    def assert_progress_segment_labels(self, labels: list[str]) -> "FrameworkActivateWizardPage":
        """Assert the two progress segments' `aria-label`s, in order (segment
        2's label changes to the selected framework's name once one is
        picked)."""
        actual = self._progress_segments().evaluate_all("els => els.map(el => el.getAttribute('aria-label'))")
        assert actual == labels
        return self

    def assert_progress_segments_not_interactive(self) -> "FrameworkActivateWizardPage":
        """Assert the progress segments look inert (cursor: default) and
        that, with no framework selected, clicking segment 2 does not
        navigate. Does NOT cover the selected-card case — see module
        docstring and click_progress_segment for the confirmed forward-jump
        defect in that case."""
        cursors = self._progress_segments().evaluate_all("els => els.map(el => getComputedStyle(el).cursor)")
        for cursor in cursors:
            assert cursor == "default"
        self.click(self._progress_segments().nth(1))
        expect(self.page.get_by_role("heading", name="Select Framework", exact=True)).to_be_visible()
        return self

    def assert_cards_not_keyboard_operable(self) -> "FrameworkActivateWizardPage":
        """Assert cards carry no `radio`/`radiogroup` role and are not keyboard-focusable (Step 1 is mouse-only)."""
        assert self.page.get_by_role("radio").count() == 0
        assert self.page.get_by_role("radiogroup").count() == 0
        any_focusable = self._cards().evaluate_all(
            "els => els.some(el => el.hasAttribute('tabindex') && el.getAttribute('tabindex') !== '-1')"
        )
        assert any_focusable is False
        return self

    def assert_cards_keyboard_operable(self) -> "FrameworkActivateWizardPage":
        """Required a11y behaviour (mirrors assert_cards_not_keyboard_operable,
        which documents the defect instead): the grid must expose a
        `radiogroup` with `radio` options — or, equivalently, focusable
        cards — AND the first card must be reachable via Tab and activatable
        via keyboard alone. Fails today: cards are plain unfocusable
        `<div>`s with no radio/radiogroup role."""
        has_radio_roles = self.page.get_by_role("radiogroup").count() > 0 and self.page.get_by_role("radio").count() > 0
        any_focusable = self._cards().evaluate_all(
            "els => els.some(el => el.hasAttribute('tabindex') && el.getAttribute('tabindex') !== '-1')"
        )
        assert has_radio_roles or any_focusable

        self.page.get_by_placeholder("Search Frameworks").focus()
        self.page.keyboard.press("Tab")
        first_card_name = self._visible_card_names()[0]
        focused_name = self.page.evaluate(
            "() => (document.activeElement && document.activeElement.textContent || '').trim().split('\\n')[0].trim()"
        )
        assert focused_name == first_card_name

        self.page.keyboard.press("Enter")
        selected_names = self._cards().evaluate_all(
            """(els, selectedClass) => els
                .filter(el => el.classList.contains(selectedClass))
                .map(el => (el.innerText || '').trim().split('\\n')[0]?.trim() ?? '')""",
            SELECTED_BORDER_CLASS,
        )
        assert first_card_name in selected_names
        return self

    # ==========================================
    #             ASSERTIONS — STEP 2
    # ==========================================

    def assert_on_step2(self) -> "FrameworkActivateWizardPage":
        expect(self.page.get_by_role("heading", name="Assign Owner", exact=True)).to_be_visible()
        return self

    def assert_step2_context_heading(self, framework_name: str) -> "FrameworkActivateWizardPage":
        """Assert the read-only context heading below the progress bar shows the selected framework's name."""
        expect(self.page.get_by_role("heading", name=framework_name, exact=True)).to_be_visible()
        return self

    def assert_owner_label_is_plural(self) -> "FrameworkActivateWizardPage":
        expect(self.page.get_by_text("Framework Owners", exact=True)).to_be_visible()
        return self

    def assert_owner_label_has_required_marker(self) -> "FrameworkActivateWizardPage":
        """Fails today: the live "Framework Owners" label carries no
        required-field marker even though Activate is gated on it."""
        expect(self.page.get_by_text("Framework Owners *", exact=True)).to_be_visible()
        return self

    def assert_owner_placeholder(self, text: str) -> "FrameworkActivateWizardPage":
        expect(self.page.locator(".p-multiselect").get_by_text(text, exact=True)).to_be_visible()
        return self

    def assert_owner_picker_is_multi_select_with_checkboxes(self) -> "FrameworkActivateWizardPage":
        expect(self.page.locator(".p-multiselect")).to_be_visible()
        expect(self.page.locator(".p-multiselect-overlay")).to_be_visible()
        checkbox_count = self.page.locator(".p-multiselect-overlay [role=option] input[type=checkbox]").count()
        assert checkbox_count > 0
        return self

    def assert_owner_picker_has_filter_input(self) -> "FrameworkActivateWizardPage":
        expect(self.page.locator(".p-multiselect-overlay input.p-multiselect-filter")).to_be_visible()
        return self

    def assert_owner_option_count_at_least(self, n: int) -> "FrameworkActivateWizardPage":
        count = self.page.locator(".p-multiselect-overlay [role=option]").count()
        assert count >= n
        return self

    def assert_owner_options_narrowed_to(self, n: int) -> "FrameworkActivateWizardPage":
        """Assert the filter has narrowed the option list to exactly `n` options."""
        count = self.page.locator(".p-multiselect-overlay [role=option]:visible").count()
        assert count == n
        return self

    def assert_owner_option_visible(self, text: str) -> "FrameworkActivateWizardPage":
        """Assert an option matching `text` is visible — matched by visible text, never role+name (see module docstring)."""
        expect(self.page.locator(".p-multiselect-overlay [role=option]").filter(has_text=text)).to_be_visible()
        return self

    def assert_owner_options_alphabetical(self) -> "FrameworkActivateWizardPage":
        texts = self.page.locator(".p-multiselect-overlay [role=option]:visible").all_text_contents()
        assert texts == sorted(texts)
        return self

    def assert_owner_options_have_accessible_names(self) -> "FrameworkActivateWizardPage":
        """Fails today: every option's `aria-label` is literally the string "[object Object]"."""
        bad_count = self.page.locator(".p-multiselect-overlay [role=option]:visible").evaluate_all(
            "els => els.filter(el => (el.getAttribute('aria-label') || '').includes('[object Object]')).length"
        )
        assert bad_count == 0
        return self

    def assert_owner_picker_aria_structure_valid(self) -> "FrameworkActivateWizardPage":
        """Fails today: the overlay nests a `listbox` role inside a `searchbox` role — invalid ARIA structure."""
        invalid = self.page.evaluate(
            """() => {
                const searchbox = document.querySelector('[role="searchbox"]');
                return !!(searchbox && searchbox.querySelector('[role="listbox"]'));
            }"""
        )
        assert invalid is False
        return self

    def assert_owner_selected(self, name_or_email: str) -> "FrameworkActivateWizardPage":
        """Assert `name_or_email`'s option checkbox is checked. Works whether the picker is currently open or closed."""

        def _check():
            option = self.page.locator(".p-multiselect-overlay [role=option]").filter(has_text=name_or_email)
            expect(option.locator("input[type=checkbox]")).to_be_checked()

        self._with_owner_picker_open(_check)
        return self

    def assert_owner_selection_capped_at_ten(self) -> "FrameworkActivateWizardPage":
        """Assert the 10-owner maximum holds against the CURRENT selection:
        exactly 10 options are checked, every unchecked option is genuinely
        disabled (aria-disabled="true" or data-p-disabled="true" — the
        confirmed live markers of the real, functional disable; a real
        click on one of these times out with "element is not enabled"), and
        no error/max-reached message renders anywhere on the page. Requires
        the picker to already be open (works via _with_owner_picker_open
        either way)."""

        def _snapshot():
            return self.page.locator(".p-multiselect-overlay [role=option]").evaluate_all(
                """els => {
                    const checked = els.filter(el => !!el.querySelector('input[type=checkbox]:checked'));
                    const unchecked = els.filter(el => !el.querySelector('input[type=checkbox]:checked'));
                    const allUncheckedDisabled = unchecked.every(
                        el => el.getAttribute('aria-disabled') === 'true' || el.getAttribute('data-p-disabled') === 'true'
                    );
                    return { checkedCount: checked.length, allUncheckedDisabled };
                }"""
            )

        snapshot = self._with_owner_picker_open(_snapshot)
        assert snapshot["checkedCount"] == 10
        assert snapshot["allUncheckedDisabled"] is True
        body_text = self.page.locator("body").inner_text()
        assert not re.search(r"\bmax(imum)?\b", body_text, re.I)
        return self

    def assert_activate_disabled(self) -> "FrameworkActivateWizardPage":
        expect(self.page.get_by_role("button", name="Activate", exact=True)).to_be_disabled()
        return self

    def assert_activate_enabled(self) -> "FrameworkActivateWizardPage":
        expect(self.page.get_by_role("button", name="Activate", exact=True)).to_be_enabled()
        return self

    def assert_activation_callout_text(self) -> "FrameworkActivateWizardPage":
        """Assert the amber Activation callout's exact copy."""
        expect(self.page.locator(".border-allendevaux-orange-500.bg-allendevaux-orange-50")).to_contain_text(
            "Activating publishes the framework into the library, and starts contributing the compliance coverage. "
            "You can also save as draft and activate later from the framework detail page."
        )
        return self

    def assert_no_helper_text_under_owner(self) -> "FrameworkActivateWizardPage":
        """Assert there's no small helper-text node hanging under the owner field (distinct from a validation error)."""
        count = (
            self.page.get_by_text("Framework Owners", exact=True)
            .locator("xpath=..")
            .locator("small")
            .count()
        )
        assert count == 0
        return self

    def assert_no_save_as_draft_control(self) -> "FrameworkActivateWizardPage":
        """Assert no `button`/`a` reads "save as draft" — a page-TEXT match is
        WRONG, since the amber callout's own prose contains that phrase."""
        count = self.page.locator("button, a").filter(has_text=re.compile("save as draft", re.I)).count()
        assert count == 0
        return self

    def assert_cancel_present_on_step2(self) -> "FrameworkActivateWizardPage":
        """Fails today: there is no Cancel button anywhere on Step 2."""
        expect(self.page.get_by_role("button", name="Cancel", exact=True)).to_be_visible()
        return self

    def assert_back_only_other_button_is_activate(self) -> "FrameworkActivateWizardPage":
        """Assert the only VISIBLE footer buttons on Step 2 are Back and Activate."""
        texts = self.page.evaluate(
            """() => [...document.querySelectorAll('button')]
                .filter(b => b.offsetParent !== null)
                .map(b => b.textContent.trim())
                .filter(Boolean)"""
        )
        assert "Back" in texts
        assert "Activate" in texts
        assert "Cancel" not in texts
        assert "Next" not in texts
        return self

    def assert_progress_bar_step2(self) -> "FrameworkActivateWizardPage":
        """Assert the progress bar's Step-2 fill state (segment 2 filled/current)."""
        expect(self._progress_segments().nth(1)).to_have_class(re.compile("bg-allendevaux-dark-blue-300"))
        return self

    def assert_step1_cards_hidden_not_removed(self) -> "FrameworkActivateWizardPage":
        """Documents the DOM-presence quirk: Step 1's cards are still IN THE
        DOM (count > 0) but none are VISIBLE while Step 2 shows."""
        assert self.page.locator(CARD_SELECTOR).count() > 0
        assert self._cards().count() == 0
        return self

    def assert_step2_markup_hidden_not_removed(self) -> "FrameworkActivateWizardPage":
        """Mirror of assert_step1_cards_hidden_not_removed: while Step 1 is
        displayed, Step 2's markup (the `Assign Owner` heading, the owner
        MultiSelect, and the `Activation` callout) is PRESENT in the DOM but
        NOT visible. Passes today — exists so presence-vs-visibility false
        passes can never creep back in (see module docstring).

        Step 2's markup mounts a beat AFTER Step 1's cards, so each count has
        to be polled rather than read once — a bare read races the mount and
        sees 0."""
        # DOM-level locators only. get_by_role resolves against the
        # accessibility tree, which EXCLUDES hidden elements — so a role
        # locator's count is 0 for exactly the markup this assertion exists
        # to find.
        targets = [
            self.page.locator('h3:has-text("Assign Owner")'),
            self.page.locator(".p-multiselect"),
            self.page.locator(".border-allendevaux-orange-500.bg-allendevaux-orange-50"),
        ]
        for target in targets:
            for attempt in range(40):
                if target.count() > 0:
                    break
                self.page.wait_for_timeout(250)
            assert target.count() > 0, "Step 2 markup never mounted while Step 1 was displayed"
            expect(target).to_be_hidden()
        return self

    # ==========================================
    #             ASSERTIONS — CHAT FAB
    # ==========================================

    def assert_next_clickable_without_interception(self) -> "FrameworkActivateWizardPage":
        """Fails today: `Next`'s centre lands exactly on the chat FAB's edge and is intercepted."""
        assert self._is_point_intercepted("Next", "centre") is False
        return self

    def assert_activate_clickable_without_interception(self) -> "FrameworkActivateWizardPage":
        """Passes today: `Activate` is wide enough that its centre stays clear of the chat FAB."""
        assert self._is_point_intercepted("Activate", "centre") is False
        return self

    def assert_footer_primary_button_not_overlapped(self) -> "FrameworkActivateWizardPage":
        """Probes 3px in from the footer's primary button's right edge
        (whichever of Next/Activate is currently present) for chat-FAB
        interception."""
        has_next = self.page.get_by_role("button", name="Next", exact=True).count() > 0
        button_name = "Next" if has_next else "Activate"
        assert self._is_point_intercepted(button_name, "rightEdge") is False
        return self

    # ==========================================
    #             ASSERTIONS — POST-ACTIVATION / NAVIGATION
    # ==========================================

    def assert_redirected_to_library(self) -> "FrameworkActivateWizardPage":
        expect(self.page).to_have_url(re.compile(r".*/grc/frameworks/?$"))
        return self

    def assert_redirected_to_login(self) -> "FrameworkActivateWizardPage":
        expect(self.page).to_have_url(re.compile(r".*/login\?returnUrl=%2Fgrc%2Fframeworks%2Factivate"))
        return self

    def assert_success_toast_shown(self) -> "FrameworkActivateWizardPage":
        """Fails today: activation redirects to the Library with no `.p-toast`/`[role=alert]` of any kind."""
        expect(self.page.locator(".p-toast, [role='alert']").first).to_be_visible()
        return self

    def assert_wizard_accessible(self) -> "FrameworkActivateWizardPage":
        """Assert the full wizard rendered (Step 1's heading and card grid) —
        used for the normal-user RBAC case, which is currently fully
        accessible with nothing hidden/disabled (a defect — see
        FW_ACT_017)."""
        expect(self.page).to_have_url(re.compile(r".*/grc/frameworks/activate/?$"))
        expect(self.page.get_by_role("heading", name="Select Framework", exact=True)).to_be_visible()
        assert self._cards().count() > 0
        return self

    def assert_wizard_not_accessible(self) -> "FrameworkActivateWizardPage":
        expect(self.page.get_by_role("heading", name="Select Framework", exact=True)).to_have_count(0)
        return self
