CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT,
    department TEXT,
    is_department BOOLEAN DEFAULT false,
    is_custom_dept BOOLEAN DEFAULT false,
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
    order_index INTEGER
);

CREATE TABLE IF NOT EXISTS salary_history (
    month_id TEXT PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    global_standard_days INTEGER,
    employees_data JSONB NOT NULL
);
