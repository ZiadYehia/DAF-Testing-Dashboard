"""Framework Detail Overview Page — GRC Framework Details screen's persistent
header + "Framework Metadata" block, plus the 4-tab shell underneath it
(/grc/frameworks/details/<id>, story DT-3167).

Ported 1:1 from pages/grc/framework-detail-overview.page.ts — see that file's
docstring for the fully detailed writeup, kept in sync here:

This page object owns everything that renders ABOVE/AROUND the tab content
(header, metadata card, tab navigation) plus shallow "did this tab load"
checks for all 4 tabs. Deep interaction with the "Clauses and Mappings" tab
body belongs to the sibling FrameworkClauseDetailPage
(framework_clause_detail_page.py) — this file only confirms that tab's
chrome renders when reached via switch_to_tab.

HEADLINE FACTS verified live (2026-08-04, build a146218221) — read this
before writing any test against this page object:

1. HEADER — the <h5> title and <p> subtitle are HARDCODED to
   "ISO 28033 - ISO/IEC 28033" / "Information Security Management" on EVERY
   framework, confirmed on 4 distinct ids (ISO 21434, Alaska PIPA, AICPA
   PMF, APEC Privacy Framework) and on the 0-clause Draft fixture. This is
   the P1 navigation bug FDO_001 targets. assert_header_shows_framework
   below asserts the REQUIRED per-framework behavior and is expected to fail
   honestly against this constant. Two buttons sit beside it: Export
   (outlined) and Generate audit package (filled) — both present and
   enabled on every framework, including the Draft.
2. STATUS BADGE — an empty pill container renders below the header buttons
   on every framework (Active or Draft) but NEVER contains any text, even
   though the Library grid's own card correctly shows the framework's
   status. Not mentioned in any FDO test case; documented here as a real,
   minor missing-content defect.
3. FRAMEWORK METADATA — 6 fields in a bordered "Framework Metadata" card,
   each row icon + label span + value span (label class
   text-allendevaux-primary-100 leading-4, value class font-medium, value
   span is the label span's own next sibling): Region, Effective date,
   Clauses (total — there is NO separate "Total Clauses" label),
   Owner/Owners (label ITSELF toggles singular when 0 owners exist, plural
   at 1+, value is <Name> / <Name>, +N / -), Audit readiness, In-scope
   clauses (X / Y). All 6 are confirmed REAL per-framework data (not
   hardcoded) except the header title/subtitle above. The missing-value
   placeholder is a literal hyphen-minus - (U+002D) — NOT the em dash —
   (U+2014) the FDO_003 test case expects.
4. AUDIT READINESS — genuinely computed from real per-framework
   clause-status counts (formula verified against 3 independent frameworks'
   real Partial/Gap splits, see the live-findings doc's item 3 for the full
   working) but NEVER rounded — always the raw JS float
   (40.909090909090914%), and ALWAYS rendered in the same red class
   (text-allendevaux-red-500) regardless of value, because the entire
   453-framework catalog's max Active readiness is 50% and even that is red
   (no Compliant/Implemented clause exists anywhere live, so no
   amber/green fixture is reachable). No progress bar/ring exists anywhere
   in the metadata block — colored text only.
5. DEAD HANDLERS — everything carrying cursor-pointer was tested and NONE
   of it does anything: the Owner/Owners value span, the header's
   Generate audit package button (focuses but opens no modal, fires no
   request), and the Coverage tab's "Open" elements (plain, non-semantic
   <div>s with no href/role/handler at all — clicking does nothing).
   Export was never clicked live (would trigger a real download).
6. AUTO-REFRESH — zero background network activity was observed over a 15s
   idle window on any tab, on any framework — no polling, no websocket, no
   re-fetch on tab switch (tab switches only mutate the client-side ?tab=
   query param and swap already-rendered content). FW_FR_DETAIL_01's
   "refreshes automatically" requirement has no observable implementation.
7. TABS — Applicability and Scoping and Audit Package are static stubs (a
   single bare text node, no heading tag — NOTE the panel body for the
   first one reads "Applicability & Scoping" with an ampersand, while the
   TAB LABEL itself reads "and" — the two strings differ on purpose).
   Clauses and Mappings renders the sibling page's domain/clause tree (mock
   content, but per-framework clause STATUS varies — see that file).
   Coverage is 100% hardcoded/mock: stat cards ("Implemeneted" — sic,
   misspelled in the live app — count and percent render as separate
   elements with NO surrounding parentheses: 5 40% / Partial 4 20% /
   Gaps 20 40%), a Domain Coverage Heatmap (A.5 Organizational Controls (2) / A.8
   Technological Controls (2) / A.5 People Controls (1)), and an "Open Gaps
   (Foundational First)" list — confirmed byte-identical even on the
   0-clause Draft fixture, which is the strongest possible proof this tab
   is fully static. Its numbers NEVER reconcile with the metadata's
   In-scope clauses denominator (5+4+20=29 vs 11 or 12 or 0) — a real,
   persistent inconsistency (FDO_016). The Coverage stat cards carry only a
   native HTML title attribute tooltip (e.g. title="Implemeneted"), NOT a
   clickable info icon — the "About Gap/Partial/Implemented State" dialogs
   that DO exist live only on the Clauses and Mappings tab's status badges
   (see FrameworkClauseDetailPage.click_status_badge), not here (FDO_014
   fails against its premise of an info icon on THIS tab).
8. DRAFT FIXTURE (fwXOGmGxko) — 0% readiness (clean, no NaN%), 0 / 0
   in-scope, Clauses: 0, Region/Owner both -, status badge still
   present-but-empty, and the Coverage tab STILL shows its full non-empty
   mock content (5/4/20 etc.) despite zero real clauses — so the Coverage
   tab's "No Open Gaps" empty state (FDO_005) is unreachable on any known
   fixture, including this most-extreme zero-clause case.
9. ACCESS CONTROL — no RBAC gate whatsoever: a Normal user
   (GRC_LOGIN_USER_ALT) sees byte-identical content and fully enabled
   controls, same as every other GRC page audited so far.
10. STATUS TOGGLE (activate/deactivate), confirmed live 2026-08-04, build
    dca9938158 — a NEW status toggle renders directly below the title/
    Export/Generate audit package row, above the Framework Metadata card.
    The product owner confirmed this is the SAME control that also lives
    on every Library card (FrameworksLibraryPage.toggle_card_status/
    toggle_card_status_and_confirm) — not a page-specific affordance. Same
    underlying markup as the card's: an input.sr-only.peer inside a
    <label>, [checked] when Active; a click must target the <label>, never
    the hidden sr-only input. The toggle's own visible text reads the
    current status word (Active/Inactive) and flips it immediately after
    confirming. Clicking it opens the identical confirmation dialog
    documented on FrameworksLibraryPage ("Deactivate Framework" /
    "Activate Framework", verbatim body copy, "Cancel" + "Yes,
    Deactivate"/"Yes, Activate"). Per the RBAC finding, item 9 above
    extends to this control too: a Normal user's toggle is present AND
    enabled, with no permission gate — item 9's "no RBAC gate whatsoever"
    was written before this control existed but the conclusion is
    unchanged. Note item 2's EMPTY status-badge pill is a DIFFERENT
    element from this toggle — the badge stays textless; the toggle is
    what actually reflects/drives status.

Known framework ids for tests: PB4ERG63zE (ISO 21434, Active, has clauses),
OD3zPmaTGK (Alaska PIPA, Active, has clauses), fwXOGmGxko (Draft, zero
clauses — the zero-state fixture).
"""
from __future__ import annotations

import os
import re
import time

import re

from playwright.sync_api import expect

from autotest_framework.config import config
from autotest_framework.src.pages.base_page import BasePage
from pages.grc.login_page import LoginPage

# The 4 real tabs, in their documented left-to-right order.
TAB_NAMES = ["Applicability and Scoping", "Clauses and Mappings", "Coverage", "Audit Package"]

# Anchored (^...$) label-text patterns for the 6 Framework Metadata rows.
# Anchoring is load-bearing, not cosmetic: "Clauses" is a literal substring
# of "In-scope clauses", so an unanchored has_text="Clauses" filter would
# silently match BOTH rows and break every count-based assertion built on
# top of it — solved here by anchoring instead of a "hasNot"-style exclude.
REGION_LABEL = re.compile(r"^\s*Region\s*$")
EFFECTIVE_DATE_LABEL = re.compile(r"^\s*Effective date\s*$")
CLAUSES_LABEL = re.compile(r"^\s*Clauses\s*$")
# Matches both the singular "Owner" (0 owners) and plural "Owners" (1+ owners) forms — see module docstring item 3.
OWNER_LABEL = re.compile(r"^\s*Owners?\s*$")
AUDIT_READINESS_LABEL = re.compile(r"^\s*Audit readiness\s*$")
IN_SCOPE_CLAUSES_LABEL = re.compile(r"^\s*In-scope clauses\s*$")

# Only "red" is confirmed live (every sampled value, 0%-50%, renders
# identically). "amber"/"green" are UNCONFIRMED best guesses — no fixture in
# the 453-framework catalog exceeds 50% readiness, so neither tier has ever
# been observed (module docstring item 4). Kept so FDO_020's amber/green
# expectations fail honestly against a real (if guessed) class name rather
# than being silently dropped.
AUDIT_READINESS_COLOR_CLASS = {
    "red": "text-allendevaux-red-500",
    "amber": "text-allendevaux-amber-500",
    "green": "text-allendevaux-green-500",
}


class FrameworkDetailOverviewPage(BasePage):
    """Framework Details — persistent header, Framework Metadata block, and 4-tab shell."""

    def __init__(self, page):
        super().__init__(page, "Framework Detail Overview Page")

    def open(self, framework_id: str) -> "FrameworkDetailOverviewPage":
        self.navigate(f"{config.base_url}/grc/frameworks/details/{framework_id}")
        self._wait_for_overview_ready()
        return self

    def open_as_normal_user(self, framework_id: str) -> "FrameworkDetailOverviewPage":
        """Log in fresh as the second/normal-user credential (GRC_LOGIN_USER_ALT,
        =user2) and land straight on the Overview. Mirrors
        FrameworkClauseDetailPage.open_as_normal_user / FrameworksLibraryPage.
        open_as_normal_user — temporarily repoints the username env var
        LoginPage/config reads, rather than hand-rolling a second login flow.
        Confirmed live (2026-08-04): this user sees an IDENTICAL, fully
        interactive page — no permission wall at all — so
        assert_access_denied() is expected to fail honestly."""
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
        self.navigate(f"{config.base_url}/grc/frameworks/details/{framework_id}")
        self._wait_for_overview_ready()
        return self

    # ==========================================
    #             INTERNAL HELPERS
    # ==========================================

    def _wait_for_overview_ready(self) -> None:
        """Wait for the page to have actually hydrated — the "Framework
        Metadata" card title is the one element common to every
        tab/framework/status combination checked, including the 0-clause
        Draft."""
        expect(self.page.get_by_text("Framework Metadata", exact=True)).to_be_visible()

    def _header_title(self):
        """The single <h5> header title — confirmed the only <h5> on the
        page, located by role rather than its Tailwind arbitrary-value class
        list (text-[24px]), which would need manual bracket-escaping to use
        as a CSS selector."""
        return self.page.get_by_role("heading", level=5)

    def _header_subtitle(self):
        """The <p> subtitle directly below the title — structural (next
        sibling of the <h5>), never the subtitle's own Tailwind
        arbitrary-value classes (text-[20px]/leading-[24px]), for the same
        escaping reason as _header_title."""
        return self._header_title().locator("xpath=following-sibling::p[1]")

    def _export_button(self):
        """Confirmed live selector — see module docstring item 1."""
        return self.page.locator('button[aria-label="Export"]')

    def _generate_audit_package_button(self):
        """Confirmed live selector — see module docstring item 1."""
        return self.page.locator('button[aria-label="Generate audit package"]')

    def _status_badge_container(self):
        """The empty status-badge pill below the header buttons — confirmed
        present but always textless on every framework/status checked
        (module docstring item 2). Plain class-list selector; none of these
        classes use Tailwind arbitrary-value brackets, so no escaping is
        needed."""
        return self.page.locator(
            "div.px-2.py-1.w-24.rounded-md.text-center.mb-4.bg-allendevaux-primary-50.text-allendevaux-primary-100"
        )

    def _status_toggle_input(self):
        """The status toggle's <input> — always input.sr-only.peer,
        visually hidden (see module docstring item 10). Read-only lookups
        (e.g. checked/disabled state) are safe against this element;
        CLICKS must go through _status_toggle_label instead."""
        return self.page.locator("input.sr-only.peer")

    def _status_toggle_label(self):
        """The status toggle's <label> wrapper — the only safe click
        target (see module docstring item 10: clicking the sr-only input
        itself either fails or no-ops). :has() is a Playwright-engine CSS
        extension, matching the same technique
        FrameworksLibraryPage._card_toggle_label uses for the identical
        control on a Library card."""
        return self.page.locator("label:has(input.sr-only.peer)")

    def _status_toggle_text(self) -> str:
        """The status toggle's own visible status word (Active/Inactive).

        ROOT CAUSE (confirmed live 2026-08-05 via raw DOM dump on
        AOhLM73phe/Argentina Privacy Law and sDbG2tEfOe/Bahamas DPA, both
        states): the real structure is

            <div class="px-2 py-1 ...">                      outer status pill
              <div class="inline-flex ... rounded-lg ...">   toggle wrapper (label's PARENT)
                <label>...</label>                            (input.sr-only.peer lives here)
              </div>
              <span class="text-center whitespace-nowrap">Active</span>   status word
            </div>

        The status word is a <span> that is a SIBLING of the toggle wrapper
        (i.e. _status_toggle_label()'s PARENT), not a descendant of the
        label and not inside the label's own immediate parent either. The
        previous `xpath=..` climbed only ONE level (label -> wrapper),
        landing on a node containing just the hidden checkbox + the visual
        track — no text at all — so inner_text() always came back "" and
        _wait_for_status_settled spun until timeout. Fixed by stepping from
        the wrapper to its own following-sibling <span> instead of reading
        the wrapper itself."""
        return self._status_toggle_label().locator("xpath=../following-sibling::span[1]").inner_text().strip()

    def _wait_for_status_settled(self, expected_status: str) -> None:
        """Poll the status toggle's own text until it reads
        expected_status, mirroring
        FrameworksLibraryPage._wait_for_card_status_settled's manual-poll
        convention (there is no expect.poll equivalent in
        playwright.sync_api, so both language versions use the same plain
        loop). Confirmed live the post-confirm mutation settles over
        roughly 9 seconds (60 * 150ms)."""
        pattern = re.compile(rf"\b{expected_status}\b")
        for _ in range(60):
            try:
                text = self._status_toggle_text()
            except Exception:
                text = ""
            if pattern.search(text):
                return
            self.page.wait_for_timeout(150)

    def _metadata_label_span(self, label_pattern):
        """The label <span> for one Framework Metadata row, matched by an
        anchored regex (see the module-level label constants' docstring for
        why anchoring — not an exclude filter — is the safe technique
        here)."""
        return self.page.locator("span.text-allendevaux-primary-100.leading-4").filter(has_text=label_pattern)

    def _metadata_value_span(self, label_pattern):
        """The value <span> for one Framework Metadata row — confirmed live
        to be the label span's own next sibling within the same
        "flex gap-x-2 items-start" row (icon, then label, then value, in
        that DOM order)."""
        return self._metadata_label_span(label_pattern).locator("xpath=following-sibling::span[1]")

    def _tab_nav_item(self, tab: str):
        """A tab's nav-bar entry, matched structurally by its exact label
        text and .first — load-bearing for "Audit Package", whose stub PANEL
        body repeats the identical bare string with no wrapping tag (module
        docstring item 7), so an unqualified get_by_text would resolve to 2
        elements once that tab is active. The nav bar renders above its own
        panel in DOM order on every tab checked, so .first is the tab entry,
        never the panel echo."""
        return self.page.get_by_text(tab, exact=True).first

    def _tab_query_pattern(self, tab: str):
        """`tab=<label-with-plus-for-space>` regex, matching the sibling
        FrameworkClauseDetailPage's confirmed tab=Clauses+and+Mappings URL
        convention. Only that one tab value is independently confirmed
        live; the other 3 are assumed to follow the same encoding
        (undocumented otherwise)."""
        return re.compile(f"tab={tab.replace(' ', re.escape('+'))}")

    def _coverage_open_links(self):
        """Coverage tab's "Open" elements — confirmed live to be plain,
        non-semantic <div>s (no href, no role, no handler) reading exactly
        "Open" (module docstring item 5 / item 7)."""
        return self.page.locator("div.text-allendevaux-dark-blue-300").filter(has_text=re.compile(r"^\s*Open\s*$"))

    def _coverage_heatmap_row(self, domain_label: str):
        """One Domain Coverage Heatmap row, e.g. for domain_label =
        "A.5 Organizational Controls". Confirmed live (2026-08-04): the
        domain code ("A.5") and the rest of the label ("Organizational
        Controls") render as two ADJACENT <span>s with no whitespace text
        node between them (spaced only via CSS gap-x-2, not a real space
        character) — so get_by_text("A.5 Organizational Controls",
        exact=True) never matches anything (textContent concatenates to
        "A.5Organizational Controls" with no space), exactly the trap this
        framework's locator-discipline rule warns about. Fixed by keying on
        just the label part after the first space — confirmed unique per row
        even though the leading domain code ("A.5") repeats across 2 of the
        3 rows — then climbing 2 ancestors to the row that also contains the
        sibling bar + count <div>s."""
        label = domain_label[domain_label.index(" ") + 1:]
        return self.page.get_by_text(label, exact=True).locator("xpath=../..")

    def _coverage_stat_card(self, label: str):
        """One Coverage stat card, located by its native `title` attribute
        (get_by_title, NOT a label lookup — which does not match a `title`
        attribute at all) and climbed to the nearest rounded/bordered
        ancestor so the returned locator's inner_text includes the card's
        count/percentage, not just the title-bearing element alone.
        Best-effort ancestor climb — the exact card wrapper's class list was
        not dumped live, only the `title` attribute and its rendered
        numbers (see module docstring item 7)."""
        return (
            self.page.get_by_title(label, exact=True)
            .locator('xpath=ancestor-or-self::div[contains(@class,"rounded") or contains(@class,"border")][1]')
        )

    def _open_gaps_card_heading(self):
        """Confirmed-verbatim live heading text (module docstring item 7 / FDO_004)."""
        return self.page.get_by_text("Open Gaps (Foundational First)", exact=True)

    def _open_gaps_row(self, code_or_title: str):
        """Best-effort locator for one Open Gaps row — UNCONFIRMED exact
        markup. The live pass described each row narratively (warning icon +
        clause code + title + right-aligned "Open" text) and confirmed it
        "renders exactly as described" for FDO_004, but did not dump raw
        outerHTML for this card the way the header/metadata block was
        dumped. Anchored on any div/li FOLLOWING the card's heading in
        document order that contains both the literal word "Open" and
        `code_or_title`, so it still resolves correctly regardless of the
        exact wrapper class names."""
        return (
            self._open_gaps_card_heading()
            .locator("xpath=following::*[self::div or self::li]")
            .filter(has_text="Open")
            .filter(has_text=code_or_title)
        )

    def _coverage_stat_card_info_icon(self, label: str):
        """Best-effort, UNCONFIRMED locator for a clickable info icon on a
        Coverage stat card — findings confirm only a native `title`
        attribute tooltip exists here, no clickable icon at all (module
        docstring item 7). Kept so FDO_014 fails honestly (times out / finds
        nothing) rather than being silently dropped."""
        return self._coverage_stat_card(label).locator('svg[data-icon="info"], button[aria-label*="info" i]')

    # ==========================================
    #             ACTIONS
    # ==========================================

    def switch_to_tab(self, tab: str) -> "FrameworkDetailOverviewPage":
        """Click a tab's nav entry and wait for it to actually become the
        active tab. Confirmed live (2026-08-04) this must key on the tab's
        own aria-selected state, NOT the ?tab= URL query param: on a fresh
        page load, "Applicability and Scoping" (the leftmost/default tab) is
        already selected with NO ?tab= param present at all in the URL, so
        clicking it as the very first tab action is a no-op that never adds
        the query param — a URL-based wait times out even though the tab is
        (trivially) already active. Clicking any OTHER tab does update
        ?tab= as a side effect, but aria-selected is the one signal
        confirmed to flip on every click, default-tab-reselection
        included."""
        nav_item = self._tab_nav_item(tab)
        self.click(nav_item)
        expect(nav_item).to_have_attribute("aria-selected", "true")
        return self

    def click_export_button(self) -> "FrameworkDetailOverviewPage":
        """CAUTION: triggers a real file download live — confirmed
        present/enabled but deliberately never clicked during the live pass
        (module docstring item 5/1). Callers that invoke this should be
        prepared to handle the resulting download event."""
        self.click(self._export_button())
        return self

    def click_generate_audit_package_button(self) -> "FrameworkDetailOverviewPage":
        """Confirmed live no-op (module docstring item 5) — use
        assert_generate_audit_package_is_no_op to verify that."""
        self.click(self._generate_audit_package_button())
        return self

    def click_owner_value(self) -> "FrameworkDetailOverviewPage":
        """Confirmed live no-op (module docstring item 5) — use
        assert_owner_value_click_has_no_effect to verify that."""
        self.click(self._metadata_value_span(OWNER_LABEL))
        return self

    def click_coverage_open_link(self, index: int = 0) -> "FrameworkDetailOverviewPage":
        """Confirmed live no-op (module docstring item 5/7) — use
        assert_coverage_open_link_click_has_no_effect to verify that.
        Requires the Coverage tab to already be active."""
        self.click(self._coverage_open_links().nth(index))
        return self

    def click_coverage_stat_card_info_icon(self, label: str) -> "FrameworkDetailOverviewPage":
        """Best-effort click at the (UNCONFIRMED-to-exist) Coverage
        stat-card info icon — see _coverage_stat_card_info_icon's docstring.
        Requires the Coverage tab to already be active."""
        self.click(self._coverage_stat_card_info_icon(label))
        return self

    def _status_confirm_overlay(self):
        """The confirm overlay is a PLAIN div.fixed.inset-0 (z-[1200],
        bg-black/50) with NO role=dialog and no PrimeVue dialog class, so
        get_by_role("dialog") finds nothing. Anchor on its body copy."""
        return (self.page.locator("div.fixed.inset-0:visible")
                .filter(has_text=re.compile(r"Are you sure you want to (activate|deactivate)", re.I))
                .first)

    def toggle_status(self) -> "FrameworkDetailOverviewPage":
        """Click the status toggle (via its <label>, never the hidden
        sr-only input — see _status_toggle_label's docstring) and wait for
        the confirmation dialog to open. Leaves the dialog open — pair with
        a real click on Cancel/Yes, Activate/Yes, Deactivate, or prefer
        toggle_status_and_confirm for the full flow."""
        self.click(self._status_toggle_label())
        expect(self._status_confirm_overlay()).to_be_visible()
        return self

    def toggle_status_and_confirm(self, expected_status: str) -> "FrameworkDetailOverviewPage":
        """Toggle the status, confirm the resulting dialog ("Yes, Activate"
        when expected_status is "Active", "Yes, Deactivate" when it's
        "Inactive"), and wait for the toggle's own status text to settle on
        expected_status (see _wait_for_status_settled — the mutation
        triggers a navigation that takes several seconds to reflect, so a
        plain post-confirm assertion flakes). Confirmed live (module
        docstring item 10) this bypasses the Activate wizard entirely,
        including for a framework that's never been through it."""
        self.click(self._status_toggle_label())
        expect(self._status_confirm_overlay()).to_be_visible()
        confirm_label = "Yes, Activate" if expected_status == "Active" else "Yes, Deactivate"
        # Scope the confirm button INSIDE the overlay: a second, unrelated
        # div.fixed.inset-0 (the z-40 mobile backdrop) also exists, so an
        # unscoped lookup waits on the wrong stacking context and times out.
        self.click(self._status_confirm_overlay().get_by_role(
            "button", name=confirm_label, exact=True))
        self._wait_for_status_settled(expected_status)
        return self

    def restore_status(self, target_status: str) -> "FrameworkDetailOverviewPage":
        """Idempotent, non-throwing teardown helper for mutating tests (e.g.
        FW_ACT_044/FW_ACT_045) that toggle this same fixture's status as
        part of their body: read the toggle's CURRENT checked state
        directly (never assert_status_reflects, which raises) and, only if
        it doesn't already match target_status, toggle + confirm + wait for
        settle to bring it back. Deliberately asserts nothing and swallows
        any error — a throwing teardown would mask the real test's outcome
        (see each mutating test's local restore fixture). Mirrors
        FrameworksLibraryPage.restore_status. Reuses the private
        _status_toggle_input/_status_toggle_label/_wait_for_status_settled
        helpers rather than calling the public toggle_status_and_confirm
        from here, for consistency with the TS twin's "never call one
        public fluent method from inside another" rule."""
        try:
            input_ = self._status_toggle_input()
            if input_.count() == 0:
                return self
            is_active = input_.is_checked()
            if ("Active" if is_active else "Inactive") == target_status:
                return self

            self.click(self._status_toggle_label())
            confirm_label = "Yes, Activate" if target_status == "Active" else "Yes, Deactivate"
            # Scope the confirm button INSIDE the overlay: a second, unrelated
            # div.fixed.inset-0 (the z-40 mobile backdrop) also exists, so an
            # unscoped lookup waits on the wrong stacking context, then times out.
            self.click(self._status_confirm_overlay().get_by_role(
                "button", name=confirm_label, exact=True))
            self._wait_for_status_settled(target_status)
        except Exception:
            # Best-effort repair only — a teardown helper must never raise
            # and mask the test's real outcome.
            pass
        return self

    # ==========================================
    #             ASSERTIONS — HEADER
    # ==========================================

    def assert_header_buttons_visible(self) -> "FrameworkDetailOverviewPage":
        expect(self._export_button()).to_be_visible()
        expect(self._generate_audit_package_button()).to_be_visible()
        return self

    def assert_export_button_visible(self) -> "FrameworkDetailOverviewPage":
        expect(self._export_button()).to_be_visible()
        return self

    def assert_generate_audit_package_button_visible(self) -> "FrameworkDetailOverviewPage":
        expect(self._generate_audit_package_button()).to_be_visible()
        return self

    def assert_header_title(self, text: str) -> "FrameworkDetailOverviewPage":
        expect(self._header_title()).to_have_text(text)
        return self

    def assert_header_subtitle(self, text: str) -> "FrameworkDetailOverviewPage":
        expect(self._header_subtitle()).to_have_text(text)
        return self

    def assert_header_shows_framework(self, title: str, subtitle: str) -> "FrameworkDetailOverviewPage":
        """FDO_001-required (P1 navigation bug): opening a specific
        framework must show ITS OWN name/description in the header.
        Confirmed live (2026-08-04) on 4 distinct frameworks that the header
        is instead a hardcoded constant ("ISO 28033 - ISO/IEC 28033" /
        "Information Security Management") regardless of which id is opened
        — see module docstring item 1. This asserts the REQUIRED
        per-framework behavior so a test fails honestly against the real
        defect instead of silently passing against the constant."""
        expect(self._header_title()).to_have_text(title)
        expect(self._header_subtitle()).to_have_text(subtitle)
        return self

    def assert_status_badge_container_visible(self) -> "FrameworkDetailOverviewPage":
        expect(self._status_badge_container()).to_be_visible()
        return self

    def assert_status_badge_is_empty(self) -> "FrameworkDetailOverviewPage":
        """Documents the confirmed live defect: the badge container renders
        but is always textless (module docstring item 2), on every status
        (Active/Draft) checked."""
        text = self._status_badge_container().inner_text().strip()
        assert text == "", "expected the status-badge container to be empty (confirmed live default) — see module docstring item 2"
        return self

    def assert_status_badge_text(self, text: str) -> "FrameworkDetailOverviewPage":
        """REQUIRED behavior — no FDO test case names this explicitly, but
        the Library grid's own status badge has no live counterpart here.
        Confirmed the container exists but never carries text on any
        framework checked, so this fails honestly for any non-empty
        `text`."""
        expect(self._status_badge_container()).to_have_text(text)
        return self

    def assert_status_reflects(self, status: str) -> "FrameworkDetailOverviewPage":
        """Assert the status toggle's [checked] state AND its own visible
        status word both reflect `status` — the same control documented on
        FrameworksLibraryPage (module docstring item 10). Distinct from the
        always-textless _status_badge_container above (item 2) — this is
        the control that actually reflects/drives status."""
        input_ = self._status_toggle_input()
        if status == "Active":
            expect(input_).to_be_checked()
        else:
            expect(input_).not_to_be_checked()
        text = self._status_toggle_text()
        assert re.search(rf"\b{status}\b", text), text
        return self

    def assert_status_toggle_enabled(self) -> "FrameworkDetailOverviewPage":
        """Assert the status toggle is present and enabled — the required
        RBAC-adjacent baseline (a Deployment Admin should see it fully
        usable). Confirmed live it's also enabled for a Normal user
        (module docstring item 10) — see
        assert_status_toggle_hidden_or_disabled for the RBAC case that
        SHOULD fail this."""
        expect(self._status_toggle_input()).to_have_count(1)
        expect(self._status_toggle_input()).to_be_enabled()
        return self

    def assert_status_toggle_hidden_or_disabled(self) -> "FrameworkDetailOverviewPage":
        """Required RBAC behaviour: a user without permission to change a
        framework's status should see the toggle absent or disabled.

        Guards FIRST that the detail page actually rendered. The previous
        version returned early whenever input.sr-only.peer had count 0, so a
        slow/failed page load looked like "no toggle, requirement met" — a
        FALSE PASS that hid the live RBAC gap entirely."""
        expect(self.page.get_by_text("Framework Metadata", exact=True)).to_be_visible()
        if self._status_toggle_label().count() == 0:
            return self  # genuinely absent — requirement satisfied
        toggle = self._status_toggle_input()
        is_operable = toggle.count() > 0 and toggle.first.is_enabled()
        assert not is_operable, (
            "status toggle is present AND enabled — this user can change a framework status")
        return self
        expect(toggle).to_be_disabled()
        return self

    # ==========================================
    #             ASSERTIONS — FRAMEWORK METADATA
    # ==========================================

    def assert_metadata_fields_all_visible(self) -> "FrameworkDetailOverviewPage":
        """FDO_002 macro check: all 6 metadata rows' label AND value spans render."""
        for label in (REGION_LABEL, EFFECTIVE_DATE_LABEL, CLAUSES_LABEL, OWNER_LABEL, AUDIT_READINESS_LABEL, IN_SCOPE_CLAUSES_LABEL):
            expect(self._metadata_label_span(label)).to_be_visible()
            expect(self._metadata_value_span(label)).to_be_visible()
        return self

    def assert_region_value(self, value: str) -> "FrameworkDetailOverviewPage":
        expect(self._metadata_value_span(REGION_LABEL)).to_have_text(value)
        return self

    def assert_region_placeholder(self) -> "FrameworkDetailOverviewPage":
        """The real live placeholder is a literal hyphen-minus -, NOT the em
        dash — FDO_003 expects — see module docstring item 3."""
        expect(self._metadata_value_span(REGION_LABEL)).to_have_text("-")
        return self

    def assert_effective_date_value(self, value: str) -> "FrameworkDetailOverviewPage":
        """Confirmed a catalog-wide seed constant (2000/02/22) on every
        framework sampled — not a bug in this component, just worth knowing
        before asserting per-framework variation on this specific field."""
        expect(self._metadata_value_span(EFFECTIVE_DATE_LABEL)).to_have_text(value)
        return self

    def assert_clauses_total_value(self, value: str) -> "FrameworkDetailOverviewPage":
        expect(self._metadata_value_span(CLAUSES_LABEL)).to_have_text(value)
        return self

    def assert_owner_label(self, label: str) -> "FrameworkDetailOverviewPage":
        """Asserts which of the two live forms ("Owner" | "Owners") is
        showing — see module docstring item 3 for the 0/1/2+ owner rule."""
        expect(self._metadata_label_span(OWNER_LABEL)).to_have_text(label)
        return self

    def assert_owner_value(self, value: str) -> "FrameworkDetailOverviewPage":
        """`value` may be a name, a "<Name>, +N" multi-owner summary, or the
        "-" placeholder — see module docstring item 3."""
        expect(self._metadata_value_span(OWNER_LABEL)).to_have_text(value)
        return self

    def assert_owner_placeholder(self) -> "FrameworkDetailOverviewPage":
        """Confirmed live combo for the 0-owner case: label reverts to
        singular "Owner" AND value is the literal hyphen "-" (module
        docstring item 3)."""
        expect(self._metadata_label_span(OWNER_LABEL)).to_have_text("Owner")
        expect(self._metadata_value_span(OWNER_LABEL)).to_have_text("-")
        return self

    def assert_audit_readiness_value(self, text: str) -> "FrameworkDetailOverviewPage":
        """Exact-value check — pass the FULL rendered string including any
        unrounded decimal expansion (e.g. "40.909090909090914%") and the "%"
        sign."""
        expect(self._metadata_value_span(AUDIT_READINESS_LABEL)).to_have_text(text)
        return self

    def assert_audit_readiness_rounded_to_whole_percent(self) -> "FrameworkDetailOverviewPage":
        """FDO_024-required: a non-exact quotient must round to a whole
        percent. Confirmed live (2026-08-04) this page NEVER rounds — every
        fractional result renders the full raw JS float (module docstring
        item 4). Fails honestly against essentially any non-exact-quotient
        framework."""
        text = self._metadata_value_span(AUDIT_READINESS_LABEL).inner_text().strip()
        assert re.match(r"^\d+%$", text), (
            f'FDO_024 requires Audit Readiness to round to a whole percent; the live app renders the raw '
            f'unrounded float instead ("{text}") — see module docstring item 4'
        )
        return self

    def assert_audit_readiness_color(self, color: str) -> "FrameworkDetailOverviewPage":
        """FDO_020-required color-coding by value tier. Confirmed live every
        observed value (0%-50%) renders identically red — see module
        docstring item 4 and the AUDIT_READINESS_COLOR_CLASS docstring for
        why "amber"/"green" are best-effort guesses."""
        expect(self._metadata_value_span(AUDIT_READINESS_LABEL)).to_have_class(re.compile(AUDIT_READINESS_COLOR_CLASS[color]))
        return self

    def assert_audit_readiness_no_progress_bar(self) -> "FrameworkDetailOverviewPage":
        """FDO_021, confirmed and buildable as the app's actual behavior:
        colored text only, no [role=progressbar]/<progress>/inline-width
        fill anywhere in the Audit Readiness row."""
        row = self._metadata_label_span(AUDIT_READINESS_LABEL).locator("xpath=..")
        expect(row.locator('[role=progressbar], progress, div[style*="width"]')).to_have_count(0)
        return self

    def assert_in_scope_clauses_value(self, numerator: str, denominator: str) -> "FrameworkDetailOverviewPage":
        expect(self._metadata_value_span(IN_SCOPE_CLAUSES_LABEL)).to_have_text(f"{numerator} / {denominator}")
        return self

    # ==========================================
    #             ASSERTIONS — READ-ONLY / DEAD HANDLERS
    # ==========================================

    def assert_read_only_page(self) -> "FrameworkDetailOverviewPage":
        """FW_FR_DETAIL_01's read-only requirement: no editable field
        anywhere on the page (confirmed live — no inputs, no forms, nothing
        can be changed)."""
        expect(self.page.locator('input:visible, textarea:visible, [contenteditable="true"]:visible')).to_have_count(0)
        return self

    def assert_owner_value_click_has_no_effect(self) -> "FrameworkDetailOverviewPage":
        """Confirmed live no-op: clicking the Owner/Owners value (which
        carries a misleading cursor-pointer) opens no dialog and changes
        nothing (module docstring item 5). Inlines the click rather than
        calling the public click_owner_value(), per this framework's "never
        call one fluent method from inside another" rule (ported here for
        consistency even though the Python page objects aren't a lazy
        promise chain)."""
        url_before = self.page.url
        self.click(self._metadata_value_span(OWNER_LABEL))
        expect(self.page.get_by_role("dialog")).to_have_count(0)
        assert self.page.url == url_before
        return self

    def assert_generate_audit_package_is_no_op(self) -> "FrameworkDetailOverviewPage":
        """Confirmed live no-op: the button visibly focuses
        (data-p="active") but opens no modal and fires no network request
        (module docstring item 5)."""
        url_before = self.page.url
        self.click(self._generate_audit_package_button())
        expect(self.page.get_by_role("dialog")).to_have_count(0)
        assert self.page.url == url_before
        return self

    def assert_coverage_open_link_is_plain_div(self, index: int = 0) -> "FrameworkDetailOverviewPage":
        """Static-structure proof the Coverage "Open" element is
        non-interactive (plain <div>, no href, no role) — complements the
        dynamic assert_coverage_open_link_click_has_no_effect below.
        Requires the Coverage tab to already be active."""
        el = self._coverage_open_links().nth(index)
        tag = el.evaluate("el => el.tagName")
        href = el.get_attribute("href")
        role = el.get_attribute("role")
        assert tag == "DIV"
        assert href is None
        assert role is None
        return self

    def assert_coverage_open_link_click_has_no_effect(self, index: int = 0) -> "FrameworkDetailOverviewPage":
        """Confirmed live no-op: clicking an "Open" element changes neither
        the URL nor triggers navigation (module docstring item 5/7).
        Requires the Coverage tab to already be active."""
        url_before = self.page.url
        self.click(self._coverage_open_links().nth(index))
        assert self.page.url == url_before
        return self

    def assert_navigated_to_clause_detail(self, clause_code: str) -> "FrameworkDetailOverviewPage":
        """FDO_006-required: clicking an Open Gaps "Open" element should
        land on the Clauses and Mappings tab with `clause_code` selected
        (mirroring FrameworkClauseDetailPage.select_clause's confirmed
        selected-clause heading pattern). Confirmed live the "Open" element
        is a non-interactive plain <div> — clicking it changes nothing — so
        this fails honestly today (module docstring item 5/7)."""
        expect(self.page).to_have_url(re.compile(r"tab=Clauses\+and\+Mappings"))
        expect(self.page.get_by_role("heading", level=2).filter(has_text=clause_code)).to_be_visible()
        return self

    # ==========================================
    #             ASSERTIONS — AUTO-REFRESH
    # ==========================================

    def assert_no_background_network_activity(self, duration_ms: int = 15000) -> "FrameworkDetailOverviewPage":
        """Documents the CONFIRMED current reality (module docstring item
        6): zero network requests of any kind fire while idle on this page.
        Counts every "request" event Playwright observes during
        `duration_ms`, not just data/XHR calls — the live pass found
        literally nothing, static assets included, once the page has
        finished its initial load."""
        request_count = 0

        def on_request(_request):
            nonlocal request_count
            request_count += 1

        self.page.on("request", on_request)
        try:
            self.page.wait_for_timeout(duration_ms)
        finally:
            self.page.remove_listener("request", on_request)
        assert request_count == 0, "expected zero background network activity while idle on the Framework Detail Overview page"
        return self

    def assert_auto_refreshes_on_data_change(self, timeout_ms: int = 20000) -> "FrameworkDetailOverviewPage":
        """FDO_011/FDO_012-required: Audit Readiness must auto-update when a
        clause status changes elsewhere, without a manual refresh.
        UNBUILDABLE against live data — there is no mechanism anywhere to
        trigger such a change, and confirmed zero polling/websocket activity
        over a 15s idle window (module docstring item 6). This polls for
        `timeout_ms` and fails once the timeout elapses with the value
        unchanged, so the case fails honestly instead of hanging or being
        silently skipped. The TS twin uses `expect.poll(...)` here, but
        that's a @playwright/test (JS-only) API with no equivalent on
        playwright.sync_api.expect — this is the manual polling equivalent,
        in the same style as FrameworkClauseDetailPage._wait_for_domain_collapsed_state."""
        before = self._metadata_value_span(AUDIT_READINESS_LABEL).inner_text()
        deadline = time.time() + (timeout_ms / 1000)
        changed = False
        while time.time() < deadline:
            current = self._metadata_value_span(AUDIT_READINESS_LABEL).inner_text()
            if current != before:
                changed = True
                break
            self.page.wait_for_timeout(250)
        assert changed, (
            "FW_FR_DETAIL_01 requires Audit Readiness to auto-refresh when clause data changes elsewhere; "
            "confirmed live (2026-08-04) no polling/websocket mechanism exists at all, so this value never "
            "changes on its own — see module docstring item 6"
        )
        return self

    # ==========================================
    #             ASSERTIONS — TABS
    # ==========================================

    def assert_tabs_visible(self) -> "FrameworkDetailOverviewPage":
        for tab in TAB_NAMES:
            expect(self._tab_nav_item(tab)).to_be_visible()
        return self

    def assert_active_tab(self, tab: str) -> "FrameworkDetailOverviewPage":
        """Asserts the URL's `?tab=` query param reflects `tab` — only the
        "Clauses and Mappings" value is independently confirmed live (see
        _tab_query_pattern's docstring)."""
        expect(self.page).to_have_url(self._tab_query_pattern(tab))
        return self

    def assert_applicability_scoping_tab_content(self) -> "FrameworkDetailOverviewPage":
        """FDO_018: confirmed verbatim stub — a bare text node reading
        "Applicability & Scoping" (note the ampersand, distinct from the tab
        label's "and"), no heading tag, no functional content, no
        errors."""
        expect(self.page.get_by_text("Applicability & Scoping", exact=True)).to_be_visible()
        return self

    def assert_audit_package_tab_content(self) -> "FrameworkDetailOverviewPage":
        """FDO_018: confirmed verbatim stub — a bare text node reading
        "Audit Package", no heading tag. `.last` disambiguates from the tab
        nav entry above it, which repeats the identical string (see
        _tab_nav_item's docstring)."""
        expect(self.page.get_by_text("Audit Package", exact=True).last).to_be_visible()
        return self

    def assert_clauses_and_mappings_tab_loaded(self) -> "FrameworkDetailOverviewPage":
        """Confirms the sibling tab's own chrome loaded — deep interaction
        belongs to FrameworkClauseDetailPage."""
        expect(self.page.get_by_role("heading", name="Domain & Clauses", exact=True)).to_be_visible()
        return self

    def assert_coverage_tab_loaded(self) -> "FrameworkDetailOverviewPage":
        """Confirms the Coverage tab's chrome loaded (stat cards + Open Gaps
        card both rendered)."""
        expect(self.page.get_by_title("Implemeneted", exact=True)).to_be_visible()
        expect(self._open_gaps_card_heading()).to_be_visible()
        return self

    # ==========================================
    #             ASSERTIONS — COVERAGE TAB
    # ==========================================

    def assert_coverage_stat_card(self, label: str, count: int, pct: int) -> "FrameworkDetailOverviewPage":
        """FDO_022: exact verbatim label (including the "Implemeneted"
        misspelling), count, and percentage. Requires the Coverage tab to
        already be active. Confirmed live (2026-08-04) via raw outerHTML
        dump: the count and percentage render as separate <h6>/<p> siblings
        with NO surrounding parentheses (<h6>5</h6><p>40%</p>, not
        "5 (40%)") — the percentage check below matches the bare "40%"
        accordingly."""
        card = self._coverage_stat_card(label)
        expect(card).to_be_visible()
        text = re.sub(r"\s+", " ", card.inner_text())
        assert f"{count}" in text
        assert f"{pct}%" in text
        return self

    def assert_coverage_heatmap_row(self, domain_label: str, count: int) -> "FrameworkDetailOverviewPage":
        """FDO_023: one Domain Coverage Heatmap row's label + count.
        Requires the Coverage tab to already be active."""
        code = domain_label[: domain_label.index(" ")]
        row = self._coverage_heatmap_row(domain_label)
        expect(row).to_be_visible()
        expect(row).to_contain_text(code)
        expect(row).to_contain_text(str(count))
        return self

    def assert_coverage_stats_sum_matches_in_scope_denominator(self) -> "FrameworkDetailOverviewPage":
        """FDO_016-required internal-consistency check: the 3 Coverage stat
        counts should sum to the metadata's In-scope clauses denominator.
        Confirmed live (2026-08-04) this NEVER holds — Coverage is fully
        hardcoded mock content (5+4+20=29) regardless of the real
        per-framework denominator (11, 12, or 0 on the Draft) — see module
        docstring item 7. Fails honestly on every fixture. Requires the
        Coverage tab to already be active."""

        def read_count(label: str) -> float:
            text = self._coverage_stat_card(label).inner_text()
            match = re.search(r"(\d+)\s*\(", text)
            return float(match.group(1)) if match else float("nan")

        implemented = read_count("Implemeneted")
        partial = read_count("Partial")
        gaps = read_count("Gaps")
        denominator_text = self._metadata_value_span(IN_SCOPE_CLAUSES_LABEL).inner_text().strip()
        denominator = float(denominator_text.split("/")[1].strip())
        assert implemented + partial + gaps == denominator, (
            "FDO_016: Coverage stat-card sum should reconcile with the In-scope clauses denominator; the live "
            "app never reconciles them (Coverage is hardcoded mock content) — see module docstring item 7"
        )
        return self

    def assert_open_gaps_card_visible(self) -> "FrameworkDetailOverviewPage":
        expect(self._open_gaps_card_heading()).to_be_visible()
        return self

    def assert_open_gaps_row(self, code: str, title: str) -> "FrameworkDetailOverviewPage":
        """FDO_004: one Open Gaps row's clause code, title, an "Open" label,
        and a warning-triangle icon. Requires the Coverage tab to already be
        active."""
        row = self._open_gaps_row(code)
        expect(row).to_be_visible()
        expect(row).to_contain_text(title)
        expect(row).to_contain_text("Open")
        assert row.locator("svg").count() > 0
        return self

    def assert_open_gaps_list_excludes(self, code_or_title: str) -> "FrameworkDetailOverviewPage":
        """FDO_025: asserts a Compliant/Partial/Not-Applicable clause does
        NOT appear in the Open Gaps list. Requires the Coverage tab to
        already be active."""
        expect(self._open_gaps_row(code_or_title)).to_have_count(0)
        return self

    def assert_no_open_gaps_empty_state(self) -> "FrameworkDetailOverviewPage":
        """FDO_005-required empty state: a centered checkmark + "No Open
        Gaps" message when zero Gap clauses exist. UNBUILDABLE against live
        data — no fixture, including the 0-clause Draft, ever shows anything
        but the fixed 2-row mock list (module docstring item 7/8). Fails
        honestly."""
        expect(self.page.get_by_text("No Open Gaps", exact=True)).to_be_visible()
        return self

    def assert_coverage_stat_card_about_dialog_visible(self, label: str) -> "FrameworkDetailOverviewPage":
        """FDO_014-required: a dismissible "About `<label>` state" dialog
        after clicking the (UNCONFIRMED-to-exist) Coverage stat-card info
        icon. Confirmed live only a native `title` tooltip exists here — no
        clickable icon, no dialog (module docstring item 7). Fails
        honestly."""
        expect(self.page.get_by_role("dialog").filter(has_text=f"About {label} state")).to_be_visible()
        return self

    # ==========================================
    #             ASSERTIONS — DRAFT / ZERO-STATE
    # ==========================================

    def assert_draft_zero_state(self) -> "FrameworkDetailOverviewPage":
        """fwXOGmGxko ("Test Framework Draft aIjJnV") full zero-state,
        confirmed live (module docstring item 8): Region/Owner both the "-"
        placeholder (Owner label reverts to singular), Clauses: 0, Audit
        readiness: 0% (clean, no NaN%), In-scope clauses: 0 / 0. Does NOT
        check the Coverage tab — that tab's mock content is identical
        regardless of real clause count (see assert_coverage_stat_card/
        assert_no_open_gaps_empty_state for asserting that inconsistency
        directly)."""
        expect(self._metadata_value_span(REGION_LABEL)).to_have_text("-")
        expect(self._metadata_value_span(CLAUSES_LABEL)).to_have_text("0")
        expect(self._metadata_label_span(OWNER_LABEL)).to_have_text("Owner")
        expect(self._metadata_value_span(OWNER_LABEL)).to_have_text("-")
        expect(self._metadata_value_span(AUDIT_READINESS_LABEL)).to_have_text("0%")
        expect(self._metadata_value_span(IN_SCOPE_CLAUSES_LABEL)).to_have_text("0 / 0")
        return self

    # ==========================================
    #             ASSERTIONS — ACCESS CONTROL
    # ==========================================

    def assert_access_denied(self) -> "FrameworkDetailOverviewPage":
        """Required RBAC behaviour: a user without "Framework View"
        permission should not reach this page or see its data. Confirmed
        live (2026-08-04) a Normal user loads the full page with no block,
        so this fails honestly today (module docstring item 9)."""
        expect(self.page.get_by_text("Framework Metadata", exact=True)).to_have_count(0)
        return self
