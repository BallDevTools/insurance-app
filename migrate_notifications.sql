-- Migration: Notifications table for admin badge system
-- Run after migrate_leads.sql

USE insurance_db;

CREATE TABLE IF NOT EXISTS notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  type       ENUM('new_lead','new_line_message') NOT NULL,
  ref_id     INT DEFAULT 0,
  is_read    TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_type_read (type, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
