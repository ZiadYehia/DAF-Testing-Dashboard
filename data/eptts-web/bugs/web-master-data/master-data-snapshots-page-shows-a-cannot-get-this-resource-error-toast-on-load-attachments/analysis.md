# Background for master-data-snapshots-page-shows-a-cannot-get-this-resource-error-toast-on-load

Moved out of the bug body to keep the report to the point. Not an attachment the platform indexes (only images and video are), just a file kept beside it.

A related endpoint is missing on the service the collection documents: `GET /masar-service/api/v1/master-data/snapshot/latest` returns 404, while master data actually lives on registry-service (`GET /registry-service/api/v1/master-data/versions`). It is likely the page is calling the former.

This matters beyond cosmetics: this page is how integrators obtain the signed master-data manifest, and the page cannot show whether any snapshot exists.

**Covers test cases:** `WEB_MDT_001`, `WEB_MDT_002`

Both fail on the same error banner — `WEB_MDT_002` differs only in reloading the route rather
than opening it fresh.

Screenshot attached — the error toast is visible top-right. Reproducible on every load.

Also verify whether the page should be calling registry-service rather than masar-service: `/masar-service/api/v1/master-data/snapshot/latest` is a 404 whereas `/registry-service/api/v1/master-data/versions` returns 200.
