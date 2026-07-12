from autotest_framework.config import config


class BrowserConfig:
    """
    Builds Playwright launch and context option dictionaries.

    Separates "what options to use" from "how to launch the browser",
    keeping browser_fixtures.py focused on lifecycle management.

    Playwright hierarchy:
        Browser (singleton, launched once per session)
          └── Context (one per test, isolated cookies/storage)
               └── Page (one per test, the actual browser tab)
    """

    @staticmethod
    def get_launch_options() -> dict:
        """Browser launch options — used ONCE for the singleton browser."""
        options = {
            "headless": config.headless,
            "slow_mo": config.slow_mo,
        }

        # --start-maximized when fullscreen is enabled
        if config.fullscreen:
            options["args"] = ["--start-maximized"]

        return options

    @staticmethod
    def get_context_options() -> dict:
        """
        Context options — created fresh for EACH test.
        """
        # Fullscreen: no fixed viewport, browser fills the screen
        if config.fullscreen:
            options = {
                "no_viewport": True,
                "ignore_https_errors": True,
            }
        else:
            options = {
                "viewport": config.viewport,
                "ignore_https_errors": True,
            }

        # Enable video recording if a videos directory is configured
        if config.videos_dir:
            config.videos_dir.mkdir(parents=True, exist_ok=True)
            options["record_video_dir"] = str(config.videos_dir)
            options["record_video_size"] = {
                "width": config.viewport["width"],
                "height": config.viewport["height"],
            }

        return options
