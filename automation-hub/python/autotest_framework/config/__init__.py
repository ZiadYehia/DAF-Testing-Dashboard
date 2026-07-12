"""
Config package initializer.

Creates a singleton ConfigManager instance so the entire framework
shares one configuration object.

Usage:
    from autotest_framework.config import config
    print(config.base_url)
"""

from autotest_framework.config.config_manager import ConfigManager

config = ConfigManager()
