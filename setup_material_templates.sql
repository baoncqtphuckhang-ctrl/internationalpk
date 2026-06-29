-- Tạo bảng material_templates để lưu trữ danh mục vật tư
CREATE TABLE IF NOT EXISTS material_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_name TEXT NOT NULL UNIQUE,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Tạo trigger để tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_material_templates_modtime ON material_templates;

CREATE TRIGGER update_material_templates_modtime
    BEFORE UPDATE ON material_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();
