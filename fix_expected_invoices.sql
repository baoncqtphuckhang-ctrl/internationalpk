ALTER TABLE expected_invoices 
ADD COLUMN IF NOT EXISTS "teamValue" NUMERIC,
ADD COLUMN IF NOT EXISTS "accumulatedAdvance" NUMERIC,
ADD COLUMN IF NOT EXISTS "teamName" TEXT,
ADD COLUMN IF NOT EXISTS "is_completed" BOOLEAN DEFAULT false;

-- Đảm bảo không bị lỗi khi lưu Tổ đội (vì Tổ đội có thể không có giá trị Hóa đơn)
ALTER TABLE expected_invoices ALTER COLUMN "postTaxValue" DROP NOT NULL;
