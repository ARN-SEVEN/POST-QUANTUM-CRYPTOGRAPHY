# QuantumChat auth backend

FastAPI service that signs users up and logs them in. Accounts are stored in a
Supabase Postgres table (`public.users`) with bcrypt password hashes.

## 1. Create the database table

[`supabase/schema.sql`](supabase/schema.sql) creates `public.users` and enables
row level security with no policies, so only the service-role key (used here,
server-side) can read or write accounts.

Either paste it into the dashboard **Database > SQL editor**, or apply it from
the terminal once `DATABASE_URL` is set in `.env` (dashboard **Connect > Session
pooler**, with your database password):

```bash
pip install -r requirements.txt
python -m scripts.init_db
```

The script is safe to re-run; every statement in the file is idempotent.

## 2. Configure credentials

Copy `.env.example` to `.env` and fill in:

- `SUPABASE_URL` — Project settings > Data API
- `SUPABASE_SERVICE_ROLE_KEY` — Project settings > API keys. This key bypasses
  RLS; keep it server-side and never ship it to the React app.
- `JWT_SECRET` — a long random string used to sign access tokens.

## 3. Run

```bash
python -m venv .venv
.venv/Scripts/activate        # bash on Windows: source .venv/Scripts/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Interactive docs: http://127.0.0.1:8000/docs

## Endpoints

| Method | Path           | Purpose                                        |
| ------ | -------------- | ---------------------------------------------- |
| GET    | `/health`      | Liveness check, needs no credentials           |
| POST   | `/auth/signup` | Create an account, returns a token             |
| POST   | `/auth/login`  | Verify credentials, returns a token            |
| GET    | `/messages`    | Return messages (Bearer token required)        |
| POST   | `/messages`   | Send a message (Bearer token required)         |

`POST /auth/signup` accepts `{ "email", "password", "display_name"? }` and
returns `201` with `{ "access_token", "token_type", "user" }`. Passwords must be
8–72 characters (72 is bcrypt's input limit).

`POST /auth/login` accepts `{ "email", "password" }`, returns the same shape on
success and `401` for both an unknown email and a wrong password. A successful
login updates `users.last_login_at`.

The access token is a HS256 JWT with `sub` set to the user id and `exp` set from
`JWT_EXPIRES_MINUTES`. Nothing consumes it yet — there are no protected routes.

```bash
curl -X POST http://127.0.0.1:8000/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@quantum.chat","password":"correct-horse"}'

curl -X POST http://127.0.0.1:8000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@quantum.chat","password":"correct-horse"}'
```

## Notes

- The React login screen calls `POST /auth/login` and expects this API at
  `http://127.0.0.1:8000`. Override that with `VITE_API_URL` in
  `BuildQuantumChatMessagingApp/.env` if the backend runs elsewhere.
- No accounts exist until you create one: `POST /auth/signup` (or the `/docs`
  form) adds a user, after which the login screen works.

## Messages

The chat now stores messages in `public.messages`. Two endpoints sit behind the
same auth rules as signup/login:

| Method | Path         | Purpose                                          |
| ------ | ------------ | ------------------------------------------------ |
| GET    | `/messages`  | Return every message, oldest first               |
| POST   | `/messages`  | Send a message for the authenticated user        |

`GET /messages` and `POST /messages` both require a Bearer access token in the
`Authorization` header — the same token returned by `/auth/login`. The backend
verifies the JWT signature (`sub` = user id) and writes through the
service-role key; browsers never hold the service-role key.

`POST /messages` accepts `{ "content" }` and returns the stored message with
the sender's display name pulled from `public.users`. The frontend calls
`GET /messages` when a session exists and again after each sent message so the
list stays ordered by `sent_at`.

To seed the demo conversation once (run after accounts exist and the messages
table is created):

```bash
python -m scripts.init_db supabase/seed-messages.sql
```

(It only inserts when `public.messages` is still empty.)
- Missing Supabase credentials produce `503` with a message pointing at
  `backend/.env`, rather than failing at import time.
