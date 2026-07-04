-- SQL migration to update notifications table schema
-- Run this in your Supabase SQL editor

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS recipient_deleted BOOLEAN DEFAULT false;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sender_deleted BOOLEAN DEFAULT false;
