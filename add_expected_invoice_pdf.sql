ALTER TABLE expected_invoices
ADD COLUMN IF NOT EXISTS team_pdf_url TEXT;
