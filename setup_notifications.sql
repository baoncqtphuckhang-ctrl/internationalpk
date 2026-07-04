CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient_username TEXT,
    recipient_role TEXT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    source_table TEXT,
    source_id TEXT,
    project_name TEXT,
    created_by TEXT,
    is_read BOOLEAN DEFAULT false,
    recipient_deleted BOOLEAN DEFAULT false,
    sender_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS notifications_recipient_username_idx
ON notifications (recipient_username);

CREATE INDEX IF NOT EXISTS notifications_recipient_role_idx
ON notifications (recipient_role);

CREATE INDEX IF NOT EXISTS notifications_created_at_idx
ON notifications (created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all actions for authenticated users" ON notifications;

CREATE POLICY "Allow all actions for authenticated users"
ON notifications
FOR ALL
USING (true)
WITH CHECK (true);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
       AND NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
    END IF;
END
$$;
