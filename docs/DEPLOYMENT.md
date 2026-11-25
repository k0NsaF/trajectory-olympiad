# Развёртывание «Траектории в олимпиаду»

## Архитектура публикации

- Frontend: Vercel Static Deployment, результат сборки `frontend/dist`.
- Backend: Render Web Service, Express API из `backend/dist`.
- Database/Auth: существующий проект Supabase.
- Groq: основной AI-провайдер (`GROQ_API_KEY`, модель по умолчанию `openai/gpt-oss-120b`).
- Cloudflare Workers AI: резервный AI-провайдер; если Groq не отвечает, backend переключается на Cloudflare.

Не создавай новую базу данных в Render. Проект уже использует Supabase.

## Рабочий процесс Git и автоматические публикации

- `trajectory-v2` — рабочая ветка для разработки и проверки изменений.
- `main` — production-ветка; опубликованные сервисы должны отслеживать её.
- GitHub Actions запускает `typecheck`, production build и тесты при push и Pull Request.
- Render настроен на `main` и должен выполнять deploy только после успешных CI-проверок (`autoDeployTrigger: checksPass`).
- Vercel использует `main` как production branch; push в `trajectory-v2` создаёт Preview, merge в `main` — Production deployment.

Обычный цикл: внести изменения в `trajectory-v2` → push → дождаться GitHub Actions → открыть Pull Request в `main` → проверить Preview → merge. После успешных CI-проверок Render и Vercel обновляют production. Не редактируй файлы непосредственно в GitHub Web Editor, если параллельно работаешь с локальным клоном: сначала синхронизируй `git pull`.


## 1. Разверни backend на Render

1. Открой Render и выбери **New → Blueprint**.
2. Подключи GitHub-репозиторий с проектом. Render прочитает `render.yaml` в корне.
3. Выбери бесплатный план для тестового демо и регион Frankfurt (они уже указаны в Blueprint).
4. Заполни переменные, которые Render запросит:
   - `SUPABASE_URL` — Project URL из Supabase → Project Settings → API.
   - `SUPABASE_PUBLISHABLE_KEY` — Publishable key из Supabase. Не используй `service_role` или secret key.
   - `GROQ_API_KEY` — API-ключ Groq; хранить только в Render.
   - `GROQ_AI_MODEL` — `openai/gpt-oss-120b` (значение по умолчанию).
   - `CLOUDFLARE_ACCOUNT_ID` — Account ID из Cloudflare.
   - `CLOUDFLARE_API_TOKEN` — токен Workers AI; только в Render.
   - `CLOUDFLARE_AI_MODEL` — `@cf/zai-org/glm-4.7-flash` (модель по умолчанию).
   - `TAVILY_API_KEY` — необязательный резервный ключ поиска; основной поиск использует встроенный Groq Browser Search и не требует отдельного ключа.
   - `FRONTEND_URL` — на первом шаге временно можно указать `http://localhost:5173`. После публикации frontend замени на точный production URL Vercel, например `https://имя-проекта.vercel.app`, без завершающего `/`.
5. Запусти deploy и дождись статуса Live.
6. Скопируй адрес сервиса вида `https://имя-сервиса.onrender.com`.
7. Проверь в браузере адрес `https://имя-сервиса.onrender.com/api/health`. Должен вернуться JSON с `success: true`.

Render Free засыпает после 15 минут без входящего трафика; первый запрос после простоя может ждать около минуты. Для демонстрационного проекта это допустимо, но не подходит для SLA production-сервиса.

## 2. Разверни frontend на Vercel

1. Открой Vercel → **Add New → Project** и импортируй тот же GitHub-репозиторий.
2. В настройках проекта оставь **Root Directory = `.` (корень репозитория)**. Не выбирай `frontend` как корневую папку: сборка использует workspace `shared`.
3. Конфигурация сборки уже задана в `vercel.json`:
   - Install: `npm ci --include=dev`
   - Build: `npm run build --workspace=shared && npm run build --workspace=frontend`
   - Output: `frontend/dist`
4. Выбери Node.js 24.x для согласованности с `.node-version`.
5. Добавь переменные окружения для Production (и Preview, если планируешь тестовые preview-деплои):
   - `VITE_API_URL` — URL Render backend, например `https://имя-сервиса.onrender.com`, без `/api` и без завершающего `/`.
   - `VITE_SUPABASE_URL` — тот же Supabase Project URL.
   - `VITE_SUPABASE_PUBLISHABLE_KEY` — тот же Supabase Publishable key.
6. Нажми Deploy. После успешной сборки скопируй production URL Vercel.

`vercel.json` уже содержит SPA rewrite на `/index.html`, поэтому прямое открытие маршрутов React Router (например `/olympiads`, `/calendar`, `/universities`) должно возвращать приложение, а не 404.

## 3. Заверши CORS и Supabase Auth

1. В Render → Environment обнови `FRONTEND_URL` на точный URL production-домена Vercel, без завершающего `/`. Для нескольких разрешённых frontend-origin перечисли их через запятую.
2. Сохрани переменную и дождись перезапуска Render-сервиса.
3. В Supabase → Authentication → URL Configuration:
   - Site URL: production URL Vercel.
   - Redirect URLs: добавь `https://имя-проекта.vercel.app/**`.
   - При необходимости отдельно добавь preview-домены Vercel.
4. Проверь регистрацию, подтверждение email, вход, восстановление пароля и возврат на главную `/` после успешного входа.

## 4. Финальная проверка опубликованного приложения

- Открой Vercel production URL в приватном окне.
- Открой `/`, `/olympiads`, `/calendar`, `/universities`, `/universities/compare`, `/ai`, `/favorites`, `/achievements`, `/profile` напрямую в адресной строке.
- Проверь, что каталог и справочники загружаются из Supabase.
- Зарегистрируй тестового пользователя и проверь сохранение профиля, достижений и напоминаний.
- Убедись, что запросы к `https://имя-сервиса.onrender.com/api/health` возвращают 200.
- Проверь, что браузер не показывает CORS-ошибки.
- Проверь, что в DevTools → Network клиент не отправляет никаких секретных ключей. Publishable key допустим в frontend; `service_role`, Cloudflare API Token, Tavily API key и другие секреты — нет.

## 5. Groq и резервный Cloudflare

Добавь `GROQ_API_KEY` только в Render → Environment. Основная модель — `openai/gpt-oss-120b`; при необходимости задай `GROQ_AI_MODEL`. Не добавляй ключ в Vercel, frontend, `.env.example` или GitHub.

Cloudflare Workers AI остаётся резервным провайдером. Добавь `CLOUDFLARE_ACCOUNT_ID` и `CLOUDFLARE_API_TOKEN` только в Render → Environment. Токен должен иметь разрешения Workers AI Read и Workers AI Edit. Установи `CLOUDFLARE_AI_MODEL=@cf/zai-org/glm-4.7-flash`, если значение модели не задано в Blueprint. Не добавляй Cloudflare Token в Vercel, frontend, `.env.example` или GitHub.

Автоматический поиск вузов и образовательных программ использует встроенный Groq Browser Search при модели `openai/gpt-oss-120b` или `openai/gpt-oss-20b`. Отдельный поисковый ключ не нужен: используется тот же `GROQ_API_KEY`. Если Groq Browser Search временно недоступен, backend может переключиться на Tavily при наличии `TAVILY_API_KEY` и `TAVILY_SEARCH_ENABLED=true`. Найденные страницы показываются как кандидаты и не записываются в справочник автоматически; правила приёма и льготы нужно сверять с первоисточниками.

## Обязательные секреты и публичные параметры

| Переменная | Где хранить | Секрет? |
|---|---|---|
| `SUPABASE_URL` | Render + Vercel | Нет |
| `SUPABASE_PUBLISHABLE_KEY` | Render | Публичный Publishable key |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Vercel | Публичный Publishable key |
| `VITE_API_URL` | Vercel | Нет |
| `FRONTEND_URL` | Render | Нет |
| `GROQ_API_KEY` | Только Render | Да |
| `GROQ_AI_MODEL` | Render | Нет |
| `CLOUDFLARE_API_TOKEN` | Только Render | Да |
| `CLOUDFLARE_ACCOUNT_ID` | Только Render | Нет |
| `CLOUDFLARE_AI_MODEL` | Render | Нет |
| `TAVILY_API_KEY` | Только Render | Да, необязательный резервный поиск |
| Supabase `service_role` key | Не использовать в этом приложении | Да |

## Импорт единого реестра университетов

Подробная инструкция по применению миграции, локальной настройке Supabase Secret key, dry-run и импорту государственных каталогов находится в [UNIVERSITY_REGISTRY.md](./UNIVERSITY_REGISTRY.md). Импорт запускается только локально; секретный ключ Supabase нельзя помещать во frontend, Vercel, Render или Git.
Для проверки Preview-деплоя проверь, что `VITE_API_URL`, `VITE_SUPABASE_URL` и `VITE_SUPABASE_PUBLISHABLE_KEY` заданы также для окружения **Preview**. Backend должен разрешать точный Preview-origin в `FRONTEND_URL` (вместе с production-origin, через запятую). При создании нового Preview-домена проверь CORS ещё раз: не используй произвольный wildcard без отдельной настройки backend.
