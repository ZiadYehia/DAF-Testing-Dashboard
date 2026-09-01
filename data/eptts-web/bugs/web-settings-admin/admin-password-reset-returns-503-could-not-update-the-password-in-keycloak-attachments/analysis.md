# Background for admin-password-reset-returns-503-could-not-update-the-password-in-keycloak

Moved out of the bug body to keep the report to the point. Not an attachment the platform indexes (only images and video are), just a file kept beside it.

```json
{ "statusCode": 503, "path": "/masar-service/api/v1/users/<id>/password",
  "message": "Could not update the password in Keycloak — no change was made" }
```

Reproduced for two different users (`distributor@devsim.local` and `pharmacy@devsim.local`) as admin. The platform's Keycloak admin integration for password updates is not working. The message confirms nothing was changed, so it fails safe rather than half-applying — but the capability is entirely unavailable.

**This blocks test coverage**: without a known password, the dashboard cannot be exercised as the distributor or pharmacy role at all, so every role-isolation and role-specific dashboard test for those two roles is unexecutable. The B2B API path is unaffected (it authenticates by API key).

Password used met the documented policy (16 chars, upper + lower + digit + symbol), so this is not a policy rejection — a policy failure would return 400, not 503.

Blocks: all dashboard test cases requiring the distributor or pharmacy role. Please either fix the Keycloak integration or supply the existing passwords for those two accounts.
