# Background for all-seven-collapsible-sidebar-groups-render-with-no-child-items-leaving-master-d

Moved out of the bug body to keep the report to the point. Not an attachment the platform indexes (only images and video are), just a file kept beside it.

For six of the seven this only advertises features that are not there. For **Master Data** it hides a page that genuinely exists: `/master-data` ("Master Data Snapshots") loads and works when the URL is typed directly, but there is no way to reach it by clicking. Only 8 of the sidebar's entries are real `<a href>` links.

This is role-independent — both admin and manufacturer show the same seven empty groups, so it is not permission filtering removing children for one role.

Attached `nav-master-data.webm` shows the Master Data click doing nothing and then the page loading by URL. `nav-dead-entries.webm` shows the same for the other five groups. Screenshots capture each state.

Verification note: an earlier reading of this as "broken links" was wrong — these are group headers, and correct behaviour for a group header is to expand rather than navigate. The defect is that the groups are **empty**, not that they fail to navigate.
