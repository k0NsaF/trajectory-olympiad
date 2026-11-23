# Траектория в олимпиаду

Персональная платформа для подготовки к олимпиадам и выбора образовательной траектории.

- `frontend/` — React + TypeScript интерфейс.
- `backend/` — Express API, AI-провайдеры и интеграции.
- `shared/` — общие типы.
- `backend/supabase/migrations/` — SQL-миграции базы данных.

## Единый реестр университетов

Порядок установки и импорта государственных каталогов описан в [docs/UNIVERSITY_REGISTRY.md](docs/UNIVERSITY_REGISTRY.md). Перед импортом необходимо вручную применить миграцию `202611230001_university_registry.sql` в Supabase и локально задать Supabase Secret/Service Role key в `backend/.env`. Секретный ключ никогда не размещается во frontend, Vercel, Render или GitHub.

## Разработка

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd test
```
