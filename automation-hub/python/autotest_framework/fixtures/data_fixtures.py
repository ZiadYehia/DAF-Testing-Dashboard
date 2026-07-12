import pytest
import json
from pathlib import Path
from autotest_framework.src.utils.logger import Logger

logger = Logger.get_logger("DataFixtures")


def load_json_data(file_path: str) -> dict | list:
    """
    Load and return data from a JSON file.

    Args:
        file_path: Absolute or project-relative path to the JSON file.

    Raises:
        FileNotFoundError: If the specified file does not exist.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Test data file not found: {file_path}")

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    logger.info(f"Loaded test data from: {file_path}")
    return data
