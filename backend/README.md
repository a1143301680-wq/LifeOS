# LifeOS Backend

Phase 1A FastAPI backend skeleton.

## Setup

```powershell
python -m pip install -e .[dev]
Copy-Item .env.example .env
```

Set `DATABASE_URL` to the PostgreSQL database URL.

## Migrate

```powershell
python -m alembic upgrade head
```

## Bootstrap Users

After migrations, generate the two Phase 1A identity tokens:

```powershell
python -m app.scripts.bootstrap_users
```

The script prints raw tokens only when creating missing users. Store them in the clients:

- PC Web: `localStorage` key `lifeos.identityToken`
- Android: DataStore

The database stores only Argon2id PHC strings.

## Run

```powershell
python -m uvicorn app.main:app --reload
```

## Verify

```powershell
python -m pytest
```

`GET /api/v1/me` verifies the bearer token and returns the current user envelope.
