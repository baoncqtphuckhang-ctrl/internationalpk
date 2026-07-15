-- Chạy câu lệnh này trong Supabase SQL Editor để sửa lỗi không lưu được tổ đội dự kiến
ALTER TABLE expected_invoices ADD COLUMN IF NOT EXISTS "invoice_month" TEXT;
