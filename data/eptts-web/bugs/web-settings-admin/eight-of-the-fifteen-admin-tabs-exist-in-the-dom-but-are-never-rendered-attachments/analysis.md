# Background for eight-of-the-fifteen-admin-tabs-exist-in-the-dom-but-are-never-rendered

Moved out of the bug body to keep the report to the point. Not an attachment the platform indexes (only images and video are), just a file kept beside it.

**The hidden tabs are fully built, not empty.** Querying their panels directly returns real
content — B2B Partners has an "Add Partner" button and columns Name / Type / GLN / API Key /
Status / Created / Actions; User Locks has a Refresh button, columns Email / Entity / Role /
Lock Status / Actions, and actual rows (`e2emasrya2@masar.com`, `e2ejanssen2@masar.com`, …).
So the data loads and the components render; they are simply given no box.

Measured on the panel: `display: inline`, height 0, width 0 — and its parent `.p-tabpanels`
container is also height 0. Clicking a hidden tab through the DOM *does* flip its
`aria-selected` to `true`, which confirms the tab components are live and it is the layout,
not the state, that is broken.

Why this is P1: these are not cosmetic screens. **B2B Partners is where a partner's API keys
are managed** — the same keys the entire B2B integration authenticates with. **User Locks**
controls account lockout. **Platform Staff** and **Pharmacy Admins** manage privileged
accounts. Eight administrative capabilities are unreachable through the product, and because
the markup exists an automated check that reads text rather than pixels would report them as
present.

**Related** to the already-filed *"All seven collapsible sidebar groups render with no child
items"* bug: same shape — parts of the app are built but cannot be reached. Two independent
instances suggests a layout or feature-flag problem broader than either page, and worth
looking at together.

**Evidence:** `admin-shows-only-the-first-tab-bar.jpg` — full-page capture taken *after*
programmatically selecting the "User Locks" tab. The tab reports `aria-selected=true`, yet
neither it nor its bar appears anywhere on the page.

**Note on the duplicate label:** "System Configuration" is used by two different tabs
(`pn_id_4_tabpanel_settings` and `pn_id_10_tabpanel_system`). Whatever the layout fix, those
two need distinguishable names or one of them cannot be referred to unambiguously — by a user
or by a test.

**Covers test cases:** `WEB_SBP_001`, `WEB_SBP_002`, `WEB_SBP_003`, `WEB_SBP_007`, `WEB_SGE_001`, `WEB_SGE_002`, `WEB_SGE_003`, `WEB_SPA_001`, `WEB_SPA_002`, `WEB_SPA_003`, `WEB_SPA_005`, `WEB_SPA_007`, `WEB_SUL_001`, `WEB_SUL_002`, `WEB_SUL_003`, `WEB_SUL_005`

Every one of these fails for the same single reason: the tab cannot be opened, so its
controls, table, search box and Add dialog are all unreachable. They are not sixteen defects.
(The list is kept on one line deliberately — the coverage scanner reads only the first line of
this field, so a wrapped list silently loses everything after the wrap.)
