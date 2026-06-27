-- SQL script to set up the material_warehouse table in Supabase
-- This table tracks all material imports (NHẬP) and exports (XUẤT) for inventory management.

CREATE TABLE IF NOT EXISTS material_warehouse (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_name TEXT NOT NULL,
    material_name TEXT NOT NULL,
    color_code TEXT,
    unit TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    transaction_type TEXT NOT NULL, -- 'NHẬP' hoặc 'XUẤT'
    date DATE NOT NULL,
    note TEXT,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Note: In Supabase, you can run this SQL query in the SQL Editor to create the table.

-- Nếu gặp lỗi 42501 (new row violates row-level security policy), hãy chạy thêm lệnh sau:
ALTER TABLE material_warehouse DISABLE ROW LEVEL SECURITY;
