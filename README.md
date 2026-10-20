# Druk Lens: Bhutanese Food Recognition

CSA301 Deep Learning project, Gyalpozhing College of Information Technology.
Pelgye Dorji · Karma Subba · Tshering Dema · Dorji Choden

A web app where a user signs in, photographs a Bhutanese dish and gets the dish name with a
confidence score. Every scan is kept in the user's history, where they can mark it right or wrong.
The deep learning model (a from-scratch CNN against MobileNetV2/ResNet50) comes in a later phase;
until then a clearly labelled **placeholder predictor** answers so the whole app can be used.

## What's in the repo

```
backend/            FastAPI + SQLAlchemy + Alembic (Python)
  app/api/routes/   auth, users, predict/history, feedback, stats, dishes
  app/services/     predictor.py  ← plug the trained model in here
                    images.py     upload checks, re-encoding, thumbnails
                    dishes.py     the 9 dish classes (keep in model output order)
  alembic/          database migrations
  scripts/seed.py   creates the demo account
  tests/            API tests (run on SQLite, no database server needed)
frontend/           React + Vite + TypeScript + Tailwind CSS
model/              notebooks and saved models (training phase)
dataset/            local dataset (not committed)
docker-compose.yml  PostgreSQL 17
.env.example        every setting, documented
```

## Run it

Needs Node 22+, Python 3.12+, and Docker Desktop (for PostgreSQL).

```bash
cp .env.example .env            # then set POSTGRES_PASSWORD, JWT_SECRET, SEED_USER_PASSWORD
docker compose up -d db
```

If port 5432 is already taken (another project's Postgres), set `POSTGRES_PORT` to a free port and
use the same port in `DATABASE_URL`. Keep `127.0.0.1` in `DATABASE_URL`: `localhost` tries IPv6
first, and the container only listens on IPv4, so connections stall.

Backend (from `backend/`):

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-dev.txt      # macOS/Linux: .venv/bin/python
.venv/Scripts/python -m alembic upgrade head
.venv/Scripts/python -m scripts.seed
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

Frontend (from `frontend/`):

```bash
npm install
npm run dev
```

Open http://localhost:5173. The Vite dev server forwards `/api` to the backend, so the session
cookie stays on one origin. API docs: http://localhost:8000/api/docs.

**Accounts** (both created by `python -m scripts.seed`, which also resets their names and passwords
to the values in `.env`):

| Role  | Email               | Password in `.env`    | Sees                                     |
| ----- | ------------------- | --------------------- | ---------------------------------------- |
| User  | `demo@druklens.bt`  | `SEED_USER_PASSWORD`  | Their own scans, history and insights    |
| Admin | `admin@druklens.bt` | `SEED_ADMIN_PASSWORD` | Also every user, every scan and all feedback, with a CSV export |

The admin role can only be granted by the seed script or directly in the database, never through
the API. Admin views are read-only: an admin can't change or delete anyone else's scans or answers.

**Without Docker:** set `DATABASE_URL=sqlite:///./preview.db` for the backend commands above to
try the app on SQLite. The project's database is PostgreSQL; use SQLite only for a quick look.

## Tests

```bash
cd backend && .venv/Scripts/python -m pytest -q
cd frontend && npx tsc -b && npx eslint src
```

## Plugging in the trained model

1. Save the better model as `model/saved_models/<name>.keras`.
2. Implement `KerasPredictor` in `backend/app/services/predictor.py`: load the model once, and in
   `predict()` resize and normalise **exactly as in training**, then return the top guesses.
3. Keep `DISHES` in `backend/app/services/dishes.py` in the same order as the model's output layer.
4. Set `MODEL_PATH` in `.env`. Results stop being labelled as demo answers automatically.
5. TensorFlow does not support the newest Python yet; use a Python version TensorFlow supports
   for the backend's virtualenv when you add it.

Below `CONFIDENCE_THRESHOLD` (0.6 by default) the app says it isn't sure and asks for another photo.
Feedback is stored, but it does not retrain the model by itself.

## Security notes

- Passwords: bcrypt (cost 12), 8 to 72 bytes, a small common-password blocklist. Swap in a full
  top-10k list before any real deployment.
- Sessions: a signed JWT in an httpOnly, `SameSite=Strict` cookie scoped to `/api`. Logout and
  password changes revoke every earlier token. Set `COOKIE_SECURE=true` when serving over HTTPS.
- CSRF: cookie-authenticated writes must carry `X-Requested-With: fetch`; CORS allows only
  `CORS_ORIGINS`.
- Login is rate limited (5 per minute per IP and email); registration 10 per hour per IP. The
  limiter is in memory, so it is per process.
- Uploads: the bytes must decode as JPEG, PNG or WebP under 5 MB and 40 megapixels; each image is
  re-encoded (dropping EXIF/GPS data) and saved under a random name. Images are served only to their
  owner and to admins.
- Every history, feedback and image query is scoped to the signed-in user; other users' ids return 404.

