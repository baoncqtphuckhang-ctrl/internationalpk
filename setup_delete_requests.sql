-- Create delete_requests table
CREATE TABLE IF NOT EXISTS delete_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    original_table TEXT NOT NULL,
    record_id TEXT NOT NULL,
    record_name TEXT NOT NULL,
    requested_by TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS and insert policy
ALTER TABLE delete_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all actions for authenticated users" ON delete_requests;
CREATE POLICY "Allow all actions for authenticated users"
ON delete_requests
FOR ALL
USING (true)
WITH CHECK (true);

-- Enable realtime
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
       AND NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'delete_requests'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE delete_requests;
    END IF;
END
$$;
