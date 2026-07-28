-- Thêm cột Giá trị quyết toán và Giá trị GTBL cho bảng projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS settlement_value NUMERIC DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS gtbl_value NUMERIC DEFAULT 0;
