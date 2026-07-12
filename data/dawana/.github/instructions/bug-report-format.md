---
description: "Bug report format template, title-writing rules, priority classification, bug type classification, and quality checklist. Applied when the Bug Reporter agent writes bug reports."
applyTo: ".github/agents/bug-reporter.agent.md"
---

# Bug Report Format Reference

---

## Exact Jira Template

The markdown file frontmatter must include a `title` field. The body starts directly with the summary — no title line in the body.

Frontmatter example:
```yaml
---
title: <exact bug title — see Title Rules below>
status: draft
jira_key: null
reported_at: null
feature: <feature>
priority: <P1|P2|P3|P4>
bug_type: <exact bug type string>
---
```

Body:
```
[SUMMARY — 1-3 paragraphs. No heading. Explain the problem clearly: what is broken, what the context is, and why it matters. Include serialization/integration context when relevant.]

---

**Steps to Reproduce:**

1. [First action]
2. [Second action]
...

---

**Expected Result:**
[One clear sentence describing what should happen.]

---

**Actual Result:**
[One clear sentence describing what actually happens.]

---

**Environment:**
[Device / OS / App Version / Account / URL — include only the lines that are relevant]

---

**Priority:**
[P1 – Critical | P2 – High | P3 – Medium | P4 – Low]

---

**Bug Type:**
[Functional | Functional / Integration | Functional (Backend/API) | Functional — Intermittent / Flaky | UI/UX]
```

> **Precondition block:** Include a `**Precondition:**` section (between Summary and Steps, separated by `---`) only when the bug requires a specific non-obvious system state.

> **Screenshots:** Do not embed images in the markdown file. Add a `**Screenshots to attach:**` note at the end of the summary listing what screenshots the reporter should upload to Jira manually. Place files in `attachments/<feature>/<bug-slug>/`.

---

## Title Writing Rules

### Pattern
```
[Subject] [wrong behavior] when/instead of/even though [expected context]
```

### Rules
- Never use vague words: "bug", "issue", "problem", "error", "not working"
- Always name the specific subject (product, quantity, GTIN, userId, National ID)
- Always name the specific wrong behavior
- Always provide the contrast (what it does vs what it should do)
- Maximum 1 sentence — no period at end
- For API bugs: include the API name or payload field
- For integration bugs: name both systems (e.g., "in Dawana but … in Masar")

---

## Priority Classification

| Priority | Meaning | Example |
|----------|---------|---------|
| P1 – Critical | App unusable, data loss, security issue, blocks core workflows | App crashes, stock data deleted |
| P2 – High | Core workflow broken but workaround exists | Barcode scan fails, wrong stock deducted |
| P3 – Medium | Feature partially works, minor data issue | UI label wrong, filter doesn't sort correctly |
| P4 – Low | Cosmetic, minor UX issue | Typo, spacing, icon misalignment |

## Bug Type Classification

| Type | When to Use |
|------|-------------|
| Functional | Standard logic/behavior bug |
| Functional / Integration | Bug involves Masar or EDA sync |
| Functional (Backend/API) | API payload or response is wrong |
| Functional — Intermittent / Flaky | Bug doesn't always reproduce |
| UI/UX | Visual or usability issue only |
