#!/usr/bin/env python3
"""Output the current UTC time in ISO-8601 format with milliseconds.

Usage: python3 timestamp.py
Output: 2026-09-02T03:23:04.000Z
"""

from datetime import datetime, timezone

now = datetime.now(timezone.utc)
print(now.strftime("%Y-%m-%dT%H:%M:%S.000Z"))
