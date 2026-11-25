# Trajectory V2 — backend typecheck fix

Date: 2026-11-25

## What changed

Fixed TypeScript typing in:

- `backend/src/modules/ai/ai.service.ts`
- `backend/src/modules/olympiads/olympiads.service.ts`

The extended Supabase SELECTs include year/list metadata. The legacy fallback SELECTs intentionally omit those columns while supporting a database that has not yet received the migration. TypeScript inferred the extended query's narrow row shape and rejected assigning the legacy query result.

The service now explicitly normalizes both result variants to the application row interfaces (`OlympiadRow` and `SeasonRow`) using a narrow `unknown` bridge at the database boundary. Runtime behavior is unchanged: missing optional metadata remains absent and existing defaults/compatibility handling remain in place.

## Apply

Extract the fix ZIP into the project root (`trajectory-olympiad-v2-ready`) and allow the two files under `backend/src/modules/...` to be overwritten.

Then run:

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
```

No database migration, API key, environment variable, or live Supabase change is required for this TypeScript fix.
