from datetime import UTC, datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field, StringConstraints, field_validator

from app.core.passwords import password_problem
from app.services.dishes import DISH_SLUGS

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
Password = Annotated[str, Field(min_length=1, max_length=128)]
# SQLite hands back naive timestamps; every time leaves the API marked as UTC.
UtcDatetime = Annotated[datetime, AfterValidator(lambda d: d if d.tzinfo else d.replace(tzinfo=UTC))]


def _strong(password: str) -> str:
    problem = password_problem(password)
    if problem:
        raise ValueError(problem)
    return password


class RegisterIn(BaseModel):
    name: Name
    email: EmailStr
    password: Password

    @field_validator("email")
    @classmethod
    def lower_email(cls, value: str) -> str:
        return value.lower()

    @field_validator("password")
    @classmethod
    def strong_password(cls, value: str) -> str:
        return _strong(value)


class LoginIn(BaseModel):
    email: EmailStr
    password: Password

    @field_validator("email")
    @classmethod
    def lower_email(cls, value: str) -> str:
        return value.lower()


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    is_admin: bool
    created_at: UtcDatetime


class SessionOut(BaseModel):
    user: UserOut
    expires_in: int


class ProfileIn(BaseModel):
    name: Name


class PasswordChangeIn(BaseModel):
    current_password: Password
    new_password: Password

    @field_validator("new_password")
    @classmethod
    def strong_password(cls, value: str) -> str:
        return _strong(value)


class GuessOut(BaseModel):
    slug: str
    name: str
    confidence: float


class FeedbackOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    is_correct: bool
    correct_food: str | None
    comment: str | None
    created_at: UtcDatetime


class PredictionOut(BaseModel):
    id: int
    predicted_food: str
    predicted_name: str
    confidence: float
    model_used: str
    is_placeholder: bool
    is_confident: bool
    image_url: str
    thumb_url: str
    created_at: UtcDatetime
    feedback: FeedbackOut | None = None


class PredictResultOut(PredictionOut):
    top: list[GuessOut]


class HistoryOut(BaseModel):
    items: list[PredictionOut]
    total: int


class FeedbackIn(BaseModel):
    prediction_id: int
    is_correct: bool
    correct_food: str | None = None
    comment: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] | None = None

    @field_validator("correct_food")
    @classmethod
    def known_dish(cls, value: str | None) -> str | None:
        if value is not None and value not in DISH_SLUGS:
            raise ValueError("Pick one of the supported dishes.")
        return value


class DishCount(BaseModel):
    slug: str
    name: str
    count: int


class MixUp(BaseModel):
    said: str
    said_name: str
    was: str
    was_name: str
    count: int


class DayCount(BaseModel):
    day: str
    count: int


class StatsOut(BaseModel):
    total_scans: int
    with_feedback: int
    correct: int
    accuracy: float | None
    avg_confidence: float | None
    dishes_seen: int
    top_dishes: list[DishCount]
    mix_ups: list[MixUp]
    last_14_days: list[DayCount]
    confidence_threshold: float


# --- Admin views -------------------------------------------------------------


class Owner(BaseModel):
    id: int
    name: str
    email: str


class AdminScanOut(PredictionOut):
    user: Owner


class AdminScansOut(BaseModel):
    items: list[AdminScanOut]
    total: int


class AdminUserOut(BaseModel):
    id: int
    name: str
    email: str
    is_admin: bool
    created_at: UtcDatetime
    scans: int
    answered: int
    correct: int
    last_scan_at: UtcDatetime | None


class AdminUsersOut(BaseModel):
    items: list[AdminUserOut]
    total: int


class AdminSummaryOut(BaseModel):
    users: int
    scans: int
    answered: int
    correct: int
    accuracy: float | None
    mix_ups: list[MixUp]
