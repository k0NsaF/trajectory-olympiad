
WITH expected_tables(table_name) AS (
  VALUES
    ('profiles'),
    ('universities'),
    ('programs'),
    ('olympiads'),
    ('olympiad_seasons'),
    ('stages'),
    ('benefits'),
    ('achievements'),
    ('reminders')
)
SELECT
  expected_tables.table_name,
  COALESCE(pg_class.relrowsecurity, FALSE) AS rls_enabled,
  COALESCE(pg_class.relforcerowsecurity, FALSE) AS rls_forced
FROM expected_tables
LEFT JOIN pg_namespace
  ON pg_namespace.nspname = 'public'
LEFT JOIN pg_class
  ON pg_class.relnamespace = pg_namespace.oid
 AND pg_class.relname = expected_tables.table_name
 AND pg_class.relkind = 'r'
ORDER BY expected_tables.table_name;

-- Полный список политик для публичных таблиц.
-- Проверь, что пользовательские таблицы ограничены auth.uid(),
-- а справочники доступны на чтение, но не на запись обычным пользователям.
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
