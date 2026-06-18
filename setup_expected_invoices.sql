CREATE TABLE IF NOT EXISTS expected_invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "projectName" TEXT,
    "preTaxValue" NUMERIC,
    "vatAmount" NUMERIC,
    "postTaxValue" NUMERIC,
    "teamValue" NUMERIC,
    "accumulatedAdvance" NUMERIC,
    "teamName" TEXT,
    "phase" TEXT,
    "note" TEXT,
    "is_completed" BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Bật Row Level Security nhưng cho phép tất cả mọi người có thể xem/thêm/sửa/xóa 
-- (nếu không cần phân quyền phức tạp theo user)
ALTER TABLE expected_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all actions for authenticated users" 
ON expected_invoices 
FOR ALL 
USING (true)
WITH CHECK (true);
