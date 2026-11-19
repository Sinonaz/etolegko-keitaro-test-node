# Keitaro Wrapper — NestJS + MongoDB

Port of `etolegko-keitaro-test-py` with NestJS + Mongoose instead of FastAPI + SQLAlchemy.

## Goals

- Same product behaviour: create campaign (geo → Google + default offer stream), streams editor (fetch / add / remove / bring-back / pin / push / cancel), equal+pin weight logic.
- API contract compatible with the existing Vue frontend (snake_case JSON, FastAPI-style `{ detail }` errors, no `/api` prefix on backend).
- MongoDB instead of SQLite/Postgres.

## Stack

| Layer | Choice |
|-------|--------|
| Backend | NestJS + Mongoose |
| DB | MongoDB 7 |
| Frontend | Vue 3 + Vite + Naive UI (copied) |
| Deploy | Docker Compose: mongo + backend + frontend |

## Collections

**campaigns** — local mirror of created campaigns (`id` UUID string, name, geo, offer_id, keitaro_* ids, timestamps).

**stream_drafts** — one doc per stream; embedded `offers[]` with share/pinned/removed/sort_order; `snapshot` for cancel; `dirty` flag.

## Modules

`config` · `health` · `keitaro` (HTTP client) · `campaigns` · `offers` · `streams` (weights + draft ops)

## Commit stages

1. Scaffold + Mongo + health
2. Config + Keitaro client + status
3. Campaigns + offers search
4. Streams editor + weights
5. Frontend + Compose + README
