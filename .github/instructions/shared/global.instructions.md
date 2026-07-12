---
description: "General QA standards and writing style rules that apply across all bug reporting activities. Enforces consistency, professionalism, and senior-level quality in all outputs."
applyTo: ".github/agents/**/*-bug-reporter.agent.md"
---

# Global QA Standards & Writing Style

---

## Tone & Language

- Professional, direct, and objective â€” no filler words, no hedging ("seems to", "appears to", "might be")
- State facts, not opinions â€” describe observed behavior only
- Write in English
- Use **present tense**: "The system shows X" not "The system showed X"
- Use **active voice**: "The system merges quantities" not "Quantities are merged by the system"
- Use exact UI labels for buttons, fields, and screens â€” include Arabic labels in quotes when relevant (e.g., "ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„")

## Precision Rules

- Never say "doesn't work" â€” describe WHAT doesn't work and HOW it fails
- Always include the contrast: what happens vs what should happen
- Use exact values, counts, and identifiers (GTIN, SSN, quantity numbers, invoice IDs)
- Avoid ambiguous pronouns â€” name the subject explicitly every time

## One Bug, One Report

- Never combine multiple bugs into a single report
- If a bug has multiple symptoms, use the root cause as the title and mention other symptoms in the summary
- Use consistent terminology from the app's domain glossary

