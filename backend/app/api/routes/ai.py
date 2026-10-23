from __future__ import annotations

import json
import threading
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.base import get_db, utcnow
from app.models import AiMessage, AiSession, User
from app.schemas import (
    AIStatus,
    ChatMessageOut,
    ChatRequest,
    ChatResponse,
    ChatSource,
    EvidenceItem,
    MessageResponse,
    SessionDetail,
    SessionOut,
)
from app.services.ai_service import ai_status, answer_question

router = APIRouter(prefix="/ai", tags=["ai assistant"])

_rate_lock = threading.Lock()
_request_times: dict[int, list[datetime]] = {}

SUGGESTIONS = [
    "How much did I spend on Food & Dining this month?",
    "Which of my budgets are at risk of going over?",
    "Am I on track for my New Laptop goal?",
    "Where is most of my money going this month?",
    "Did I make any unusually large purchases recently?",
    "What recurring payments have you detected?",
    "If I cut food spending by 10%, how much could I save over six months?",
    "Explain how an emergency fund should work.",
]


def _check_rate_limit(user_id: int) -> None:
    now = utcnow()
    cutoff = now - timedelta(hours=1)
    with _rate_lock:
        existing = [timestamp for timestamp in _request_times.get(user_id, []) if timestamp > cutoff]
        if len(existing) >= settings.ai_rate_limit_per_hour:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="AI request limit reached. Please try again later.",
            )
        existing.append(now)
        _request_times[user_id] = existing


def _session_out(session: AiSession) -> SessionOut:
    preview = None
    if session.messages:
        assistant = next(
            (message for message in reversed(session.messages) if message.role == "assistant"), None
        )
        preview_source = assistant.content if assistant else session.messages[-1].content
        preview = preview_source[:140]
    return SessionOut(
        id=session.id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
        preview=preview,
    )


@router.get("/status", response_model=AIStatus)
def get_ai_status(user: User = Depends(get_current_user)) -> AIStatus:
    status_payload = ai_status()
    return AIStatus(**status_payload)


@router.get("/suggestions", response_model=list[str])
def suggestions(user: User = Depends(get_current_user)) -> list[str]:
    return SUGGESTIONS


@router.post("/chat", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatResponse:
    _check_rate_limit(user.id)
    session: AiSession | None = None
    if payload.session_id is not None:
        session = db.scalar(
            select(AiSession)
            .options(selectinload(AiSession.messages))
            .where(AiSession.id == payload.session_id, AiSession.user_id == user.id)
        )
        if session is None:
            raise HTTPException(status_code=404, detail="Conversation not found")
    if session is None:
        title = payload.message.strip()[:80]
        session = AiSession(user_id=user.id, title=title or "New conversation")
        db.add(session)
        db.flush()

    user_message = AiMessage(
        session_id=session.id,
        role="user",
        content=payload.message.strip(),
    )
    db.add(user_message)
    db.flush()

    context, generated = answer_question(db, user, payload.message, mode="grounded")
    assistant_message = AiMessage(
        session_id=session.id,
        role="assistant",
        content=generated.text,
        evidence_json=json.dumps(context.evidence, ensure_ascii=False),
        sources_json=json.dumps(context.sources, ensure_ascii=False),
        model=generated.model,
        mode=generated.mode,
        provider_fallback=generated.fallback,
    )
    db.add(assistant_message)
    session.updated_at = utcnow()
    db.commit()
    db.refresh(assistant_message)

    limitations = list(generated.limitations)
    if generated.error:
        limitations.append("The configured AI provider was unavailable; a deterministic grounded answer is shown.")
    return ChatResponse(
        session_id=session.id,
        message_id=assistant_message.id,
        answer=generated.text,
        evidence=[EvidenceItem(**item) for item in context.evidence],
        sources=[ChatSource(**item) for item in context.sources],
        provider=generated.provider,
        model=generated.model,
        mode=generated.mode,
        provider_fallback=generated.fallback,
        limitations=limitations,
    )


@router.get("/sessions", response_model=list[SessionOut])
def list_sessions(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[SessionOut]:
    sessions = db.scalars(
        select(AiSession)
        .options(selectinload(AiSession.messages))
        .where(AiSession.user_id == user.id)
        .order_by(AiSession.updated_at.desc())
        .limit(50)
    ).all()
    return [_session_out(session) for session in sessions]


@router.get("/sessions/{session_id}", response_model=SessionDetail)
def get_session(
    session_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SessionDetail:
    session = db.scalar(
        select(AiSession)
        .options(selectinload(AiSession.messages))
        .where(AiSession.id == session_id, AiSession.user_id == user.id)
    )
    if session is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return SessionDetail(
        id=session.id,
        title=session.title,
        messages=[ChatMessageOut.model_validate(message) for message in session.messages],
    )


@router.delete("/sessions/{session_id}", response_model=MessageResponse)
def delete_session(
    session_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    session = db.scalar(
        select(AiSession).where(AiSession.id == session_id, AiSession.user_id == user.id)
    )
    if session is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(session)
    db.commit()
    return MessageResponse(message="Conversation deleted")
