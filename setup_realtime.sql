-- Kich hoat Realtime cho cac bang can thiet.
-- Script nay co the chay lai nhieu lan ma khong bi loi "already member".
BEGIN;
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      CREATE PUBLICATION supabase_realtime;
    END IF;
  END
  $$;

  DO $$
  DECLARE
    table_name text;
    table_names text[] := ARRAY[
      'approval_requests',
      'transactions',
      'incomes',
      'material_orders',
      'partner_debts',
      'notifications'
    ];
  BEGIN
    FOREACH table_name IN ARRAY table_names LOOP
      IF to_regclass('public.' || table_name) IS NOT NULL
         AND NOT EXISTS (
          SELECT 1
          FROM pg_publication_tables
          WHERE pubname = 'supabase_realtime'
            AND schemaname = 'public'
            AND tablename = table_name
        ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
      END IF;
    END LOOP;
  END
  $$;
COMMIT;
