-- Create team_info table to store team bank details
CREATE TABLE IF NOT EXISTS team_info (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    team_name TEXT UNIQUE NOT NULL,
    account_name TEXT,
    account_number TEXT,
    bank_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Enable Row Level Security (RLS)
ALTER TABLE team_info ENABLE ROW LEVEL SECURITY;

-- Allow all operations for all users (same policy pattern as other tables in this codebase)
DROP POLICY IF EXISTS "Allow all actions for authenticated users" ON team_info;
CREATE POLICY "Allow all actions for authenticated users"
ON team_info
FOR ALL
USING (true)
WITH CHECK (true);
