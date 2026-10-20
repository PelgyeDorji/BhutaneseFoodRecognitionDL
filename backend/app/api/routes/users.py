from fastapi import APIRouter, HTTPException, Response, status

from app.api.deps import CurrentUser, DbSession, start_session
from app.core.security import hash_password, verify_password
from app.schemas import PasswordChangeIn, ProfileIn, SessionOut, UserOut

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)


@router.patch("/me", response_model=UserOut)
def update_me(body: ProfileIn, user: CurrentUser, db: DbSession) -> UserOut:
    user.name = body.name
    db.commit()
    return UserOut.model_validate(user)


@router.post("/me/password", response_model=SessionOut)
def change_password(
    body: PasswordChangeIn, user: CurrentUser, response: Response, db: DbSession
) -> SessionOut:
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your current password is incorrect.")
    user.password_hash = hash_password(body.new_password)
    # Sign out every other session, then give this browser a fresh token.
    user.token_version += 1
    db.commit()
    lifetime = start_session(response, user)
    return SessionOut(user=UserOut.model_validate(user), expires_in=lifetime)
