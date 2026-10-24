from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decode_access_token
from app.db.base import get_db
from app.models import User


def _user_from_token(token: str, db: Session) -> User | None:
    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
        token_version = int(payload["ver"])
    except Exception:
        return None
    user = db.get(User, user_id)
    if user is None or user.token_version != token_version:
        return None
    return user


def get_current_user_optional(
    request: Request,
    db: Session = Depends(get_db),
) -> User | None:
    token = request.cookies.get(settings.cookie_name)
    if not token:
        return None
    return _user_from_token(token, db)


def get_current_user(
    user: User | None = Depends(get_current_user_optional),
) -> User:
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def set_session_cookie(response, token: str) -> None:  # type: ignore[no-untyped-def]
    response.set_cookie(
        key=settings.cookie_name,
        value=token,
        max_age=settings.access_token_expire_minutes * 60,
        httponly=True,
        samesite="lax",
        secure=settings.use_secure_cookies,
        path="/",
    )


def clear_session_cookie(response) -> None:  # type: ignore[no-untyped-def]
    response.delete_cookie(
        settings.cookie_name,
        path="/",
        httponly=True,
        samesite="lax",
        secure=settings.use_secure_cookies,
    )
