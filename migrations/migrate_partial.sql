-- Migration: Partial lead capture
USE insurance_db;

ALTER TABLE leads
  ADD COLUMN partial_token VARCHAR(32) NULL UNIQUE AFTER token,
  ADD INDEX idx_partial_token (partial_token);
