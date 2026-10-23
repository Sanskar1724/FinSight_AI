from __future__ import annotations

import csv
import io
import json
from datetime import date

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.base import get_db
from app.models import ResearchCase, ResearchResponse, ResearchRun, User
from app.schemas import (
    MessageResponse,
    ResearchCaseOut,
    ResearchExport,
    ResearchResponseOut,
    ResearchRunDetail,
    ResearchRunOut,
    ResearchRunRequest,
    ResearchScoreOut,
)
from app.services.ai_service import ai_status
from app.services.research import execute_research_run, run_to_dict

router = APIRouter(prefix="/research", tags=["research lab"])


def _response_out(response: ResearchResponse) -> ResearchResponseOut:
    try:
        evidence = json.loads(response.evidence_json) if response.evidence_json else []
    except json.JSONDecodeError:
        evidence = []
    try:
        retrieval = json.loads(response.retrieval_json) if response.retrieval_json else []
    except json.JSONDecodeError:
        retrieval = []
    return ResearchResponseOut(
        id=response.id,
        case_id=response.case_id,
        mode=response.mode,
        question=response.question,
        response=response.response,
        evidence=evidence,
        retrieval=retrieval,
        scores=ResearchScoreOut(
            correctness=response.score_correctness,
            relevance=response.score_relevance,
            grounding=response.score_grounding,
            unsupported=response.score_unsupported,
            usefulness=response.score_usefulness,
            total=response.total_score,
        ),
        failure_notes=response.failure_notes,
    )


@router.get("/cases", response_model=list[ResearchCaseOut])
def list_cases(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[ResearchCaseOut]:
    cases = db.scalars(select(ResearchCase).order_by(ResearchCase.id)).all()
    return [ResearchCaseOut.model_validate(case) for case in cases]


@router.post("/runs", response_model=ResearchRunOut, status_code=status.HTTP_202_ACCEPTED)
def create_run(
    payload: ResearchRunRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ResearchRunOut:
    all_cases = db.scalars(select(ResearchCase).order_by(ResearchCase.id)).all()
    if not all_cases:
        raise HTTPException(status_code=422, detail="No research cases are configured")
    selected = all_cases
    if payload.case_ids:
        requested = set(payload.case_ids)
        selected = [case for case in all_cases if case.id in requested]
        if not selected:
            raise HTTPException(status_code=422, detail="None of the requested cases exist")
    if payload.limit:
        selected = selected[: payload.limit]
    ai = ai_status()
    run = ResearchRun(
        user_id=user.id,
        status="queued",
        provider=ai["provider"],
        model_id=ai["model"],
        prompt_version=settings.research_prompt_version,
        rubric_version="rubric-v1",
        total_cases=len(selected),
        case_ids_json=json.dumps([case.id for case in selected]),
        notes=(
            "Automatic run compares baseline (no personal context) with grounded "
            "(calculated facts + knowledge retrieval). See rubric in README."
        ),
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    background_tasks.add_task(execute_research_run, run.id)
    responses: list[ResearchResponse] = []
    return ResearchRunOut(**run_to_dict(run, responses))


@router.get("/runs", response_model=list[ResearchRunOut])
def list_runs(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[ResearchRunOut]:
    runs = db.scalars(
        select(ResearchRun)
        .where(ResearchRun.user_id == user.id)
        .order_by(ResearchRun.started_at.desc())
        .limit(30)
    ).all()
    result = []
    for run in runs:
        responses = db.scalars(
            select(ResearchResponse).where(ResearchResponse.run_id == run.id)
        ).all()
        result.append(ResearchRunOut(**run_to_dict(run, list(responses))))
    return result


def _owned_run(db: Session, user: User, run_id: int) -> ResearchRun:
    run = db.scalar(
        select(ResearchRun).where(ResearchRun.id == run_id, ResearchRun.user_id == user.id)
    )
    if run is None:
        raise HTTPException(status_code=404, detail="Research run not found")
    return run


@router.get("/runs/{run_id}", response_model=ResearchRunDetail)
def get_run(
    run_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ResearchRunDetail:
    run = _owned_run(db, user, run_id)
    responses = db.scalars(
        select(ResearchResponse)
        .where(ResearchResponse.run_id == run.id)
        .order_by(ResearchResponse.case_id, ResearchResponse.mode)
    ).all()
    cases = db.scalars(select(ResearchCase).order_by(ResearchCase.id)).all()
    base = run_to_dict(run, list(responses))
    return ResearchRunDetail(
        **base,
        responses=[_response_out(response) for response in responses],
        case_lookup={case.slug: ResearchCaseOut.model_validate(case) for case in cases},
    )


@router.get("/runs/{run_id}/export")
def export_run(
    run_id: int,
    format: str = Query(default="json", pattern="^(json|csv)$"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    run = _owned_run(db, user, run_id)
    responses = db.scalars(
        select(ResearchResponse)
        .where(ResearchResponse.run_id == run.id)
        .order_by(ResearchResponse.case_id, ResearchResponse.mode)
    ).all()
    cases = {case.id: case for case in db.scalars(select(ResearchCase)).all()}
    if format == "json":
        payload = {
            "run": {
                **run_to_dict(run, list(responses)),
                "started_at": run.started_at.isoformat(),
                "finished_at": run.finished_at.isoformat() if run.finished_at else None,
            },
            "responses": [
                {
                    "id": response.id,
                    "case_id": response.case_id,
                    "case_slug": cases[response.case_id].slug if response.case_id in cases else None,
                    "mode": response.mode,
                    "question": response.question,
                    "response": response.response,
                    "evidence": json.loads(response.evidence_json) if response.evidence_json else [],
                    "retrieval": json.loads(response.retrieval_json) if response.retrieval_json else [],
                    "scores": {
                        "correctness": response.score_correctness,
                        "relevance": response.score_relevance,
                        "grounding": response.score_grounding,
                        "unsupported": response.score_unsupported,
                        "usefulness": response.score_usefulness,
                        "total": response.total_score,
                    },
                    "failure_notes": response.failure_notes,
                }
                for response in responses
            ],
            "note": "Automated rubric-v1 scores from a real executed run. Not fabricated.",
        }
        content = json.dumps(payload, ensure_ascii=False, indent=2)
        media_type = "application/json"
        filename = f"finsight-research-run-{run.id}.json"
    else:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "run_id",
                "case_slug",
                "mode",
                "question",
                "response",
                "correctness",
                "relevance",
                "grounding",
                "unsupported",
                "usefulness",
                "total",
                "failure_notes",
            ]
        )
        for response in responses:
            case = cases.get(response.case_id)
            writer.writerow(
                [
                    run.id,
                    case.slug if case else "",
                    response.mode,
                    response.question,
                    response.response,
                    response.score_correctness,
                    response.score_relevance,
                    response.score_grounding,
                    response.score_unsupported,
                    response.score_usefulness,
                    response.total_score,
                    response.failure_notes or "",
                ]
            )
        content = "\ufeff" + output.getvalue()
        media_type = "text/csv; charset=utf-8"
        filename = f"finsight-research-run-{run.id}.csv"
    return StreamingResponse(
        iter([content]),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/runs/{run_id}", response_model=MessageResponse)
def delete_run(
    run_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    run = _owned_run(db, user, run_id)
    db.delete(run)
    db.commit()
    return MessageResponse(message="Research run deleted")
