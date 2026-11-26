# Trajectory backend hardening patch

This patch updates the locally installed trajectory backend block. It is designed to be applied on top of the uncommitted local changes from `trajectory-backend-block.zip`.

## Included changes

1. Profile + planning preferences are saved through one `save_profile_bundle` PostgreSQL RPC. A failed dependent write rolls back the base profile update as well.
2. Direct Data API writes to `profile_subject_preparation` and `profile_alternative_universities` are revoked. Authenticated users retain SELECT access under their existing RLS policies. Direct profile writes are also revoked except for the `theme_preference` and `notification_preferences` columns; core academic/planning fields go through the backend-only bundle RPC.
3. Profile identity metadata (`email` and `full_name`) is taken from the Supabase Auth user returned by the authentication middleware, not from request-body/RPC JSON.
4. Selected program ownership is verified against the selected university in the database.
5. Profile and trajectory write RPCs use `SECURITY INVOKER`, require the backend service role by function grants, and accept a user id supplied by the already-authenticated Express request. Authenticated browser clients cannot execute those functions. This avoids adding new `SECURITY DEFINER` functions in the exposed `public` schema.
6. A server-only Supabase secret key is used for the atomic profile-save RPC and trajectory write RPCs. The key must never be placed in frontend/Vite environment variables or committed.
7. Generation frequency is limited in Express and enforced again in PostgreSQL: at most 3 successful new versions in 15 minutes and 12 in a rolling 24-hour window. The database quota counts only new successful versions; retries with the same request UUID return the existing plan. The lightweight Express guard still limits all HTTP generate calls to three per user per minute.
8. Olympic source checks must be no older than 90 days; benefit source checks must be no older than 180 days. A five-minute clock-skew tolerance is allowed.
9. Tests cover stale/future source checks and the per-user in-process rate limiter.

## Required backend environment variable

Add `SUPABASE_SECRET_KEY` to the backend environment only. The code also accepts the legacy `SUPABASE_SERVICE_ROLE_KEY` variable as a fallback. A compatibility fetch wrapper is included for the repository's pinned `@supabase/supabase-js` 2.57 line: when a modern `sb_secret_...` key is used, it keeps the key in `apikey` and removes only an identical `Authorization: Bearer <secret-key>` fallback. It does not remove a real user JWT, and legacy JWT service-role keys retain their normal behavior.

For local development, add this line to `backend/.env` and set its value from the staging Supabase project's API Keys page:

```dotenv
SUPABASE_SECRET_KEY=your_staging_secret_key
```

Do not put the value in `frontend/.env`, `frontend/.env.local`, any `VITE_*` variable, source code, screenshots, or chat messages. Do not copy the Production key into the staging environment. Render staging will also need this variable in the backend service environment before profile saves, plan generation, and task-status writes can work there. The secret key maps to the Supabase `service_role`; it bypasses RLS and must remain backend-only.

## Applying the patch

Extract the ZIP into the repository root with overwrite enabled. The archive contains only the listed files and the migration/verification files; it does not contain `.env`, secrets, `node_modules`, build output, or user data.

The migration remains unapplied. Do not run `supabase db push`, commit, push, merge, or deploy until the updated checks have passed and the SQL has been reviewed.

## Verification

After extraction, run from the repository root:

```powershell
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw "Typecheck failed" }

npm run build
if ($LASTEXITCODE -ne 0) { throw "Build failed" }

npm test
if ($LASTEXITCODE -ne 0) { throw "Tests failed" }

git diff --check
if ($LASTEXITCODE -ne 0) { throw "Diff check failed" }
```

The migration file is `backend/supabase/migrations/20261126072549_trajectory_generation_api.sql`.
The read-only post-migration checks are in `backend/supabase/verification/trajectory_generation_api.sql`.
