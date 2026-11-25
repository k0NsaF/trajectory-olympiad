Trajectory V2 — frontend TypeScript cleanup

This patch contains exactly three updated frontend source files.

1) frontend/src/pages/Olympiads/OlympiadsPage.tsx
   Adds the missing Info icon import used by two legal notes.

2) frontend/src/pages/Universities/UniversitiesPage.tsx
   Removes the unused Building2 icon import.

3) frontend/src/pages/Universities/UniversityDetailsPage.tsx
   Removes the unused readFavorites import.

How to apply:
- Extract this ZIP into the project root:
  C:\Users\макс\Desktop\trajectory-olympiad-v2-ready
- Confirm replacement of the three files.
- No npm ci is needed because these are source-only changes.
- Run:
  npm.cmd run typecheck
  npm.cmd run build
  npm.cmd test

This patch does not alter environment variables, API keys, Supabase, migrations,
or database data.
