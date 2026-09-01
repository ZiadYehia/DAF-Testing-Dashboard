# Background for settings-admin-and-product-display-products-have-no-sidebar-entry-in-any-role-le

Moved out of the bug body to keep the report to the point. Not an attachment the platform indexes (only images and video are), just a file kept beside it.

- `/admin` — "Settings", the platform administration surface, carrying **15 tabs**: Government, Manufacturer, Distributor, Dispenser, System, Platform, System Configuration, Pharmacies, Pharmacy Admins, POS Partners, B2B Partners, Platform Staff, User Locks and Geography.
- `/products` — "Product Display".

Both load and function correctly when the URL is typed. The complete admin sidebar contains no "Settings" and no "Products" label, so the highest-privilege page in the product can only be reached by someone who already knows the path.

Attached `nav-orphan-pages.webm` shows the full sidebar, then both pages loading by direct URL. This is a separate defect from the empty-sidebar-groups bug: those groups exist but have no children, whereas these two pages have no menu entry at all.
