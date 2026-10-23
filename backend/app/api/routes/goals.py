from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.db.base import get_db, utcnow
from app.models import GoalContribution, SavingsGoal, User
from app.schemas import (
    ContributionCreate,
    ContributionOut,
    GoalCreate,
    GoalListResponse,
    GoalOut,
    GoalUpdate,
    MessageResponse,
)
from app.services.finance import q
from app.services.ledger import goal_out, goals_for_user

router = APIRouter(prefix="/goals", tags=["savings goals"])


def _load_goal(db: Session, user_id: int, goal_id: int) -> SavingsGoal:
    goal = db.scalar(
        select(SavingsGoal)
        .options(selectinload(SavingsGoal.contributions))
        .execution_options(populate_existing=True)
        .where(SavingsGoal.id == goal_id, SavingsGoal.user_id == user_id)
    )
    if goal is None:
        raise HTTPException(status_code=404, detail="Savings goal not found")
    return goal


def _list(db: Session, user: User) -> GoalListResponse:
    items = goals_for_user(db, user.id)
    total_target = q(sum((item.target_amount for item in items), q(0)))
    total_saved = q(sum((item.saved_amount for item in items), q(0)))
    overall = float(q(total_saved / total_target * 100)) if total_target > 0 else 0.0
    return GoalListResponse(
        items=items,
        total_target=total_target,
        total_saved=total_saved,
        overall_progress=min(100.0, overall),
    )


@router.get("", response_model=GoalListResponse)
def list_goals(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> GoalListResponse:
    return _list(db, user)


@router.post("", response_model=GoalOut, status_code=status.HTTP_201_CREATED)
def create_goal(
    payload: GoalCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GoalOut:
    goal = SavingsGoal(
        user_id=user.id,
        name=payload.name.strip(),
        target_amount=q(payload.target_amount),
        target_date=payload.target_date,
    )
    db.add(goal)
    db.commit()
    goal = _load_goal(db, user.id, goal.id)
    return goal_out(goal)


@router.patch("/{goal_id}", response_model=GoalOut)
def update_goal(
    goal_id: int,
    payload: GoalUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GoalOut:
    goal = _load_goal(db, user.id, goal_id)
    updates = payload.model_dump(exclude_unset=True)
    if "target_amount" in updates and updates["target_amount"] is not None:
        updates["target_amount"] = q(updates["target_amount"])
    if "name" in updates and updates["name"] is not None:
        name = updates["name"].strip()
        if not name:
            raise HTTPException(status_code=422, detail="Goal name cannot be empty")
        updates["name"] = name
    for field, value in updates.items():
        setattr(goal, field, value)
    db.commit()
    db.refresh(goal)
    return goal_out(goal)


@router.delete("/{goal_id}", response_model=MessageResponse)
def delete_goal(
    goal_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    goal = db.scalar(
        select(SavingsGoal).where(
            SavingsGoal.id == goal_id, SavingsGoal.user_id == user.id
        )
    )
    if goal is None:
        raise HTTPException(status_code=404, detail="Savings goal not found")
    db.delete(goal)
    db.commit()
    return MessageResponse(message="Savings goal deleted")


@router.post("/{goal_id}/contributions", response_model=GoalOut, status_code=status.HTTP_201_CREATED)
def add_contribution(
    goal_id: int,
    payload: ContributionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GoalOut:
    goal = _load_goal(db, user.id, goal_id)
    if payload.contributed_on > date.today():
        raise HTTPException(status_code=422, detail="Contributions cannot be dated in the future")
    contribution = GoalContribution(
        goal_id=goal.id,
        user_id=user.id,
        amount=q(payload.amount),
        contributed_on=payload.contributed_on,
        note=payload.note.strip() if payload.note else None,
    )
    db.add(contribution)
    goal.updated_at = utcnow()
    db.commit()
    goal = _load_goal(db, user.id, goal_id)
    return goal_out(goal)


@router.delete("/{goal_id}/contributions/{contribution_id}", response_model=GoalOut)
def delete_contribution(
    goal_id: int,
    contribution_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GoalOut:
    goal = _load_goal(db, user.id, goal_id)
    contribution = db.scalar(
        select(GoalContribution).where(
            GoalContribution.id == contribution_id,
            GoalContribution.goal_id == goal.id,
            GoalContribution.user_id == user.id,
        )
    )
    if contribution is None:
        raise HTTPException(status_code=404, detail="Contribution not found")
    db.delete(contribution)
    db.commit()
    goal = _load_goal(db, user.id, goal_id)
    return goal_out(goal)
