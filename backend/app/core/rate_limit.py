from __future__ import annotations

import time
from collections import deque
from threading import Lock

from fastapi import Request

from app.core.config import settings


class SlidingWindowLimiter:
    """Small in-process limiter for authentication endpoints.

    This is intentionally process-local. Deployments with multiple workers
    should add a shared store, but the limit still protects single-process
    deployments and local development from trivial credential stuffing.
    """

    def __init__(self) -> None:
        self._events: dict[str, deque[float]] = {}
        self._lock = Lock()

    def allow(self, key: str, *, limit: int, window_seconds: int) -> bool:
        now = time.monotonic()
        with self._lock:
            events = self._events.setdefault(key, deque())
            while events and now - events[0] >= window_seconds:
                events.popleft()
            if len(events) >= limit:
                return False
            events.append(now)
            return True

    def reset(self) -> None:
        with self._lock:
            self._events.clear()


auth_rate_limiter = SlidingWindowLimiter()


def enforce_auth_rate_limit(request: Request, scope: str) -> None:
    host = request.client.host if request.client else "unknown"
    if not auth_rate_limiter.allow(
        f"{scope}:{host}",
        limit=settings.auth_rate_limit_attempts,
        window_seconds=settings.auth_rate_limit_window_seconds,
    ):
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many authentication attempts. Please wait and try again.",
            headers={"Retry-After": str(settings.auth_rate_limit_window_seconds)},
        )
