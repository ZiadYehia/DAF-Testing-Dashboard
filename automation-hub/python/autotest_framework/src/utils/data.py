import random
import time


def unique_suffix() -> str:
    """Digits unique per call — timestamp tail + 3 random digits (parallel-safe)."""
    return f"{str(int(time.time()))[-8:]}{random.randint(100, 999)}"
