"""
Base Page Object — the parent class for all page objects in the framework.

Every page in the application inherits from this class and gets access to
common browser actions (click, fill, wait, assert, etc.) without rewriting them.

These methods wrap Playwright actions with:
    - Allure reporting (every action appears as a step in the report)
    - Logging (every action is logged to console + file)

Usage:
    class LoginPage(BasePage):
        def __init__(self, page):
            super().__init__(page, "Login Page")

        @property
        def login_button(self):
            return self.page.get_by_text("Login")

        def login(self):
            self.click(self.login_button)    # inherited from BasePage

Note:
    All locators should be defined as @property in child page classes,
    returning Playwright Locator objects (get_by_text, get_by_role, locator, etc.)
"""

import re

import allure
from playwright.sync_api import Page, Locator, expect
from autotest_framework.config import config
from autotest_framework.src.utils.logger import Logger


class BasePage:
    """
    Base class for all Page Objects.

    Attributes:
        page:       Playwright Page instance (the browser tab)
        page_name:  Human-readable name for logging (e.g., "Login Page")
        logger:     Logger instance for this page
    """

    def __init__(self, page: Page, page_name: str = "BasePage"):
        self.page = page
        self.page_name = page_name
        self.logger = Logger.get_logger(page_name)

    # ==========================================
    #             NAVIGATION
    # ==========================================

    @allure.step("Navigate to: {url}")
    def navigate(self, url: str):
        """
        Navigate to a URL and wait for the page to load.

        Args:
            url: Full URL to navigate to (e.g., "https://app.com/login")
        """
        self.logger.info(f"Navigating to: {url}")
        self.page.goto(url, wait_until="domcontentloaded")

    @allure.step("Reload page")
    def reload(self):
        """Reload the current page and wait for it to load."""
        self.logger.info("Reloading page")
        self.page.reload(wait_until="domcontentloaded")

    def get_current_url(self) -> str:
        """Return the current page URL."""
        return self.page.url

    def get_title(self) -> str:
        """Return the current page title."""
        return self.page.title()

    # ==========================================
    #             ACTIONS
    # ==========================================

    @allure.step("Click on element")
    def click(self, locator: Locator):
        """
        Click an element.

        Args:
            locator: Playwright Locator from a @property in the page object.
        """
        self.logger.info(f"Clicking: {locator}")
        locator.click()

    @allure.step("Double click on element")
    def double_click(self, locator: Locator):
        """
        Double-click an element.

        Args:
            locator: Playwright Locator from a @property.
        """
        self.logger.info(f"Double clicking: {locator}")
        locator.dblclick()

    @allure.step("Fill element with text")
    def fill(self, locator: Locator, text: str):
        """
        Clear the field and type the given text.
        Use this for input fields, textareas, etc.

        Args:
            locator: Playwright Locator for the input field.
            text:    Text to fill in.
        """
        self.logger.info(f"Filling: {locator}")
        locator.fill(text)

    @allure.step("Type into element")
    def type_text(self, locator: Locator, text: str):
        """
        Type text character by character (simulates real keyboard input).
        Slower than fill() but more realistic.

        Args:
            locator: Playwright Locator for the input field.
            text:    Text to type.
        """
        self.logger.info(f"Typing into: {locator}")
        locator.type(text)

    @allure.step("Clear field")
    def clear(self, locator: Locator):
        """
        Clear the content of an input field.

        Args:
            locator: Playwright Locator for the input field.
        """
        self.logger.info(f"Clearing: {locator}")
        locator.clear()

    @allure.step("Hover over element")
    def hover(self, locator: Locator):
        """
        Hover the mouse over an element.
        Useful for dropdown menus or tooltips.

        Args:
            locator: Playwright Locator for the element.
        """
        self.logger.info(f"Hovering: {locator}")
        locator.hover()

    @allure.step("Select option '{value}'")
    def select_option(self, locator: Locator, value: str):
        """
        Select an option from a <select> dropdown.

        Args:
            locator: Playwright Locator for the <select> element.
            value:   The value or visible text of the option to select.
        """
        self.logger.info(f"Selecting '{value}' from: {locator}")
        locator.select_option(value)

    @allure.step("Check checkbox")
    def check(self, locator: Locator):
        """
        Check a checkbox. Does nothing if already checked.

        Args:
            locator: Playwright Locator for the checkbox.
        """
        self.logger.info(f"Checking: {locator}")
        locator.check()

    @allure.step("Uncheck checkbox")
    def uncheck(self, locator: Locator):
        """
        Uncheck a checkbox. Does nothing if already unchecked.

        Args:
            locator: Playwright Locator for the checkbox.
        """
        self.logger.info(f"Unchecking: {locator}")
        locator.uncheck()

    @allure.step("Upload file")
    def upload_file(self, locator: Locator, file_path: str):
        """
        Upload a file using a file input element.

        Args:
            locator:   Playwright Locator for the <input type="file"> element.
            file_path: Path to the file to upload.
        """
        self.logger.info(f"Uploading file: {file_path}")
        locator.set_input_files(file_path)

    # ==========================================
    #             ELEMENT STATE
    # ==========================================

    def get_text(self, locator: Locator) -> str:
        """
        Get the text content of an element.
        Returns empty string if no text found.

        Args:
            locator: Playwright Locator for the element.
        """
        return locator.text_content() or ""

    def get_input_value(self, locator: Locator) -> str:
        """
        Get the current value of an input field.

        Args:
            locator: Playwright Locator for the input element.
        """
        return locator.input_value()

    def get_attribute(self, locator: Locator, attribute: str) -> str:
        """
        Get the value of an HTML attribute from an element.

        Args:
            locator:   Playwright Locator for the element.
            attribute: Name of the attribute (e.g., "href", "class", "data-id").
        """
        return locator.get_attribute(attribute) or ""

    def is_visible(self, locator: Locator) -> bool:
        """
        Check if an element is visible on the page RIGHT NOW.
        Does NOT wait — returns immediately.
        For waiting, use wait_for_element() or assert_element_visible().

        Args:
            locator: Playwright Locator for the element.
        """
        return locator.is_visible()

    def is_enabled(self, locator: Locator) -> bool:
        """
        Check if an element is enabled (not disabled).

        Args:
            locator: Playwright Locator for the element.
        """
        return locator.is_enabled()

    def is_checked(self, locator: Locator) -> bool:
        """
        Check if a checkbox or radio button is checked.

        Args:
            locator: Playwright Locator for the checkbox/radio.
        """
        return locator.is_checked()

    def count_elements(self, locator: Locator) -> int:
        """
        Count how many elements match the locator.

        Args:
            locator: Playwright Locator (may match multiple elements).
        """
        return locator.count()

    # ==========================================
    #             WAITS
    #   States:
    #       "visible"  — element is visible on screen
    #       "hidden"   — element is not visible
    #       "attached" — element exists in DOM (may be hidden)
    #       "detached" — element removed from DOM
    # ==========================================

    @allure.step("Wait for element")
    def wait_for_element(self, locator: Locator, state: str = "visible", timeout: int = None):
        """
        Wait for an element to reach a specific state.

        Args:
            locator: Playwright Locator for the element.
            state:   Target state — "visible", "hidden", "attached", "detached".
            timeout: Max wait time in ms. Defaults to config.timeout (30s).
        """
        timeout = timeout or config.timeout
        self.logger.info(f"Waiting for element to be {state}")
        locator.wait_for(state=state, timeout=timeout)

    def wait_for_url(self, url_pattern: str, timeout: int = None):
        """
        Wait until the page URL matches a pattern.
        Supports wildcards: "**/dashboard**" matches any URL containing "dashboard".

        Args:
            url_pattern: URL or pattern to wait for.
            timeout:     Max wait time in ms.
        """
        timeout = timeout or config.timeout
        self.logger.info(f"Waiting for URL: {url_pattern}")
        self.page.wait_for_url(url_pattern, timeout=timeout)

    def wait_for_load_state(self, state: str = "domcontentloaded"):
        """
        Wait for the page to reach a load state.

        Args:
            state: "domcontentloaded" — HTML parsed (fast, usually enough)
                   "load"             — all resources loaded (images, css)
                   "networkidle"      — no network requests for 500ms (slow but thorough)
        """
        self.page.wait_for_load_state(state)

    # ==========================================
    #             ASSERTIONS
    # ==========================================

    def assert_element_visible(self, locator: Locator, timeout: int = None):
        """
        Assert that an element is visible. Waits automatically.

        Args:
            locator: Playwright Locator for the element.
            timeout: Max wait time in ms before failing.
        """
        self.logger.info(f"Asserting visible: {locator}")
        expect(locator).to_be_visible(timeout=timeout)

    def assert_element_hidden(self, locator: Locator, timeout: int = None):
        """
        Assert that an element is hidden. Waits automatically.

        Args:
            locator: Playwright Locator for the element.
            timeout: Max wait time in ms before failing.
        """
        self.logger.info(f"Asserting hidden: {locator}")
        expect(locator).to_be_hidden(timeout=timeout)

    def assert_text(self, locator: Locator, expected_text: str):
        """
        Assert that an element has exactly the expected text.

        Args:
            locator:       Playwright Locator for the element.
            expected_text: The exact text expected.
        """
        self.logger.info(f"Asserting text: '{expected_text}'")
        expect(locator).to_have_text(expected_text)

    def assert_text_contains(self, locator: Locator, expected_text: str):
        """
        Assert that an element's text contains the expected substring.

        Args:
            locator:       Playwright Locator for the element.
            expected_text: Text that should be contained in the element.
        """
        self.logger.info(f"Asserting text contains: '{expected_text}'")
        expect(locator).to_contain_text(expected_text)

    def assert_url(self, expected_url: str):
        """
        Assert that the current page URL matches exactly.

        Args:
            expected_url: The full expected URL.
        """
        self.logger.info(f"Asserting URL: {expected_url}")
        expect(self.page).to_have_url(expected_url)

    def assert_url_contains(self, partial_url: str):
        """
        Assert that the current URL contains a substring.
        Example: assert_url_contains("/dashboard")

        Args:
            partial_url: URL substring to check for.
        """
        self.logger.info(f"Asserting URL contains: {partial_url}")
        expect(self.page).to_have_url(re.compile(partial_url))

    def assert_title(self, expected_title: str):
        """
        Assert the page title matches exactly.

        Args:
            expected_title: The expected page title.
        """
        self.logger.info(f"Asserting title: {expected_title}")
        expect(self.page).to_have_title(expected_title)

    # ==========================================
    #             SCREENSHOTS
    # ==========================================

    @allure.step("Take screenshot: {name}")
    def take_screenshot(self, name: str = "screenshot") -> str:
        """
        Take a full-page screenshot and attach it to the Allure report.

        Args:
            name: Screenshot name (used for filename and Allure attachment).

        Returns:
            Path to the saved screenshot file.
        """
        screenshots_dir = config.screenshots_dir
        screenshots_dir.mkdir(parents=True, exist_ok=True)

        filepath = screenshots_dir / f"{name}.png"
        self.page.screenshot(path=str(filepath), full_page=True)
        self.logger.info(f"Screenshot saved: {filepath}")

        allure.attach.file(
            str(filepath),
            name=name,
            attachment_type=allure.attachment_type.PNG,
        )
        return str(filepath)
