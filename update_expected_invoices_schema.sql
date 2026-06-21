-- Chạy file này trong Supabase SQL Editor để cập nhật bảng expected_invoices
ALTER TABLE expected_invoices
ADD COLUMN IF NOT EXISTS "deductionAmount" NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS "qs_approved" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "accountant_approved" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "payment_period" TEXT,
ADD COLUMN IF NOT EXISTS "account_name" TEXT,
ADD COLUMN IF NOT EXISTS "account_number" TEXT,
ADD COLUMN IF NOT EXISTS "bank_name" TEXT;

-- Nếu đang dùng is_completed để đánh dấu lịch sử chi, thì giữ nguyên is_completed. 
-- Quy trình mới: 
-- QS Duyệt -> qs_approved = true
-- Kế toán Duyệt -> accountant_approved = true VÀ is_completed = true
