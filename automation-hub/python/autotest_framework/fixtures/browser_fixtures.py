import pytest
from playwright.sync_api import sync_playwright, Browser, BrowserContext, Page
from autotest_framework.config import config
from autotest_framework.config.browser_config import BrowserConfig
from autotest_framework.src.utils.logger import Logger

logger = Logger.get_logger("BrowserFixtures")


@pytest.fixture(scope="session")
def browser():
    """
    SINGLETON BROWSER — one browser for the entire test session.

    Why singleton?
    - Launching a browser is expensive (~2-3 seconds)
    - We launch ONCE and reuse for all tests
    - Each test gets its own CONTEXT for isolation
    """
    logger.info(f"Launching {config.browser} browser (singleton)")

    pw = sync_playwright().start()

    # Select browser type
    browser_type = {
        "chromium": pw.chromium,
        "firefox": pw.firefox,
        "webkit": pw.webkit,
    }.get(config.browser, pw.chromium)

    # Launch with config options
    browser_instance = browser_type.launch(**BrowserConfig.get_launch_options())

    logger.info(f"Browser launched: {config.browser}")

    yield browser_instance

    # Cleanup
    logger.info("Closing browser (session end)")
    browser_instance.close()
    pw.stop()


@pytest.fixture(scope="function")
def context(browser: Browser):
    """
    New browser context for EACH test.

    Why new context per test?
    - Clean cookies, storage, cache
    - Complete test isolation
    - No test affects another
    """
    logger.info("Creating new browser context")

    ctx = browser.new_context(**BrowserConfig.get_context_options())

    # Set default timeout
    ctx.set_default_timeout(config.timeout)

    # Enable tracing (for debugging failures)
    ctx.tracing.start(screenshots=True, snapshots=True, sources=True)

    yield ctx

    # Cleanup
    ctx.tracing.stop(path=str(config.traces_dir / "trace.zip"))
    ctx.close()
    logger.info("Browser context closed")


@pytest.fixture(scope="function")
def page(context: BrowserContext):
    """
    New page for EACH test.

    This is what you use in tests:
        def test_login(page):
            page.goto("/login")
    """
    logger.info("Creating new page")
    new_page = context.new_page()
    yield new_page
    new_page.close()
    logger.info("Page closed")
