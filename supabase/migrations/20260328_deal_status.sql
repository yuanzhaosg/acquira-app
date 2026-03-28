-- Migration: add status, status_updated_at, tags columns to deals table
ALTER TABLE deals ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS tags TEXT;
