-- Already applied to remote Supabase on 2026-11-25.
-- The auth trigger continues to run; direct RPC execution is not granted.
revoke execute on function public.handle_new_auth_user()
  from public, anon, authenticated;
