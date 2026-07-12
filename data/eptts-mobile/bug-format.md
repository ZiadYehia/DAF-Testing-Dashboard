<!-- generated-from-intake -->
# Bug Report Format

## Required sections

Bug reports use a front-matter + body Markdown template (bugs/_template.md): YAML front matter with title, app (eptts-mobile), feature (feature slug), severity (Critical/High/Medium/Low), priority (P1-P4), platform (Android/iOS/Both), device (Device Model - OS Version), appVersion, status (defaults to Open), reportedBy, date. Body sections in order: Summary (1-3 paragraphs describing what's broken, context, and impact), Steps to Reproduce (numbered, starting with the login role, then the module/screen, then the specific actions, ending with what to observe), Expected Result (one clear sentence), Actual Result (one clear sentence), and Environment (Device + OS version, Platform, App Version, Role/Account, Network state — Online/Offline/Both).

## Severity / priority conventions

Severity: Critical / High / Medium / Low. Priority: P1 / P4 (P1 highest). Severity should reflect supply-chain/compliance impact given this is a regulated pharmaceutical track-and-trace app — e.g. an EPCIS event silently failing to submit, a pack being dispensable when it shouldn't be, or a return being confirmed twice would be Critical/High; cosmetic issues or copy mismatches on rarely used screens (e.g. Inspector detail labels) would be Low. Known non-functional Retry button on token-expiry ('Unauthorized' state after the 15-minute access-token expiry, no auto-refresh) is a good example candidate bug worth logging at High severity given it blocks all in-progress work until re-login. Each bug report must record whether the issue occurred Online or Offline and which role/account reproduced it, since behavior (and correctness) differs materially per role (Pharmacy/Branch/Distributor/Inspector/Patient).
