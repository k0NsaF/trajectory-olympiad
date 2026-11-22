# Развёртывание «Траектории в олимпиаду»

## Архитектура публикации

- Frontend: Vercel Static Deployment, результат сборки `frontend/dist`.
- Backend: Render Web Service, Express API из `backend/dist`.
- Database/Auth: существующий проект Supabase.
- Cloudflare Workers AI: необязательная интеграция; без Account ID и API Token сервер запускается, но AI-запросы вернут `AI_PROVIDER_NOT_CONFIGURED`.

Не создавай новую базу данных в Render. Проект уже использует Supabase.

## 0. Подготовка репозитория

1. Создай пустой репозиторий GitHub. Не добавляй на GitHub README, License или .gitignore, если будешь загружать уже существующий проект.
2. Открой PowerShell в корневой папке проекта.
3. Если Git ещё не инициализирован, выполни:

```powershell
git init
git add .
git status --short
```

Перед коммитом убедись, что `backend/.env` и `frontend/.env` НЕ отображаются среди добавленных файлов. В проекте `.gitignore` исключает `.env` и `.env.*`.

Если эти файлы когда-либо были добавлены в Git ранее, одного `.gitignore` недостаточно. Убери их из индекса:

```powershell
git rm --cached backend/.env frontend/.env
```

Затем проверь статус и отправь проект:

```powershell
git add .
git commit -m "Prepare production deployment"
git branch -M main
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git push -u origin main
```

Замени `USERNAME/REPOSITORY` на адрес своего пустого репозитория. Если `origin` уже существует, вместо `git remote add origin` используй `git remote set-url origin ...`.

## 1. Разверни backend на Render

1. Открой Render и выбери **New → Blueprint**.
2. Подключи GitHub-репозиторий с проектом. Render прочитает `render.yaml` в корне.
3. Выбери бесплатный план для тестового демо и регион Frankfurt (они уже указаны в Blueprint).
4. Заполни переменные, которые Render запросит:
   - `SUPABASE_URL` — Project URL из Supabase → Project Settings → API.
   - `SUPABASE_PUBLISHABLE_KEY` — Publishable key из Supabase. Не используй `service_role` или secret key.
   - `CLOUDFLARE_ACCOUNT_ID` — Account ID из Cloudflare.
   - `CLOUDFLARE_API_TOKEN` — токен Workers AI; только в Render.
   - `CLOUDFLARE_AI_MODEL` — `@cf/zai-org/glm-4.7-flash` (модель по умолчанию).
   - `TAVILY_API_KEY` — необязательный ключ внешнего поиска; без него поиск отключён фактически, даже если флаг включён.
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

`vercel.json` уже содержит SPA rewrite на `/index.html`, поэтому прямое открытие маршрутов React Router (например `/trajectory`, `/profile`, `/universities`) должно возвращать приложение, а не 404.

## 3. Заверши CORS и Supabase Auth

1. В Render → Environment обнови `FRONTEND_URL` на точный URL production-домена Vercel, без завершающего `/`. Для нескольких разрешённых frontend-origin перечисли их через запятую.
2. Сохрани переменную и дождись перезапуска Render-сервиса.
3. В Supabase → Authentication → URL Configuration:
   - Site URL: production URL Vercel.
   - Redirect URLs: добавь `https://имя-проекта.vercel.app/**`.
   - При необходимости отдельно добавь preview-домены Vercel.
4. Проверь регистрацию, подтверждение email, вход, восстановление пароля и возврат на `/auth`.

## 4. Финальная проверка опубликованного приложения

- Открой Vercel production URL в приватном окне.
- Открой `/trajectory`, `/olympiads`, `/calendar`, `/universities`, `/achievements`, `/profile` напрямую в адресной строке.
- Проверь, что каталог и справочники загружаются из Supabase.
- Зарегистрируй тестового пользователя и проверь сохранение профиля, достижений и напоминаний.
- Убедись, что запросы к `https://имя-сервиса.onrender.com/api/health` возвращают 200.
- Проверь, что браузер не показывает CORS-ошибки.
- Проверь, что в DevTools → Network клиент не отправляет никаких секретных ключей. Publishable key допустим в frontend; `service_role`, Cloudflare API Token, Tavily API key и другие секреты — нет.

## 5. Cloudflare Workers AI

Добавь `CLOUDFLARE_ACCOUNT_ID` и `CLOUDFLARE_API_TOKEN` только в Render → Environment. Токен должен иметь разрешения Workers AI Read и Workers AI Edit. Установи `CLOUDFLARE_AI_MODEL=@cf/zai-org/glm-4.7-flash`, если значение модели не задано в Blueprint. Не добавляй Cloudflare Token в Vercel, frontend, `.env.example` или GitHub.

Внешний поиск работает отдельно через Tavily. Для него добавь `TAVILY_API_KEY` в Render. Переменная `TAVILY_SEARCH_ENABLED=true` включает поиск; без ключа Tavily поиск недоступен, но основной ИИ-консультант продолжит работать по справочнику Supabase.

## Обязательные секреты и публичные параметры

| Переменная | Где хранить | Секрет? |
|---|---|---|
| `SUPABASE_URL` | Render + Vercel | Нет |
| `SUPABASE_PUBLISHABLE_KEY` | Render | Публичный Publishable key |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Vercel | Публичный Publishable key |
| `VITE_API_URL` | Vercel | Нет |
| `FRONTEND_URL` | Render | Нет |
| `CLOUDFLARE_API_TOKEN` | Только Render | Да |
| `CLOUDFLARE_ACCOUNT_ID` | Только Render | Нет |
| `CLOUDFLARE_AI_MODEL` | Render | Нет |
| `TAVILY_API_KEY` | Только Render | Да |
| Supabase `service_role` key | Не использовать в этом приложении | Да |
