from typing import Annotated, Literal

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import ColumnElement, func, select
from sqlalchemy.orm import selectinload
from starlette.concurrency import run_in_threadpool

from app.api.deps import CurrentUser, DbSession
from app.core.config import get_settings
from app.models import Feedback, Prediction
from app.schemas import FeedbackOut, GuessOut, HistoryOut, PredictionOut, PredictResultOut
from app.services.dishes import DISH_BY_SLUG, DISH_SLUGS
from app.services.images import (
    ImageRejected,
    delete_image,
    load_upload,
    resolve_image,
    save_image,
    thumb_name,
)
from app.services.predictor import get_predictor

router = APIRouter(tags=["predictions"])


def _dish_name(slug: str) -> str:
    dish = DISH_BY_SLUG.get(slug)
    return dish["name"] if dish else slug.replace("_", " ").title()


def to_out(prediction: Prediction) -> PredictionOut:
    return PredictionOut(
        id=prediction.id,
        predicted_food=prediction.predicted_food,
        predicted_name=_dish_name(prediction.predicted_food),
        confidence=prediction.confidence,
        model_used=prediction.model_used,
        is_placeholder=prediction.model_used.startswith("placeholder"),
        is_confident=prediction.confidence >= get_settings().confidence_threshold,
        image_url=f"/api/predictions/{prediction.id}/image",
        thumb_url=f"/api/predictions/{prediction.id}/image?size=thumb",
        created_at=prediction.created_at,
        feedback=FeedbackOut.model_validate(prediction.feedback) if prediction.feedback else None,
    )


async def _read_capped(upload: UploadFile, limit: int) -> bytes:
    data = await upload.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(
            status.HTTP_413_CONTENT_TOO_LARGE,
            f"Photos can be at most {get_settings().max_upload_mb} MB.",
        )
    return data


@router.post("/predict", response_model=PredictResultOut, status_code=status.HTTP_201_CREATED)
async def predict(
    user: CurrentUser, db: DbSession, file: Annotated[UploadFile, File()]
) -> PredictResultOut:
    data = await _read_capped(file, get_settings().max_upload_bytes)
    try:
        image = await run_in_threadpool(load_upload, data)
    except ImageRejected as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from None

    predictor = get_predictor()
    guesses = await run_in_threadpool(predictor.predict, image)
    image_path = await run_in_threadpool(save_image, image)

    best = guesses[0]
    prediction = Prediction(
        user_id=user.id,
        image_path=image_path,
        predicted_food=best.slug,
        confidence=round(best.confidence, 4),
        model_used=predictor.name,
    )
    db.add(prediction)
    db.commit()
    db.refresh(prediction)

    top = [GuessOut(slug=g.slug, name=_dish_name(g.slug), confidence=round(g.confidence, 4)) for g in guesses]
    return PredictResultOut(**to_out(prediction).model_dump(), top=top)


Answer = Literal["none", "answered", "correct", "wrong"]


def scan_filters(dish: str | None, answer: Answer | None) -> list[ColumnElement[bool]]:
    """WHERE clauses for the dish and "your answer" filters, shared with the admin views."""
    where: list[ColumnElement[bool]] = []
    if dish:
        if dish not in DISH_SLUGS:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown dish.")
        where.append(Prediction.predicted_food == dish)
    if answer == "none":
        where.append(~Prediction.feedback.has())
    elif answer == "answered":
        where.append(Prediction.feedback.has())
    elif answer is not None:
        where.append(Prediction.feedback.has(Feedback.is_correct.is_(answer == "correct")))
    return where


@router.get("/history", response_model=HistoryOut)
def history(
    user: CurrentUser,
    db: DbSession,
    limit: Annotated[int, Query(ge=1, le=100)] = 24,
    offset: Annotated[int, Query(ge=0)] = 0,
    dish: str | None = None,
    answer: Answer | None = None,
) -> HistoryOut:
    where = [Prediction.user_id == user.id, *scan_filters(dish, answer)]
    total = db.scalar(select(func.count()).select_from(Prediction).where(*where)) or 0
    rows = db.scalars(
        select(Prediction)
        .where(*where)
        .options(selectinload(Prediction.feedback))
        .order_by(Prediction.created_at.desc(), Prediction.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return HistoryOut(items=[to_out(p) for p in rows], total=total)


def _owned(db: DbSession, user_id: int, prediction_id: int) -> Prediction:
    prediction = db.scalar(
        select(Prediction).where(Prediction.id == prediction_id, Prediction.user_id == user_id)
    )
    if prediction is None:
        # 404 rather than 403 so ids belonging to others are not confirmed to exist.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Prediction not found.")
    return prediction


@router.get("/predictions/{prediction_id}/image", include_in_schema=False)
def prediction_image(
    prediction_id: int, user: CurrentUser, db: DbSession, size: Literal["full", "thumb"] = "full"
) -> FileResponse:
    if user.is_admin:
        prediction = db.get(Prediction, prediction_id)
        if prediction is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Prediction not found.")
    else:
        prediction = _owned(db, user.id, prediction_id)
    path = None
    if size == "thumb":
        path = resolve_image(thumb_name(prediction.image_path))
    path = path or resolve_image(prediction.image_path)  # scans saved before thumbnails existed
    if path is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Image not found.")
    return FileResponse(path, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=3600"})


@router.delete("/history/{prediction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_prediction(prediction_id: int, user: CurrentUser, db: DbSession) -> None:
    prediction = _owned(db, user.id, prediction_id)
    image_path = prediction.image_path
    db.delete(prediction)
    db.commit()
    delete_image(image_path)
