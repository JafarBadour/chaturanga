"""Time control parsing utilities."""

import re
from dataclasses import dataclass


@dataclass
class TimeControlConfig:
    mode: str  # "standard" | "royale"
    time_control: str
    initial_time_ms: int = 0
    increment_ms: int = 0
    move_limit_ms: int = 0


def parse_time_control(time_control: str) -> tuple[int, int]:
    """Parse classic 'minutes+increment' into (initial_ms, increment_ms)."""
    config = parse_time_control_config(time_control)
    if config.mode != "standard":
        raise ValueError(f"Not a standard time control: {time_control}")
    return config.initial_time_ms, config.increment_ms


def parse_time_control_config(time_control: str) -> TimeControlConfig:
    tc = time_control.strip()
    royale_match = re.match(r"^royale/(\d+(?:\.\d+)?)$", tc)
    if royale_match:
        seconds = float(royale_match.group(1))
        return TimeControlConfig(
            mode="royale",
            time_control=tc,
            move_limit_ms=int(seconds * 1000),
        )

    classic_match = re.match(r"^(\d+(?:\.\d+)?)\+(\d+(?:\.\d+)?)$", tc)
    if classic_match:
        minutes, increment = float(classic_match.group(1)), float(classic_match.group(2))
        return TimeControlConfig(
            mode="standard",
            time_control=tc,
            initial_time_ms=int(minutes * 60 * 1000),
            increment_ms=int(increment * 1000),
        )

    raise ValueError(f"Invalid time control: {time_control}")


def is_royale_time_control(time_control: str) -> bool:
    return time_control.strip().startswith("royale/")
