-- Thêm cột tổng thầu và chủ đầu tư vào bảng projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS general_contractor TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS investor TEXT;
