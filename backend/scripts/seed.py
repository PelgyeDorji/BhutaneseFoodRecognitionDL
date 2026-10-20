"""Create (or reset) the demo user and the admin from SEED_USER_* and SEED_ADMIN_* in .env.

    python -m scripts.seed

Running it again resets each account's name and password to the values in .env
and signs out its existing sessions. The admin role can only be granted here
(or directly in the database), never through the API.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.passwords import password_problem
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import User


def upsert(db: Session, *, name: str, email: str, password: str, is_admin: bool, label: str) -> None:
    email = email.lower()
    if problem := password_problem(password):
        raise SystemExit(f"{label} password is not allowed: {problem}")

    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        db.add(User(name=name, email=email, password_hash=hash_password(password), is_admin=is_admin))
        action = "Created"
    else:
        user.name = name
        user.password_hash = hash_password(password)
        user.is_admin = is_admin
        user.token_version += 1
        action = "Reset"
    print(f"{action} {label.lower()} {email}.")


def main() -> None:
    settings = get_settings()
    accounts = [
        ("Demo user", settings.seed_user_name, settings.seed_user_email, settings.seed_user_password, False),
        ("Admin", settings.seed_admin_name, settings.seed_admin_email, settings.seed_admin_password, True),
    ]
    with SessionLocal() as db:
        for label, name, email, password, is_admin in accounts:
            if not email or not password:
                print(f"Skipped {label.lower()}: its email or password is not set in .env.")
                continue
            upsert(db, name=name, email=email, password=password, is_admin=is_admin, label=label)
        db.commit()
    print("Passwords are SEED_USER_PASSWORD and SEED_ADMIN_PASSWORD in .env.")


if __name__ == "__main__":
    main()
