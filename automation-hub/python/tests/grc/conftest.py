import pytest
from playwright.sync_api import Page

from pages.grc.login_page import LoginPage
from pages.grc.assets_list_page import AssetsListPage
from pages.grc.asset_create_page import AssetCreatePage
from pages.grc.frameworks_library_page import FrameworksLibraryPage
from pages.grc.framework_activate_wizard_page import FrameworkActivateWizardPage
from pages.grc.framework_clause_detail_page import FrameworkClauseDetailPage
from pages.grc.framework_detail_overview_page import FrameworkDetailOverviewPage


@pytest.fixture
def logged_in_page(page: Page) -> Page:
    LoginPage(page).login()
    return page


@pytest.fixture
def assets_page(logged_in_page: Page) -> AssetsListPage:
    return AssetsListPage(logged_in_page).open()


@pytest.fixture
def asset_create_page(logged_in_page: Page) -> AssetCreatePage:
    return AssetsListPage(logged_in_page).open().add_new()


@pytest.fixture
def frameworks_library_page(logged_in_page: Page) -> FrameworksLibraryPage:
    return FrameworksLibraryPage(logged_in_page).open()


@pytest.fixture
def framework_activate_wizard_page(logged_in_page: Page) -> FrameworkActivateWizardPage:
    return FrameworkActivateWizardPage(logged_in_page).open()


@pytest.fixture
def framework_activate_wizard_page_unauthenticated(page: Page) -> FrameworkActivateWizardPage:
    """Fresh, unauthenticated page (no login at all) — used for the
    deep-link-redirects-to-login case (FW_ACT_030). Deliberately built from
    the raw `page` fixture, not `logged_in_page`, so no session exists."""
    return FrameworkActivateWizardPage(page).open_unauthenticated()


@pytest.fixture
def framework_activate_wizard_page_normal_user(page: Page) -> FrameworkActivateWizardPage:
    """Fresh page, no primary-user login — `open_as_normal_user()` performs
    its own login as the second/normal-user credential (GRC_LOGIN_USER_ALT).
    Built from the raw `page` fixture, not `logged_in_page`, so the admin
    session is never established in the first place. Used for the RBAC case
    (FW_ACT_017)."""
    return FrameworkActivateWizardPage(page).open_as_normal_user()


@pytest.fixture
def framework_clause_detail_page(logged_in_page: Page) -> FrameworkClauseDetailPage:
    """Constructed but NOT opened — unlike the other page fixtures above,
    `FrameworkClauseDetailPage.open()`/`open_as_normal_user()` both require a
    `framework_id` argument (tests exercise several different fixtures:
    `PB4ERG63zE`/`OD3zPmaTGK` for real clause data, `fwXOGmGxko` for the
    empty-state Draft), so there is no single sensible default to navigate to
    up front. Each test calls `.open(framework_id)` (or
    `.open_as_normal_user(framework_id)` for the RBAC case, FWC_024) itself —
    same pattern already used by `test_fwact_017_normal_user_wizard_not_
    accessible.py`/`test_fwl_024_no_permission_access_not_blocked.py`, which
    call `open_as_normal_user()` directly off an existing fixture rather than
    needing a dedicated second fixture."""
    return FrameworkClauseDetailPage(logged_in_page)


@pytest.fixture
def framework_detail_overview_page(logged_in_page: Page) -> FrameworkDetailOverviewPage:
    """Constructed but NOT opened — same rationale as `framework_clause_detail_page`
    above: `FrameworkDetailOverviewPage.open()`/`open_as_normal_user()` both
    require a `framework_id` argument (FDO_* tests exercise several different
    fixtures: `PB4ERG63zE`/`OD3zPmaTGK`/`bSO72UIlmZ` for real per-framework
    metadata, `fwXOGmGxko` for the zero-clause Draft empty state), so there is
    no single sensible default to navigate to up front. Each test calls
    `.open(framework_id)` itself."""
    return FrameworkDetailOverviewPage(logged_in_page)
