# Background for auth-silently-ignores-a-partially-supplied-username-password-instead-of-rejectin

Moved out of the bug body to keep the report to the point. Not an attachment the platform indexes (only images and video are), just a file kept beside it.

This is a validation gap, not an authorization hole: a valid API key remains mandatory and no credential pair can substitute for one, so access is never widened. The risk is that it **hides client bugs** — an integrator whose code fails to populate the password field gets a 200 and believes it authenticated with credentials when it did not.

The source suite expected 400 for these four cases (TC_AUTH_007–TC_AUTH_010).

**Exchange evidence:** `1-exchange-tc_auth_007.jpg`, `2-exchange-tc_auth_008.jpg`, `3-exchange-tc_auth_009.jpg` — the exact request, the response, and the platform's verdict from `MsgStatusQuery`. Replayable copies (`api-log.html`, `api-postman-collection.json`) are written beside each run under `automation-hub/projects/<project>/runs/`. The same shape repeats for `TC_AUTH_010`.

**Covers test cases:** `TC_AUTH_007`, `TC_AUTH_008`, `TC_AUTH_009`, `TC_AUTH_010`

Covered by `TC_AUTH_007`–`TC_AUTH_010` in `automation-hub/projects/eptts-api-authentication/`, which assert the real behaviour and name the divergence from the sheet's expectation so a fix surfaces as a test update.

Related documentation point: the vendor Postman collection and the source spreadsheet both describe /auth as username/password based and located on masar-service. It is apikey-first and lives on registry-service; masar-service/auth is a 404.
