-- Migration: Concierge lead type
USE insurance_db;

ALTER TABLE leads
  ADD COLUMN lead_type ENUM('quote','concierge') NOT NULL DEFAULT 'quote'
  AFTER funnel_stage;
