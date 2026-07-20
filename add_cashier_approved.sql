-- Chạy script này trong Supabase SQL Editor để cập nhật bảng expected_invoices
ALTER TABLE expected_invoices
ADD COLUMN IF NOT EXISTS "cashier_approved" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "cashier_note" TEXT;
