-- Thêm cột status vào bảng projects để quản lý trạng thái thi công và khóa sổ
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Doing';
