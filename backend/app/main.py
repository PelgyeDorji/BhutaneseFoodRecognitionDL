import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from app.api.deps import AUTH_COOKIE
from app.api.routes import admin, auth, dishes, feedback, predictions, stats, users
from app.core.config import get_settings
from app.services.predictor import get_predictor

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("app")

settings = get_settings()

app = FastAPI(
    title="Bhutanese Food Recognition API",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
)

UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
# Multipart overhead on top of the photo itself.
MAX_BODY_BYTES = settings.max_upload_bytes + 1024 * 1024


class GuardMiddleware(BaseHTTPMiddleware):
    """Body-size cap, CSRF check for cookie sessions, and security headers."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        length = request.headers.get("content-length")
        if length and length.isdigit() and int(length) > MAX_BODY_BYTES:
            return JSONResponse({"detail": "Request is too large."}, status_code=413)

        # A cookie rides along on any request the browser makes, so a state change
        # authenticated by it must carry a header a cross-site form cannot set.
        uses_cookie = AUTH_COOKIE in request.cookies and "authorization" not in request.headers
        if request.method in UNSAFE_METHODS and uses_cookie and request.headers.get("x-requested-with") != "fetch":
            return JSONResponse({"detail": "Missing request header."}, status_code=403)

        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "same-origin")
        if not request.url.path.startswith("/api/docs"):
            response.headers.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
        return response


app.add_middleware(GuardMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)


@app.exception_handler(Exception)
async def unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    log.exception("unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse({"detail": "Something went wrong on our side."}, status_code=500)


for router in (
    auth.router,
    users.router,
    predictions.router,
    feedback.router,
    stats.router,
    dishes.router,
    admin.router,
):
    app.include_router(router, prefix="/api")


@app.get("/api/health", tags=["meta"])
def health() -> dict[str, object]:
    predictor = get_predictor()
    return {"status": "ok", "model": predictor.name, "placeholder": predictor.is_placeholder}
