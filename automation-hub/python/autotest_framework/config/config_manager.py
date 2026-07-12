import json
import os
from pathlib import Path
from dotenv import load_dotenv

# Resolve paths relative to the framework root (autotest_framework/)
_FRAMEWORK_ROOT = Path(__file__).resolve().parent.parent
# automation-hub/python — where conftest.py, pytest.ini, reports/, .auth/ live
_PYTHON_ROOT = _FRAMEWORK_ROOT.parent
# automation-hub — the hub's own .env (APP_LOGIN_USER, APP_BASE_URL, ...)
_HUB_ROOT = _PYTHON_ROOT.parent


class ConfigManager:
    """
    Central configuration manager for the test framework.

    Responsibilities:
        1. Loads .env files (secrets + environment selector)
        2. Loads the JSON config for the selected environment
        3. Exposes all settings as convenient properties

    Why:
        Centralizes URLs, credentials, and browser settings in one place
        instead of scattering them across test files.

    Usage:
        from autotest_framework.config import config

        url = config.base_url
        browser = config.browser
        timeout = config.timeout
    """

    def __init__(self):
        # Load .env files in priority order — first loaded wins (override=False).
        # 1. automation-hub/python/.env — framework-local overrides (optional)
        # 2. automation-hub/.env — the hub's own env (APP_LOGIN_USER, APP_BASE_URL, ...)
        load_dotenv(dotenv_path=_PYTHON_ROOT / ".env", override=False)
        load_dotenv(dotenv_path=_HUB_ROOT / ".env", override=False)

        # Determine the active environment (e.g. qa_app)
        self._environment = os.getenv("ENVIRONMENT", "qa_app")

        # Load environment-specific JSON config
        self._env_config = self._load_environment_config()

    def _load_environment_config(self) -> dict:
        """
        Load the JSON config file for the active environment.
        Example: ENVIRONMENT=qa_app → config/environments/qa_app.json
        """
        environments_dir = Path(__file__).parent / "environments"
        config_path = environments_dir / f"{self._environment}.json"

        if not config_path.exists():
            available = sorted(p.stem for p in environments_dir.glob("*.json"))
            raise FileNotFoundError(
                f"Config file not found: {config_path}\n"
                f"Available environments: {', '.join(available)}"
            )

        with open(config_path, "r") as f:
            return json.load(f)

    # ==========================================
    #     ENVIRONMENT
    # ==========================================

    @property
    def environment(self) -> str:
        """Active environment name (matches a file in config/environments/)."""
        return self._environment

    # ==========================================
    #     URLs
    # ==========================================

    @property
    def base_url(self) -> str:
        """
        Base URL for the application under test.

        Resolution order:
            1. OS env var named by the environment JSON's "base_url_env" key
               (if set and non-empty)
            2. The "base_url" value in the environment JSON
        """
        base_url_env = self._env_config.get("base_url_env")
        if base_url_env:
            env_value = os.getenv(base_url_env)
            if env_value:
                return env_value
        return self._env_config.get("base_url", "")

    # ==========================================
    #     BROWSER SETTINGS
    # ==========================================

    @property
    def browser(self) -> str:
        """Browser type: chromium, firefox, or webkit."""
        return os.getenv("BROWSER", "chromium").lower()

    @property
    def headless(self) -> bool:
        """
        Whether to run the browser in headless mode.
        True  = invisible browser (faster, ideal for CI/CD)
        False = visible browser (useful for debugging)
        """
        return os.getenv("HEADLESS", "true").lower() == "true"

    @property
    def timeout(self) -> int:
        """Default timeout in milliseconds (30000 = 30 seconds)."""
        return self._env_config.get("timeout", 30000)

    @property
    def viewport(self) -> dict:
        """Browser viewport dimensions: {"width": 1920, "height": 1080}."""
        return self._env_config.get("viewport", {"width": 1920, "height": 1080})

    @property
    def slow_mo(self) -> int:
        """
        Delay between each Playwright action in milliseconds.
        Useful for debugging (set > 0). Keep at 0 for CI/CD.
        """
        return self._env_config.get("slow_mo", 0)

    @property
    def fullscreen(self) -> bool:
        """
        Whether to launch the browser maximized (filling the entire screen).
        True  = browser opens maximized, no fixed viewport
        False = browser uses the viewport dimensions from config

        Can be overridden via .env: FULLSCREEN=true
        Only effective in headed mode (headless has no visible window).
        """
        env_value = os.getenv("FULLSCREEN")
        if env_value is not None:
            return env_value.lower() == "true"
        return self._env_config.get("fullscreen", False)

    # ==========================================
    #     CREDENTIALS
    # ==========================================

    @property
    def username(self) -> str:
        """
        Login username.

        Resolution order:
            1. OS env var named by the environment JSON's "username_env" key
            2. DEFAULT_USERNAME from .env
        """
        return os.getenv(self._env_config.get("username_env", ""), "") or os.getenv(
            "DEFAULT_USERNAME", ""
        )

    @property
    def password(self) -> str:
        """
        Login password.

        Resolution order:
            1. OS env var named by the environment JSON's "password_env" key
            2. DEFAULT_PASSWORD from .env
        """
        return os.getenv(self._env_config.get("password_env", ""), "") or os.getenv(
            "DEFAULT_PASSWORD", ""
        )

    @property
    def default_username(self) -> str:
        """Alias for `username` (kept for backwards compatibility)."""
        return self.username

    @property
    def default_password(self) -> str:
        """Alias for `password` (kept for backwards compatibility)."""
        return self.password

    # ==========================================
    #     REPORT PATHS
    # ==========================================

    @property
    def screenshots_dir(self) -> Path:
        """Absolute path to the screenshots output directory."""
        return _PYTHON_ROOT / "reports" / "screenshots"

    @property
    def videos_dir(self) -> Path:
        """Absolute path to the videos output directory."""
        return _PYTHON_ROOT / "reports" / "videos"

    @property
    def traces_dir(self) -> Path:
        """Absolute path to the traces output directory."""
        return _PYTHON_ROOT / "reports" / "traces"

    @property
    def logs_dir(self) -> Path:
        """Absolute path to the logs output directory."""
        return _PYTHON_ROOT / "reports" / "logs"

    # ==========================================
    #     RESOURCE PATHS
    # ==========================================

    @property
    def framework_root(self) -> Path:
        """Absolute path to the autotest_framework directory."""
        return _FRAMEWORK_ROOT

    @property
    def python_root(self) -> Path:
        """Absolute path to the automation-hub/python directory."""
        return _PYTHON_ROOT

    @property
    def hub_root(self) -> Path:
        """Absolute path to the automation-hub directory."""
        return _HUB_ROOT
