"""A small in-memory sliding-window limiter for login and registration.

Good enough for one process in development and a class demo; a deployment with
several workers would move this to Redis.
"""

import time
from collections import defaultdict, deque
from threading import Lock


class RateLimiter:
    def __init__(self, max_attempts: int, window_seconds: int) -> None:
        self.max_attempts = max_attempts
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def hit(self, key: str) -> int | None:
        """Record an attempt. Returns seconds to wait if over the limit, else None."""
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] > self.window:
                hits.popleft()
            if len(hits) >= self.max_attempts:
                return int(self.window - (now - hits[0])) + 1
            hits.append(now)
            return None

    def reset(self, key: str) -> None:
        with self._lock:
            self._hits.pop(key, None)


login_limiter = RateLimiter(max_attempts=5, window_seconds=60)
register_limiter = RateLimiter(max_attempts=10, window_seconds=3600)
