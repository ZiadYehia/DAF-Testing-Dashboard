import pytest
from playwright.sync_api import Browser, Page
from autotest_framework.config import config
from autotest_framework.config.browser_config import BrowserConfig
from autotest_framework.config.config_manager import _PYTHON_ROOT
from autotest_framework.src.utils.logger import Logger

logger = Logger.get_logger("AuthFixtures")

# Store auth state inside automation-hub/python/.auth/ (gitignored)
AUTH_STATE_PATH = _PYTHON_ROOT / ".auth" / "auth_state.json"


@pytest.fixture
def do_login():
    """
    Login flow for the application under test.

    This is a placeholder — the framework itself has no knowledge of any
    specific app's login flow. Override this fixture in your app's
    tests/<app>/conftest.py, e.g.:

        @pytest.fixture
        def do_login():
            def _do_login(page):
                page.goto(config.base_url + "/login")
                page.fill("#username", config.username)
                page.fill("#password", config.password)
                page.click("#submit")
                page.wait_for_url("**/dashboard**")
            return _do_login
    """

    def _do_login(page: Page):
        raise NotImplementedError("Override do_login in your app's conftest")

    return _do_login


@pytest.fixture(scope="session")
def auth_state(browser: Browser, do_login):
    """
    Log in once per session and persist the auth state to disk.
    Subsequent tests reuse this state, avoiding repeated logins.
    """
    logger.info("Creating authenticated session state")
    AUTH_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)

    # Create a temporary context to perform the login flow
    context = browser.new_context(**BrowserConfig.get_context_options())
    page = context.new_page()

    # ----- Perform Login (app-specific, provided by do_login) -----
    do_login(page)

    # Save auth state for reuse
    context.storage_state(path=str(AUTH_STATE_PATH))
    logger.info(f"Auth state saved to: {AUTH_STATE_PATH}")

    page.close()
    context.close()

    yield str(AUTH_STATE_PATH)


@pytest.fixture
def authenticated_context(browser: Browser, auth_state: str):
    """
    Browser context that is already logged in.
    Uses the storage state saved by the auth_state session fixture.
    """
    logger.info("Creating authenticated context")

    ctx = browser.new_context(
        **BrowserConfig.get_context_options(),
        storage_state=auth_state,
    )
    ctx.set_default_timeout(config.timeout)

    yield ctx
    ctx.close()


@pytest.fixture
def authenticated_page(authenticated_context):
    """Page that is already logged in — ready for immediate use in tests."""
    page = authenticated_context.new_page()
    yield page
    page.close()
