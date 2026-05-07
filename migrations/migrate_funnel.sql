-- Migration: Funnel stage for leads
USE insurance_db;

ALTER TABLE leads
  ADD COLUMN funnel_stage ENUM('cold','warm','hot') NOT NULL DEFAULT 'hot'
  AFTER insurance_type,
  ADD INDEX idx_funnel (funnel_stage);

-- leads ที่มีอยู่ทั้งหมดมาจาก full form submit → hot
UPDATE leads SET funnel_stage = 'hot' WHERE funnel_stage = 'hot';
