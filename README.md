# Keitaro Wrapper (NestJS)

Порт тестового задания: обёртка над Keitaro Admin API  
(создаватор кампаний + редактор офферов в потоках).

```
backend/   # NestJS + Mongoose + MongoDB
frontend/  # Vue 3 + Vite + TypeScript + Naive UI
```

## Требования

- Docker + Docker Compose **или**
- Node.js **20+**, npm, MongoDB

Нужен доступ к Keitaro: `KEITARO_URL` (origin админки) и `KEITARO_API_KEY`  
(Профиль → API keys в трекере).

## Быстрый старт (Docker)

```bash
cp .env.example .env
# обязательные: KEITARO_URL, KEITARO_API_KEY
# опционально: KEITARO_DOMAIN_ID / GROUP_ID / SOURCE_ID
#   или имена KEITARO_*_NAME (группа по умолчанию FORTESTS;
#   если traffic source не найден — используется 0)

docker compose up --build
```

Открыть UI: http://127.0.0.1:8080

| Сервис     | Роль                         |
|------------|------------------------------|
| `db`       | MongoDB 7                    |
| `backend`  | NestJS на порту 3000         |
| `frontend` | nginx: UI + proxy `/api/*`   |

Остановка: `docker compose down`  
Сброс БД: `docker compose down -v`

Проверка связи с Keitaro:

```bash
curl -s http://127.0.0.1:8080/api/keitaro/status
# ожидается: "configured": true, "reachable": true
```

## Локальная разработка без Docker

### MongoDB

```bash
# например
docker run -d --name keitaro-mongo -p 27017:27017 mongo:7
```

### Backend

```bash
cd backend
cp ../.env.example .env   # заполнить KEITARO_* и MONGODB_URI
npm install
npm run start:dev
```

API: http://127.0.0.1:3000

### Frontend

```bash
cd frontend
npm install
npm run dev
```

UI: http://127.0.0.1:5173  
Vite проксирует `/api/*` → `http://127.0.0.1:3000` (префикс `/api` снимается).

## Env

См. корневой `.env.example` и `backend/.env.example`.

| Переменная | Назначение |
|------------|------------|
| `KEITARO_URL` | Origin трекера, без `/admin_api/...` |
| `KEITARO_API_KEY` | Ключ Admin API |
| `KEITARO_DOMAIN_ID` / `KEITARO_DOMAIN_NAME` | Домен кампании |
| `KEITARO_GROUP_ID` / `KEITARO_GROUP_NAME` | Группа (по умолчанию `FORTESTS`) |
| `KEITARO_SOURCE_ID` / `KEITARO_SOURCE_NAME` | Traffic source; если не найден — `0` |
| `KEITARO_WHITE_PAGE_URL` | Редирект geo-потока (по умолчанию Google) |
| `MONGODB_URI` | URI MongoDB |

## API (кратко)

Через UI/nginx пути с префиксом `/api`  
(напрямую к backend — без `/api`):

- `GET /health`
- `GET /keitaro/status`
- `POST /campaigns` — `{name, geo, offer_id}`
- `GET /offers/search?q=...`
- `GET/POST /campaigns/{id}/streams/...` — fetch / add / remove / pin / push / cancel

## Что умеет приложение

1. **Create campaign** — кампания в Keitaro с двумя потоками:  
   geo → Google, default → выбранный оффер; домен/группа/источник из env или резолва.
2. **Streams editor** — офферы потока, soft-remove / bring-back, equal share + pin, push / cancel.
