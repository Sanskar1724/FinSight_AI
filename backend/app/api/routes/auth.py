from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from sqlalchemy import delete, select
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
from app.db.base import get_db, utcnow
from app.models import NotificationPreference, PasswordResetToken, User
from app.schemas import (
    AuthResponse,
    ChangePasswordRequest,
    DeleteAccountRequest,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    ResetPasswordRequest,
    SessionResponse,
    UserOut,
)
from app.seed import reset_demo, seed_demo
from app.services.email import password_reset_email, send_email
from app.services.notifications import get_or_create_preferences

router = APIRouter(prefix="/auth", tags=["authentication"])

RESET_REQUESTED_MESSAGE = (
    "If an account exists for that email, a password reset link is on its way."
)


def _hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


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


@router.get("/session", response_model=SessionResponse)
def session(user: User | None = Depends(get_current_user_optional)) -> SessionResponse:
    """Session probe for the web app: 200 with ``user: null`` when signed out,
    so loading a public page does not produce a 401."""
    return SessionResponse(user=UserOut.model_validate(user) if user else None)


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


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Email a single-use reset link. The response is identical whether or not
    the account exists, and the email is sent after the response, so neither
    the body nor the timing reveals which emails are registered."""
    enforce_auth_rate_limit(request, "forgot")
    email = payload.email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is not None and not user.is_demo:
        db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == user.id))
        token = secrets.token_urlsafe(32)
        db.add(
            PasswordResetToken(
                user_id=user.id,
                token_hash=_hash_reset_token(token),
                expires_at=utcnow() + timedelta(minutes=settings.password_reset_minutes),
            )
        )
        db.commit()
        link = f"{settings.public_app_url.rstrip('/')}/reset-password?token={token}"
        background_tasks.add_task(
            send_email,
            password_reset_email(user.email, user.name, link, settings.password_reset_minutes),
        )
    return MessageResponse(message=RESET_REQUESTED_MESSAGE)


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(
    payload: ResetPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> MessageResponse:
    enforce_auth_rate_limit(request, "reset")
    record = db.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == _hash_reset_token(payload.token)
        )
    )
    if record is None or record.used_at is not None or record.expires_at < utcnow():
        raise HTTPException(
            status_code=400,
            detail="This reset link is invalid or has expired.",
        )
    user = db.get(User, record.user_id)
    if user is None or user.is_demo:
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired.")
    user.password_hash = hash_password(payload.password)
    # Sign out every existing session, including any an attacker may hold.
    user.token_version += 1
    record.used_at = utcnow()
    db.execute(
        delete(PasswordResetToken).where(
            PasswordResetToken.user_id == user.id, PasswordResetToken.id != record.id
        )
    )
    db.commit()
    return MessageResponse(message="Password updated. Sign in with your new password.")


def _reject_demo(user: User, action: str) -> None:
    if user.is_demo:
        raise HTTPException(
            status_code=403,
            detail=f"The shared demo account can't {action}. Create your own account to do this.",
        )


@router.post("/change-password", response_model=AuthResponse)
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AuthResponse:
    """Change the password, sign out every other device, and keep this one signed in."""
    enforce_auth_rate_limit(request, "change-password")
    _reject_demo(user, "change its password")
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Your current password is incorrect")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="Choose a password different from the current one")
    user.password_hash = hash_password(payload.new_password)
    user.token_version += 1
    db.commit()
    db.refresh(user)
    return _issue_session(user, response)


@router.post("/delete-account", response_model=MessageResponse)
def delete_account(
    payload: DeleteAccountRequest,
    request: Request,
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Permanently delete the account and every record it owns.

    All user-owned tables cascade on delete, so this removes transactions,
    budgets, goals, bills, notifications, AI conversations, research runs,
    and reset tokens in one transaction.
    """
    enforce_auth_rate_limit(request, "delete-account")
    _reject_demo(user, "be deleted")
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Your password is incorrect")
    db.delete(user)
    db.commit()
    clear_session_cookie(response)
    return MessageResponse(message="Your account and all of its data have been deleted.")
