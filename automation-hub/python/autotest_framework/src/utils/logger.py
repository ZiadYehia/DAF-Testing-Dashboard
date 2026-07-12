import logging
import sys
from pathlib import Path
from datetime import datetime

from autotest_framework.config.config_manager import _PYTHON_ROOT


class Logger:
    """
    Centralized logging for the test framework.

    Outputs to both console (INFO level) and a daily log file (DEBUG level).
    When a test fails, the log file provides a full trace of every action
    that led to the failure.

    Usage:
        from autotest_framework.src.utils.logger import Logger
        logger = Logger.get_logger("LoginPage")
        logger.info("Clicking login button")
        logger.error("Login failed")

    Output format:
        14:30:22 | INFO     | LoginPage      | Clicking login button
    """

    _LOG_DIR = _PYTHON_ROOT / "reports" / "logs"
    _initialized = False

    @classmethod
    def _setup_log_dir(cls):
        """Create the logs directory on first use."""
        if not cls._initialized:
            cls._LOG_DIR.mkdir(parents=True, exist_ok=True)
            cls._initialized = True

    @classmethod
    def get_logger(cls, name: str) -> logging.Logger:
        """
        Get a logger instance with console + file output.

        Args:
            name: Logger name (typically the class or module name)

        Returns:
            Configured logger instance
        """
        cls._setup_log_dir()

        logger = logging.getLogger(name)

        # Avoid adding duplicate handlers on repeated calls
        if logger.handlers:
            return logger

        logger.setLevel(logging.DEBUG)

        # --- Console Handler (INFO and above) ---
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.INFO)
        console_format = logging.Formatter(
            fmt="%(asctime)s | %(levelname)-8s | %(name)-20s | %(message)s",
            datefmt="%H:%M:%S",
        )
        console_handler.setFormatter(console_format)

        # --- File Handler (all levels) ---
        today = datetime.now().strftime("%Y-%m-%d")
        file_handler = logging.FileHandler(
            cls._LOG_DIR / f"test_run_{today}.log",
            encoding="utf-8",
        )
        file_handler.setLevel(logging.DEBUG)
        file_format = logging.Formatter(
            fmt="%(asctime)s | %(levelname)-8s | %(name)-20s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        file_handler.setFormatter(file_format)

        logger.addHandler(console_handler)
        logger.addHandler(file_handler)

        return logger
