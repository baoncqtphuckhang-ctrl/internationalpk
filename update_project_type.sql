-- Thêm cột project_type vào bảng projects để phân biệt "Trực tiếp order" và "Tổng thầu mua hộ"
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_type TEXT DEFAULT 'TRỰC TIẾP ORDER';
