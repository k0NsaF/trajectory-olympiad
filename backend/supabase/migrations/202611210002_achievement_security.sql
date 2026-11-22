
drop policy if exists "Users can update own achievements"
on public.achievements;

revoke update on table public.achievements
from public, anon, authenticated;

revoke insert on table public.achievements
from public, anon, authenticated;

grant insert (
  user_id,
  olympiad_id,
  olympiad_name,
  title,
  result,
  achieved_at,
  proof_url
)
on table public.achievements
to authenticated;
