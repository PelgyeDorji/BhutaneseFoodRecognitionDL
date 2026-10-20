from typing import Annotated

import jwt
from fastapi import Cookie, Depends, Header, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import create_access_token, decode_access_token
from app.db.session import get_db
from app.models import User

AUTH_COOKIE = "bfr_session"

DbSession = Annotated[Session, Depends(get_db)]

_UNAUTHORISED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Please sign in again.",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    db: DbSession,
    session_cookie: Annotated[str | None, Cookie(alias=AUTH_COOKIE)] = None,
    authorization: Annotated[str | None, Header()] = None,
) -> User:
    token = session_cookie
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:]
    if not token:
        raise _UNAUTHORISED
    try:
        claims = decode_access_token(token)
        user_id = int(claims["sub"])
    except (jwt.PyJWTError, ValueError, KeyError):
        raise _UNAUTHORISED from None
    user = db.get(User, user_id)
    if user is None or user.token_version != claims["ver"]:
        raise _UNAUTHORISED
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_admin(user: CurrentUser) -> User:
    if not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admins only.")
    return user


AdminUser = Annotated[User, Depends(require_admin)]


def start_session(response: Response, user: User) -> int:
    """Issue a fresh token in an httpOnly cookie; return its lifetime in seconds."""
    token, lifetime = create_access_token(user.id, user.token_version)
    response.set_cookie(
        AUTH_COOKIE,
        token,
        max_age=lifetime,
        httponly=True,
        secure=get_settings().cookie_secure,
        samesite="strict",
        path="/api",
    )
    return lifetime


def end_session(response: Response) -> None:
    response.delete_cookie(AUTH_COOKIE, path="/api", samesite="strict")
