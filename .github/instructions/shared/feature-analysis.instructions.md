---
description: "Feature analysis guidance. Auto-loaded when working in any feature folder. Guides screenshot interpretation, workflow documentation, and feature-to-FR mapping."
applyTo: "data/**/features/**"
---

When working in any `data/*/features/` subfolder, follow these rules.

## Before Writing Anything

1. **Check for screenshots** — if `screenshots/` folder exists, view ALL images first:
   - Identify every screen name and navigation path
   - Note every field (name, type, required indicator *)
   - Note every dropdown and its visible options
   - Note every scan method (QR camera vs manual keyboard entry)
   - Note every upload option (Image/File, Camera/Gallery)
   - Note status labels and badges on list screens

2. **Check for workflow.md** — read it completely if it exists

3. **If neither exists** — ask the user to provide feature description, screenshots, or a filled workflow.md before proceeding

## Domain Terms

Consult `data/<app>/knowledge/` (the app's domain knowledge and glossary) and the feature's module knowledge directory (`data/<app>/modules/<module>/knowledge/`) for the domain terms, abbreviations, and concepts relevant to the feature being analyzed.
