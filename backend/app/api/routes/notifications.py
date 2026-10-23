from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.db.base import get_db, utcnow
from app.models import Notification, NotificationPreference, User
from app.schemas import (
    MessageResponse,
    NotificationGenerateResponse,
    NotificationListResponse,
    NotificationOut,
    PreferencesOut,
    PreferencesUpdate,
    UnreadCount,
)
from app.services.ledger import notification_out
from app.services.notifications import evaluate_notifications, get_or_create_preferences

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _available_condition():
    now = utcnow()
    return Notification.scheduled_for.is_(None) | (Notification.scheduled_for <= now)


@router.get("", response_model=NotificationListResponse)
def list_notifications(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    category: str | None = None,
    only_unread: bool = False,
    include_dismissed: bool = False,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationListResponse:
    conditions = [Notification.user_id == user.id]
    if not include_dismissed:
        conditions.append(Notification.dismissed_at.is_(None))
    conditions.append(_available_condition())
    if category:
        conditions.append(Notification.category == category)
    if only_unread:
        conditions.append(Notification.is_read.is_(False))
    total = int(db.scalar(select(func.count(Notification.id)).where(*conditions)) or 0)
    unread_conditions = [
        Notification.user_id == user.id,
        Notification.is_read.is_(False),
        Notification.dismissed_at.is_(None),
        _available_condition(),
    ]
    unread = int(
        db.scalar(select(func.count(Notification.id)).where(*unread_conditions)) or 0
    )
    rows = db.scalars(
        select(Notification)
        .options(selectinload(Notification.deliveries))
        .where(*conditions)
        .order_by(Notification.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    import math

    return NotificationListResponse(
        items=[notification_out(row) for row in rows],
        total=total,
        unread=unread,
        page=page,
        page_size=page_size,
        pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/unread-count", response_model=UnreadCount)
def unread_count(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> UnreadCount:
    count = db.scalar(
        select(func.count(Notification.id)).where(
            Notification.user_id == user.id,
            Notification.is_read.is_(False),
            Notification.dismissed_at.is_(None),
            _available_condition(),
        )
    )
    return UnreadCount(unread=int(count or 0))


@router.post("/read-all", response_model=MessageResponse)
def mark_all_read(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> MessageResponse:
    rows = db.scalars(
        select(Notification).where(
            Notification.user_id == user.id,
            Notification.is_read.is_(False),
            Notification.dismissed_at.is_(None),
        )
    ).all()
    for row in rows:
        row.is_read = True
    db.commit()
    return MessageResponse(message=f"Marked {len(rows)} notification(s) as read")


@router.post("/evaluate", response_model=NotificationGenerateResponse)
def evaluate(
    force: bool = Query(default=False),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationGenerateResponse:
    result = evaluate_notifications(db, user, force=force)
    return NotificationGenerateResponse(**result)


@router.get("/preferences", response_model=PreferencesOut)
def get_preferences(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> PreferencesOut:
    preference = get_or_create_preferences(db, user.id)
    db.commit()
    return PreferencesOut.model_validate(preference)


@router.put("/preferences", response_model=PreferencesOut)
def update_preferences(
    payload: PreferencesUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PreferencesOut:
    preference = get_or_create_preferences(db, user.id)
    updates = payload.model_dump(exclude_unset=True)
    warning = updates.get("warning_threshold", preference.warning_threshold)
    critical = updates.get("critical_threshold", preference.critical_threshold)
    if critical <= warning:
        raise HTTPException(
            status_code=422, detail="Critical threshold must be greater than warning threshold"
        )
    for field, value in updates.items():
        setattr(preference, field, value)
    preference.updated_at = utcnow()
    db.commit()
    db.refresh(preference)
    return PreferencesOut.model_validate(preference)


@router.post("/{notification_id}/read", response_model=NotificationOut)
def mark_read(
    notification_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationOut:
    notification = db.scalar(
        select(Notification)
        .options(selectinload(Notification.deliveries))
        .where(Notification.id == notification_id, Notification.user_id == user.id)
    )
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = True
    db.commit()
    return notification_out(notification)


@router.post("/{notification_id}/unread", response_model=NotificationOut)
def mark_unread(
    notification_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationOut:
    notification = db.scalar(
        select(Notification)
        .options(selectinload(Notification.deliveries))
        .where(Notification.id == notification_id, Notification.user_id == user.id)
    )
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = False
    db.commit()
    return notification_out(notification)


@router.delete("/{notification_id}", response_model=MessageResponse)
def dismiss_notification(
    notification_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    notification = db.scalar(
        select(Notification).where(
            Notification.id == notification_id, Notification.user_id == user.id
        )
    )
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.dismissed_at = utcnow()
    db.commit()
    return MessageResponse(message="Notification dismissed")
