-- Migration: Security & UX improvements
-- Run this after schema.sql + migrate_admin.sql

-- Add expires_at to quotes (30 days from creation for Quote Expiry feature)
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS expires_at DATETIME NULL AFTER coverage_details;

-- Update existing quotes to have expiry 30 days from created_at
UPDATE quotes SET expires_at = DATE_ADD(created_at, INTERVAL 30 DAY) WHERE expires_at IS NULL;

-- Add line_message_id to line_messages for idempotency
ALTER TABLE line_messages
  ADD COLUMN IF NOT EXISTS line_message_id VARCHAR(50) NULL AFTER sent_by,
  ADD INDEX IF NOT EXISTS idx_line_msg_id (line_message_id);
