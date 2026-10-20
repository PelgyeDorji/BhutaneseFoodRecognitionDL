"""Read-only views across every account, for admins only.

Admins see all users, every scan and every piece of feedback, and can export
the feedback as CSV for the retraining dataset. They cannot change or delete
other people's scans or answers from here.
"""

import csv
import io
import logging
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.api.deps import AdminUser, DbSession, require_admin
from app.api.routes.predictions import Answer, scan_filters, to_out
from app.models import Feedback, Prediction, User
from app.schemas import (
    AdminScanOut,
    AdminScansOut,
    AdminSummaryOut,
    AdminUserOut,
    AdminUsersOut,
    MixUp,
    Owner,
)
from app.services.dishes import DISH_BY_SLUG

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])
log = logging.getLogger("app.admin")


def _name(slug: str | None) -> str:
    if slug is None:
        return ""
    dish = DISH_BY_SLUG.get(slug)
    return dish["name"] if dish else slug


@router.get("/summary", response_model=AdminSummaryOut)
def summary(db: DbSession) -> AdminSummaryOut:
    users = db.scalar(select(func.count(User.id))) or 0
    scans = db.scalar(select(func.count(Prediction.id))) or 0
    answered, correct = db.execute(
        select(func.count(Feedback.id), func.count(Feedback.id).filter(Feedback.is_correct.is_(True)))
    ).one()
    mix_rows = db.execute(
        select(Prediction.predicted_food, Feedback.correct_food, func.count().label("n"))
        .join(Feedback, Feedback.prediction_id == Prediction.id)
        .where(Feedback.is_correct.is_(False), Feedback.correct_food.is_not(None))
        .group_by(Prediction.predicted_food, Feedback.correct_food)
        .order_by(func.count().desc())
        .limit(5)
    ).all()
    return AdminSummaryOut(
        users=users,
        scans=scans,
        answered=answered,
        correct=correct,
        accuracy=(correct / answered) if answered else None,
        mix_ups=[
            MixUp(said=said, said_name=_name(said), was=was, was_name=_name(was), count=n)
            for said, was, n in mix_rows
        ],
    )


@router.get("/users", response_model=AdminUsersOut)
def users(
    db: DbSession,
    q: Annotated[str | None, Query(max_length=100)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AdminUsersOut:
    where = []
    if q and q.strip():
        # Escape LIKE wildcards so a search for "%" or "_" matches them literally.
        term = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        where.append(or_(User.name.ilike(f"%{term}%", escape="\\"), User.email.ilike(f"%{term}%", escape="\\")))

    scan_counts = (
        select(
            Prediction.user_id.label("user_id"),
            func.count(Prediction.id).label("scans"),
            func.max(Prediction.created_at).label("last_scan_at"),
        )
        .group_by(Prediction.user_id)
        .subquery()
    )
    answer_counts = (
        select(
            Prediction.user_id.label("user_id"),
            func.count(Feedback.id).label("answered"),
            func.count(Feedback.id).filter(Feedback.is_correct.is_(True)).label("correct"),
        )
        .join(Feedback, Feedback.prediction_id == Prediction.id)
        .group_by(Prediction.user_id)
        .subquery()
    )

    total = db.scalar(select(func.count()).select_from(User).where(*where)) or 0
    rows = db.execute(
        select(
            User,
            func.coalesce(scan_counts.c.scans, 0),
            func.coalesce(answer_counts.c.answered, 0),
            func.coalesce(answer_counts.c.correct, 0),
            scan_counts.c.last_scan_at,
        )
        .outerjoin(scan_counts, scan_counts.c.user_id == User.id)
        .outerjoin(answer_counts, answer_counts.c.user_id == User.id)
        .where(*where)
        .order_by(User.created_at.desc(), User.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()

    return AdminUsersOut(
        items=[
            AdminUserOut(
                id=user.id,
                name=user.name,
                email=user.email,
                is_admin=user.is_admin,
                created_at=user.created_at,
                scans=scans,
                answered=answered,
                correct=correct,
                last_scan_at=last_scan_at,
            )
            for user, scans, answered, correct, last_scan_at in rows
        ],
        total=total,
    )


@router.get("/scans", response_model=AdminScansOut)
def scans(
    db: DbSession,
    limit: Annotated[int, Query(ge=1, le=100)] = 24,
    offset: Annotated[int, Query(ge=0)] = 0,
    user_id: int | None = None,
    dish: str | None = None,
    answer: Answer | None = None,
) -> AdminScansOut:
    where = scan_filters(dish, answer)
    if user_id is not None:
        where.append(Prediction.user_id == user_id)
    total = db.scalar(select(func.count()).select_from(Prediction).where(*where)) or 0
    rows = db.scalars(
        select(Prediction)
        .where(*where)
        .options(selectinload(Prediction.feedback), selectinload(Prediction.user))
        .order_by(Prediction.created_at.desc(), Prediction.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return AdminScansOut(
        items=[
            AdminScanOut(
                **to_out(p).model_dump(),
                user=Owner(id=p.user.id, name=p.user.name, email=p.user.email),
            )
            for p in rows
        ],
        total=total,
    )


def _csv_cell(value: object) -> str:
    """Neutralise spreadsheet formulas: a comment like =HYPERLINK(...) must stay text in Excel."""
    text = "" if value is None else str(value)
    return f"'{text}" if text[:1] in ("=", "+", "-", "@", "\t", "\r") else text


@router.get("/feedback.csv")
def feedback_csv(db: DbSession, admin: AdminUser) -> StreamingResponse:
    rows = db.execute(
        select(Prediction, Feedback, User)
        .join(Feedback, Feedback.prediction_id == Prediction.id)
        .join(User, User.id == Prediction.user_id)
        .order_by(Feedback.created_at)
    ).all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        ["prediction_id", "image_path", "predicted", "confidence", "model", "is_correct", "actual", "comment",
         "user_email", "scanned_at", "answered_at"]
    )
    for prediction, feedback, user in rows:
        writer.writerow(
            [
                prediction.id,
                prediction.image_path,
                prediction.predicted_food,
                f"{prediction.confidence:.4f}",
                prediction.model_used,
                "yes" if feedback.is_correct else "no",
                prediction.predicted_food if feedback.is_correct else (feedback.correct_food or ""),
                _csv_cell(feedback.comment),
                _csv_cell(user.email),
                prediction.created_at.isoformat(),
                feedback.created_at.isoformat(),
            ]
        )

    log.info("feedback export by admin user_id=%s rows=%s", admin.id, len(rows))
    stamp = datetime.now(UTC).strftime("%Y%m%d")
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="druklens-feedback-{stamp}.csv"'},
    )
