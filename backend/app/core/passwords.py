"""Password policy (ASVS 5.0 6.2): length only, no composition rules, block common ones."""

from app.core.security import BCRYPT_MAX_BYTES

MIN_LENGTH = 8

# A short blocklist of the most common passwords. Swap for a full top-10k list
# (e.g. SecLists) before any real deployment.
COMMON_PASSWORDS = frozenset(
    """
    123456 123456789 12345678 password qwerty123 qwerty 1234567 111111 1234567890
    123123 abc123 1234 password1 iloveyou 1q2w3e4r 000000 qwerty12 dragon sunshine
    princess letmein 654321 monkey 27653 1qaz2wsx 123321 qwertyuiop superman asdfghjkl
    football baseball welcome admin admin123 login passw0rd master hello123 freedom
    whatever trustno1 starwars 987654321 11111111 22222222 88888888 00000000 password123
    changeme bhutan bhutan123 druk1234 thimphu123 momo1234 emadatshi
    """.split()
)


def password_problem(password: str) -> str | None:
    if len(password) < MIN_LENGTH:
        return f"Use at least {MIN_LENGTH} characters."
    if len(password.encode("utf-8")) > BCRYPT_MAX_BYTES:
        return "Use at most 72 bytes (about 72 characters)."
    if password.lower() in COMMON_PASSWORDS:
        return "That password is too common. Pick something less guessable."
    return None
