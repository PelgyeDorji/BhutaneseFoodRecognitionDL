import logging

from fastapi import APIRouter, HTTPException, Request, Response, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession, end_session, start_session
from app.core.rate_limit import login_limiter, register_limiter
from app.core.security import hash_password, verify_password
from app.models import User
from app.schemas import LoginIn, RegisterIn, SessionOut, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])
log = logging.getLogger("app.auth")


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _too_many(wait: int) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=f"Too many attempts. Try again in {wait} seconds.",
        headers={"Retry-After": str(wait)},
    )


@router.post("/register", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, request: Request, response: Response, db: DbSession) -> SessionOut:
    if wait := register_limiter.hit(_client_ip(request)):
        raise _too_many(wait)
    if db.scalar(select(User.id).where(User.email == body.email)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")
    user = User(name=body.name, email=body.email, password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    log.info("register user_id=%s", user.id)
    lifetime = start_session(response, user)
    return SessionOut(user=UserOut.model_validate(user), expires_in=lifetime)


@router.post("/login", response_model=SessionOut)
def login(body: LoginIn, request: Request, response: Response, db: DbSession) -> SessionOut:
    key = f"{_client_ip(request)}|{body.email}"
    if wait := login_limiter.hit(key):
        log.warning("login throttled ip=%s", _client_ip(request))
        raise _too_many(wait)
    user = db.scalar(select(User).where(User.email == body.email))
    if not verify_password(body.password, user.password_hash if user else None) or user is None:
        log.info("login failed ip=%s", _client_ip(request))
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password.")
    login_limiter.reset(key)
    log.info("login ok user_id=%s", user.id)
    lifetime = start_session(response, user)
    return SessionOut(user=UserOut.model_validate(user), expires_in=lifetime)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(user: CurrentUser, response: Response, db: DbSession) -> None:
    # Revokes every token issued so far, not only this browser's.
    user.token_version += 1
    db.commit()
    end_session(response)
