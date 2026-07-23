-- Chạy câu lệnh này trong SQL Editor của Supabase để cập nhật bảng expected_invoices
ALTER TABLE expected_invoices
ADD COLUMN IF NOT EXISTS invoice_no TEXT,
ADD COLUMN IF NOT EXISTS invoice_date DATE;
