from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import (
    clear_session_cookie,
    get_current_user,
    get_current_user_optional,
    set_session_cookie,
)
from app.core.config import settings
from app.core.rate_limit import enforce_auth_rate_limit
from app.core.security import create_access_token, hash_password, verify_password
from app.db.base import get_db
from app.models import NotificationPreference, User
from app.schemas import AuthResponse, LoginRequest, MessageResponse, RegisterRequest, UserOut
from app.seed import reset_demo, seed_demo
from app.services.notifications import get_or_create_preferences

router = APIRouter(prefix="/auth", tags=["authentication"])


def _issue_session(user: User, response: Response) -> AuthResponse:
    token = create_access_token(user.id, user.email, user.token_version)
    set_session_cookie(response, token)
    return AuthResponse(user=UserOut.model_validate(user))


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthResponse:
    enforce_auth_rate_limit(request, "register")
    email = payload.email.strip().lower()
    if db.scalar(select(User).where(User.email == email)) is not None:
        raise HTTPException(status_code=409, detail="An account with that email already exists")
    user = User(
        name=payload.name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        timezone=settings.timezone,
    )
    db.add(user)
    db.flush()
    db.add(NotificationPreference(user_id=user.id))
    db.commit()
    db.refresh(user)
    return _issue_session(user, response)


@router.post("/login", response_model=AuthResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthResponse:
    enforce_auth_rate_limit(request, "login")
    email = payload.email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    get_or_create_preferences(db, user.id)
    db.commit()
    db.refresh(user)
    return _issue_session(user, response)


@router.post("/demo", response_model=AuthResponse)
def demo_login(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthResponse:
    enforce_auth_rate_limit(request, "demo")
    user = seed_demo(db)
    db.refresh(user)
    return _issue_session(user, response)


@router.post("/logout", response_model=MessageResponse)
def logout(
    response: Response,
    user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
) -> MessageResponse:
    if user is not None:
        user.token_version += 1
        db.commit()
    clear_session_cookie(response)
    return MessageResponse(message="Signed out")


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(user)


@router.post("/demo/reset", response_model=AuthResponse)
def demo_reset(
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AuthResponse:
    if not user.is_demo:
        raise HTTPException(status_code=403, detail="Only the fictional demo account can be reset")
    new_user = reset_demo(db)
    db.refresh(new_user)
    return _issue_session(new_user, response)
