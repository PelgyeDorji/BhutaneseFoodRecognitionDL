from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.api.routes.predictions import to_out
from app.models import Feedback, Prediction
from app.schemas import FeedbackIn, PredictionOut

router = APIRouter(tags=["feedback"])


@router.post("/feedback", response_model=PredictionOut)
def submit_feedback(body: FeedbackIn, user: CurrentUser, db: DbSession) -> PredictionOut:
    prediction = db.scalar(
        select(Prediction).where(Prediction.id == body.prediction_id, Prediction.user_id == user.id)
    )
    if prediction is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Prediction not found.")
    if not body.is_correct and body.correct_food is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Tell us which dish it was.")

    correct_food = None if body.is_correct else body.correct_food
    if prediction.feedback is None:
        prediction.feedback = Feedback(
            is_correct=body.is_correct, correct_food=correct_food, comment=body.comment
        )
    else:
        prediction.feedback.is_correct = body.is_correct
        prediction.feedback.correct_food = correct_food
        prediction.feedback.comment = body.comment
    db.commit()
    db.refresh(prediction)
    return to_out(prediction)
