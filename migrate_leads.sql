-- Migration: New leads table + LINE/Facebook settings
-- Run after all existing migrations

USE insurance_db;

-- ตาราง Leads ใหม่ (รวม UTM + click tracking + status workflow)
CREATE TABLE IF NOT EXISTS leads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  token VARCHAR(32) UNIQUE NOT NULL,
  source ENUM('organic','line_ads','facebook_ads','google','other') DEFAULT 'organic',
  utm_campaign VARCHAR(200) DEFAULT NULL,
  utm_medium   VARCHAR(100) DEFAULT NULL,
  utm_content  VARCHAR(200) DEFAULT NULL,
  brand        VARCHAR(100) NOT NULL,
  model        VARCHAR(100) NOT NULL,
  model_id     INT DEFAULT NULL,
  year         SMALLINT NOT NULL,
  license_plate VARCHAR(20) NOT NULL,
  province     VARCHAR(100) NOT NULL,
  insurance_type ENUM('class1','class2plus','class3plus') NOT NULL,
  name         VARCHAR(200) DEFAULT NULL,
  phone        VARCHAR(20)  DEFAULT NULL,
  best_price   DECIMAL(10,2) DEFAULT NULL,
  packages_json JSON,
  clicked_line     TINYINT(1) DEFAULT 0,
  clicked_facebook TINYINT(1) DEFAULT 0,
  status ENUM('new','contacted','converted','lost') DEFAULT 'new',
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_token   (token),
  INDEX idx_status  (status),
  INDEX idx_source  (source),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- เพิ่ม human_first state ใน line_sessions
ALTER TABLE line_sessions
  MODIFY COLUMN state ENUM('human_first','bot','handoff') DEFAULT 'human_first';

-- Update existing 'bot' sessions to 'human_first' (optional — ปรับตามต้องการ)
-- UPDATE line_sessions SET state = 'human_first' WHERE state = 'bot';

-- เพิ่ม settings: LINE OA URL, Facebook URL, LINE Admin User ID
INSERT INTO app_settings (`key`, `value`) VALUES
  ('line_oa_url',        'https://lin.ee/oirnjZs'),
  ('facebook_url',       'https://m.me/'),
  ('line_admin_user_id', 'U5f999266d3fc5370a40bb8262ef8cc96')
ON DUPLICATE KEY UPDATE `key` = `key`;
