-- SQL Migration: Add invoice columns to material_orders table
ALTER TABLE material_orders 
ADD COLUMN IF NOT EXISTS invoice_number TEXT,
ADD COLUMN IF NOT EXISTS invoice_pdf_url TEXT,
ADD COLUMN IF NOT EXISTS invoice_date TEXT,
ADD COLUMN IF NOT EXISTS invoices JSONB DEFAULT '[]';
