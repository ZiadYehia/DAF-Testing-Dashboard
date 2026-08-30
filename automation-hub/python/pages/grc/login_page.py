"""Login Page — DummyOIDC authentication flow for the GRC portal."""
from __future__ import annotations

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError

from autotest_framework.config import config
from autotest_framework.src.pages.base_page import BasePage


class LoginPage(BasePage):
    """Handles the DummyOIDC login flow used by all GRC portal tests."""

    def __init__(self, page):
        super().__init__(page, "Login Page")

    def login(self) -> None:
        """
        Log in via DummyOIDC using framework config credentials.

        FLAKES handled here:
        - The first click on 'Login with DummyOIDC' sometimes bounces back to
          /login instead of the password screen / user picker — retried once.
        - The provider intermittently rejects the whole handshake with
          'incorrect session hash' and lands on /login-failed — the entire
          flow is retried from scratch (up to 3 attempts).
        """
        last_url = ""
        for attempt in range(1, 4):
            self._attempt_login()
            last_url = self.page.url
            if "/login" not in last_url:
                return
            self.logger.info(f"Login attempt {attempt} landed on {last_url} — retrying")
        raise AssertionError(f"Login failed after 3 attempts — stuck on {last_url}")

    def _attempt_login(self) -> None:
        """One pass through the DummyOIDC flow; caller checks the landing URL."""
        self.navigate(f"{config.base_url}/login")

        oidc_button = self.page.get_by_role("button", name="Login with DummyOIDC")
        self.click(oidc_button)

        password_field = self.page.locator("#password")
        user_button = self.page.locator(f"#{config.username}_button")
        combined_selector = f"#password, #{config.username}_button"

        try:
            self.page.wait_for_selector(combined_selector, state="visible", timeout=5000)
        except PlaywrightTimeoutError:
            self.logger.info("Neither #password nor user button appeared — retrying DummyOIDC click")
            self.click(oidc_button)
            self.page.wait_for_selector(combined_selector, state="visible", timeout=config.timeout)

        if password_field.is_visible():
            self.fill(password_field, config.password)
            self.click(self.page.get_by_role("button", name="Unlock Login"))

        self.click(user_button)
        self.wait_for_url(f"{config.base_url}/**")
