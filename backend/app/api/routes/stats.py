from collections import Counter
from datetime import UTC, date, datetime, time, timedelta
from typing import Annotated
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.api.deps import CurrentUser, DbSession
from app.core.config import get_settings
from app.models import Feedback, Prediction
from app.schemas import DayCount, DishCount, MixUp, StatsOut
from app.services.dishes import DISH_BY_SLUG

router = APIRouter(tags=["stats"])


def _zone(name: str) -> ZoneInfo:
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")


def _name(slug: str) -> str:
    dish = DISH_BY_SLUG.get(slug)
    return dish["name"] if dish else slug


@router.get("/stats", response_model=StatsOut)
def stats(user: CurrentUser, db: DbSession, tz: Annotated[str, Query(max_length=64)] = "UTC") -> StatsOut:
    mine = Prediction.user_id == user.id

    total, avg_conf = db.execute(
        select(func.count(Prediction.id), func.avg(Prediction.confidence)).where(mine)
    ).one()
    with_feedback, correct = db.execute(
        select(
            func.count(Feedback.id),
            func.count(Feedback.id).filter(Feedback.is_correct.is_(True)),
        )
        .join(Prediction, Feedback.prediction_id == Prediction.id)
        .where(mine)
    ).one()

    dishes_seen = db.scalar(select(func.count(func.distinct(Prediction.predicted_food))).where(mine)) or 0

    top_rows = db.execute(
        select(Prediction.predicted_food, func.count().label("n"))
        .where(mine)
        .group_by(Prediction.predicted_food)
        .order_by(func.count().desc(), Prediction.predicted_food)
        .limit(5)
    ).all()

    # What the model said against what the person says it was: the failure cases.
    mix_rows = db.execute(
        select(Prediction.predicted_food, Feedback.correct_food, func.count().label("n"))
        .join(Feedback, Feedback.prediction_id == Prediction.id)
        .where(mine, Feedback.is_correct.is_(False), Feedback.correct_food.is_not(None))
        .group_by(Prediction.predicted_food, Feedback.correct_food)
        .order_by(func.count().desc())
        .limit(5)
    ).all()

    # Days are the viewer's own calendar days, not UTC ones (Bhutan is UTC+6).
    zone = _zone(tz)
    today = datetime.now(zone).date()
    start = today - timedelta(days=13)
    since = datetime.combine(start, time.min, tzinfo=zone)
    per_day: Counter[date] = Counter()
    for (created,) in db.execute(select(Prediction.created_at).where(mine, Prediction.created_at >= since)):
        aware = created if created.tzinfo else created.replace(tzinfo=UTC)
        per_day[aware.astimezone(zone).date()] += 1

    return StatsOut(
        total_scans=total,
        with_feedback=with_feedback,
        correct=correct,
        accuracy=(correct / with_feedback) if with_feedback else None,
        avg_confidence=float(avg_conf) if avg_conf is not None else None,
        dishes_seen=dishes_seen,
        top_dishes=[DishCount(slug=slug, name=_name(slug), count=n) for slug, n in top_rows],
        mix_ups=[
            MixUp(said=said, said_name=_name(said), was=was, was_name=_name(was), count=n)
            for said, was, n in mix_rows
        ],
        last_14_days=[
            DayCount(day=(start + timedelta(days=i)).isoformat(), count=per_day.get(start + timedelta(days=i), 0))
            for i in range(14)
        ],
        confidence_threshold=get_settings().confidence_threshold,
    )
