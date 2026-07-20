-- ==========================================
-- SCRIPT KHỞI TẠO TOÀN BỘ CƠ SỞ DỮ LIỆU UNIFIED
-- Hỗ trợ chuyển đổi sang Supabase Project mới nhanh chóng
-- Chạy toàn bộ mã SQL dưới đây trong SQL Editor của Supabase mới.
-- ==========================================

-- Bật extension cho phép tạo UUID tự động (nếu chưa bật)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. BẢNG users
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    name TEXT,
    phone TEXT,
    is_locked BOOLEAN DEFAULT FALSE,
    can_view_finance BOOLEAN DEFAULT TRUE,
    signature_url TEXT,
    last_online TIMESTAMP WITH TIME ZONE,
    full_name TEXT,
    status TEXT,
    last_active TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Chèn dữ liệu ban đầu cho các tài khoản hệ thống nếu chưa tồn tại
INSERT INTO users (id, username, password, role, name, is_locked, can_view_finance)
SELECT 'u1', 'admin', '0000', 'ADMIN', 'Quản trị hệ thống', FALSE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');

INSERT INTO users (id, username, password, role, name, is_locked, can_view_finance)
SELECT 'u2', 'giamdoc', '1', 'GIÁM ĐỐC', 'Giám Đốc', FALSE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'giamdoc');

INSERT INTO users (id, username, password, role, name, is_locked, can_view_finance)
SELECT 'u3', 'qs_01', '1', 'QS', 'Nguyễn Văn QS', FALSE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'qs_01');

INSERT INTO users (id, username, password, role, name, is_locked, can_view_finance)
SELECT 'u6', 'ketoan_01', '1', 'KẾ TOÁN', 'Kế toán trưởng', FALSE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'ketoan_01');


-- ==========================================
-- 2. BẢNG projects
-- ==========================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    contract_no TEXT, -- Lưu thông tin hợp đồng dạng JSON
    contract_value_after_tax NUMERIC DEFAULT 0,
    advance_value NUMERIC DEFAULT 0,
    debt_to_collect NUMERIC DEFAULT 0,
    plhds NUMERIC[] DEFAULT '{}',
    address TEXT,
    cht_name TEXT,
    cht_phone TEXT,
    project_type TEXT DEFAULT 'TRỰC TIẾP ORDER',
    status TEXT DEFAULT 'Doing',
    general_contractor TEXT,
    investor TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);


-- ==========================================
-- 3. BẢNG transactions
-- ==========================================
CREATE TABLE IF NOT EXISTS transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_name TEXT,
    accounting_date DATE,
    invoice_date DATE,
    invoice_no TEXT,
    recipient TEXT,
    corresponding_account TEXT,
    code TEXT,
    debit NUMERIC DEFAULT 0,
    credit NUMERIC DEFAULT 0,
    note TEXT,
    status TEXT,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);


-- ==========================================
-- 4. BẢNG incomes
-- ==========================================
CREATE TABLE IF NOT EXISTS incomes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_name TEXT,
    date DATE,
    phase TEXT,
    amount NUMERIC DEFAULT 0,
    vat_amount NUMERIC DEFAULT 0,
    post_tax_amount NUMERIC DEFAULT 0,
    is_paid BOOLEAN DEFAULT FALSE,
    note TEXT,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);


-- ==========================================
-- 5. BẢNG approval_requests (Đề nghị thanh toán - DNTT)
-- ==========================================
CREATE TABLE IF NOT EXISTS approval_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    doc_type TEXT,
    project_name TEXT,
    recipient TEXT,
    total_amount NUMERIC DEFAULT 0,
    reason TEXT, -- Thông tin chi tiết DNTT lưu dạng chuỗi JSON
    status TEXT,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);


-- ==========================================
-- 6. BẢNG partner_debts
-- ==========================================
CREATE TABLE IF NOT EXISTS partner_debts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_name TEXT,
    partner_name TEXT,
    debt_type TEXT,
    amount NUMERIC DEFAULT 0,
    note TEXT,
    status TEXT DEFAULT 'CHƯA XONG',
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);


-- ==========================================
-- 7. BẢNG expected_invoices (Đợt thu dự kiến)
-- ==========================================
CREATE TABLE IF NOT EXISTS expected_invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "projectName" TEXT,
    "preTaxValue" NUMERIC,
    "vatAmount" NUMERIC,
    "postTaxValue" NUMERIC,
    "teamValue" NUMERIC,
    "accumulatedAdvance" NUMERIC,
    "teamName" TEXT,
    "team_pdf_url" TEXT,
    "project_pdf_url" TEXT,
    "phase" TEXT,
    "note" TEXT,
    "invoice_month" TEXT,
    "is_completed" BOOLEAN DEFAULT FALSE,
    "deductionAmount" NUMERIC DEFAULT 0,
    "qs_approved" BOOLEAN DEFAULT FALSE,
    "accountant_approved" BOOLEAN DEFAULT FALSE,
    "payment_period" TEXT,
    "account_name" TEXT,
    "account_number" TEXT,
    "bank_name" TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);


-- ==========================================
-- 8. BẢNG notifications
-- ==========================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient_username TEXT,
    recipient_role TEXT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    source_table TEXT,
    source_id TEXT,
    project_name TEXT,
    created_by TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    recipient_deleted BOOLEAN DEFAULT FALSE,
    sender_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS notifications_recipient_username_idx ON notifications (recipient_username);
CREATE INDEX IF NOT EXISTS notifications_recipient_role_idx ON notifications (recipient_role);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications (created_at DESC);


-- ==========================================
-- 9. BẢNG delete_requests
-- ==========================================
CREATE TABLE IF NOT EXISTS delete_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    original_table TEXT NOT NULL,
    record_id TEXT NOT NULL,
    record_name TEXT NOT NULL,
    requested_by TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);


-- ==========================================
-- 10. BẢNG employees (Nhân viên)
-- ==========================================
CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT,
    department TEXT,
    is_department BOOLEAN DEFAULT FALSE,
    is_custom_dept BOOLEAN DEFAULT FALSE,
    basic_salary NUMERIC DEFAULT 0,
    phone_allowance NUMERIC DEFAULT 0,
    parking_allowance NUMERIC DEFAULT 0,
    makeup_allowance NUMERIC DEFAULT 0,
    gondola_allowance NUMERIC DEFAULT 0,
    laptop_allowance NUMERIC DEFAULT 0,
    insurance_salary NUMERIC DEFAULT 0,
    advance NUMERIC DEFAULT 0,
    other_deductions NUMERIC DEFAULT 0,
    other_additions NUMERIC DEFAULT 0,
    cash NUMERIC DEFAULT 0,
    notes TEXT,
    bank_account TEXT,
    bank_account_name TEXT,
    bank_name TEXT,
    attendance JSONB,
    order_index INTEGER,
    leave_balance NUMERIC DEFAULT 0,
    signature_url TEXT
);


-- ==========================================
-- 11. BẢNG salary_history (Lịch sử bảng lương)
-- ==========================================
CREATE TABLE IF NOT EXISTS salary_history (
    month_id TEXT PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    global_standard_days INTEGER,
    employees_data JSONB NOT NULL
);


-- ==========================================
-- 12. BẢNG material_templates (Đơn giá/Bản mẫu vật tư)
-- ==========================================
CREATE TABLE IF NOT EXISTS material_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_name TEXT NOT NULL UNIQUE,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Trigger tự động cập nhật updated_at khi sửa dữ liệu bản mẫu vật tư
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


-- ==========================================
-- 13. BẢNG material_warehouse (Kho vật tư - Nhập/Xuất)
-- ==========================================
CREATE TABLE IF NOT EXISTS material_warehouse (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_name TEXT NOT NULL,
    material_name TEXT NOT NULL,
    color_code TEXT,
    unit TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    transaction_type TEXT NOT NULL, -- 'NHẬP' hoặc 'XUẤT'
    date DATE NOT NULL,
    note TEXT,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    price NUMERIC DEFAULT 0,
    total_value NUMERIC DEFAULT 0,
    price_phase TEXT
);


-- ==========================================
-- 14. BẢNG material_orders (Đơn đặt hàng vật tư)
-- ==========================================
CREATE TABLE IF NOT EXISTS material_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_name TEXT NOT NULL,
    order_phase TEXT NOT NULL,
    order_date DATE NOT NULL,
    address TEXT,
    category TEXT,
    company TEXT,
    recipient TEXT,
    items JSONB NOT NULL,
    show_signature BOOLEAN DEFAULT TRUE,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    invoice_number TEXT,
    invoice_pdf_url TEXT,
    invoice_date TEXT,
    invoices JSONB DEFAULT '[]'
);


-- ==========================================
-- 15. BẢNG activity_logs (Nhật ký hoạt động)
-- ==========================================
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT,
    action_type TEXT,
    module TEXT,
    description TEXT,
    project_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);


-- ==========================================
-- CẤU HÌNH BẢO MẬT & PHÂN QUYỀN (RLS)
-- Để đơn giản hóa kết nối từ Client, tắt RLS hoặc cấp quyền ALL
-- ==========================================
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE incomes DISABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE partner_debts DISABLE ROW LEVEL SECURITY;
ALTER TABLE expected_invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE delete_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE salary_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE material_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE material_warehouse DISABLE ROW LEVEL SECURITY;
ALTER TABLE material_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;


-- ==========================================
-- KÍCH HOẠT REALTIME CHO CÁC BẢNG CẦN THIẾT
-- ==========================================
BEGIN;
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      CREATE PUBLICATION supabase_realtime;
    END IF;
  END
  $$;

  DO $$
  DECLARE
    tbl text;
    tbl_names text[] := ARRAY[
      'approval_requests',
      'transactions',
      'incomes',
      'material_orders',
      'partner_debts',
      'notifications',
      'delete_requests'
    ];
  BEGIN
    FOREACH tbl IN ARRAY tbl_names LOOP
      IF to_regclass('public.' || tbl) IS NOT NULL
         AND NOT EXISTS (
          SELECT 1
          FROM pg_publication_tables
          WHERE pubname = 'supabase_realtime'
            AND schemaname = 'public'
            AND tablename = tbl
        ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
      END IF;
    END LOOP;
  END
  $$;
COMMIT;
