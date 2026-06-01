-- Run this script in your Supabase SQL Editor
-- This adds a JSONB column to the projects table to store an array of additional Contract Appendices (Phụ lục hợp đồng)
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS plhds jsonb DEFAULT '[]'::jsonb;
