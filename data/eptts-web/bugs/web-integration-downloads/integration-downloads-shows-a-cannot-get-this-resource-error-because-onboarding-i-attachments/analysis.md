# Background for integration-downloads-shows-a-cannot-get-this-resource-error-because-onboarding-i

Moved out of the bug body to keep the report to the point. Not an attachment the platform indexes (only images and video are), just a file kept beside it.

```
GET 200  /masar-service/api/v1/users/me
GET 404  https://192.168.225.195:8445/registry-service/api/v1/onboarding/integration/info
GET 200  https://192.168.225.195:8445/registry-service/api/v1/admin/integration-downloads/postman/info
```

The page's own content still loads — the Postman Collection and Latest Master Data Snapshot
sections render, along with their Upload / Download / Manage versions / Download Latest
actions. So the failure is **partial**: the page is usable but shows a raw backend error the
user can neither act on nor dismiss meaningfully. Note the sibling endpoint on the same service
(`admin/integration-downloads/postman/info`) answers 200, so registry-service itself is healthy
and reachable — it is this one path that does not exist.

Why P2 rather than cosmetic: this page is how an integrating partner obtains the Postman
collection and the master-data snapshot. An unexplained error banner on the onboarding page is
the first thing a new integrator sees, and it gives them no way to know whether what they just
downloaded is complete.

**Related but distinct** from the `/master-data` bug ("Master Data Snapshots page shows a Cannot
GET this resource error toast on load"): same symptom string and the same underlying pattern —
a page calling an endpoint that does not exist — but a different page and a different missing
path, so they need separate fixes. Worth checking whether other pages call endpoints from a
stale API map; two instances of one pattern suggests more.

**Evidence:**
`data/eptts-web/features/web-integration-downloads/screenshots/web-integration-downloads.jpg`
— full-page capture showing the error banner above the loaded content.

**Covers test cases:** `WEB_IDL_001`, `WEB_IDL_002`

`WEB_IDL_002` reloads the route rather than opening it fresh; the error banner is present
either way, so both fail on this one defect.
