-- Vui lòng chạy lệnh SQL này trong công cụ SQL Editor của Supabase để thêm cột `leave_balance` vào bảng `employees`:
ALTER TABLE employees ADD COLUMN IF NOT EXISTS leave_balance numeric DEFAULT 0;
