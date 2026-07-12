"""
Root conftest — registers framework fixtures and provides hooks shared by
every app's test suite under tests/<app>/.
"""

import allure
import pytest
from autotest_framework.config import config
from autotest_framework.src.utils.logger import Logger

logger = Logger.get_logger("RootConftest")

pytest_plugins = [
    "autotest_framework.fixtures.browser_fixtures",
    "autotest_framework.fixtures.auth_fixtures",
    "autotest_framework.fixtures.data_fixtures",
]


# ==========================================
#     AUTO-SCREENSHOT ON FAILURE
# ==========================================

@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """Automatically capture a screenshot when a test fails."""
    outcome = yield
    report = outcome.get_result()

    if report.when == "call" and report.failed:
        page = item.funcargs.get("page") or item.funcargs.get("authenticated_page")

        if page and not page.is_closed():
            screenshots_dir = config.screenshots_dir
            screenshots_dir.mkdir(parents=True, exist_ok=True)

            screenshot_path = screenshots_dir / f"{item.name}_FAILED.png"
            page.screenshot(path=str(screenshot_path), full_page=True)

            allure.attach.file(
                str(screenshot_path),
                name=f"{item.name}_FAILED",
                attachment_type=allure.attachment_type.PNG,
            )
            logger.error(f"Test FAILED: {item.name} — Screenshot saved")
