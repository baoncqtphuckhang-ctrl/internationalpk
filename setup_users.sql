-- SQL script to set up the users table in Supabase

-- 1. Create the users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    name TEXT,
    phone TEXT,
    is_locked BOOLEAN DEFAULT FALSE,
    can_view_finance BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 2. Insert initial mock data if the table is empty
INSERT INTO users (id, username, password, role, name, is_locked, can_view_finance)
SELECT 'u1', 'admin', '0000', 'ADMIN', 'Quản trị hệ thống', FALSE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');

INSERT INTO users (id, username, password, role, name, is_locked, can_view_finance)
SELECT 'u2', 'giamdoc', '1', 'GIÁM ĐỐC', 'Giám Đốc', FALSE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'giamdoc');

INSERT INTO users (id, username, password, role, name, is_locked, can_view_finance)
SELECT 'u3', 'qs_01', '1', 'QS', 'Nguyễn Văn QS', FALSE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'qs_01');

INSERT INTO users (id, username, password, role, name, is_locked, can_view_finance)
SELECT 'u6', 'ketoan_01', '1', 'KẾ TOÁN', 'Kế toán trưởng', FALSE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'ketoan_01');
