-- migrate_prod_deploy.sql
-- Production deploy: UTM columns + IP tracking + Affiliate system + supporting tables
-- Safe to run: uses IF NOT EXISTS throughout

-- =========================================================
-- 1. LEADS — UTM Attribution columns
-- =========================================================
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS utm_campaign  VARCHAR(200) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS utm_medium    VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS utm_content   VARCHAR(200) DEFAULT NULL;

-- =========================================================
-- 2. LEADS — IP Tracking columns
-- =========================================================
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS visitor_id   VARCHAR(36)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ip_address   VARCHAR(45)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ip_country   VARCHAR(10)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ip_city      VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ip_isp       VARCHAR(200) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ip_mobile    TINYINT(1)   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ip_proxy     TINYINT(1)   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ip_geo       JSON         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS query_params JSON         DEFAULT NULL;

-- =========================================================
-- 3. LEADS — Funnel + Partial + Package columns
-- =========================================================
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS partial_token  VARCHAR(32)   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS funnel_stage   ENUM('cold','warm','hot','partial') DEFAULT 'hot',
  ADD COLUMN IF NOT EXISTS lead_type      ENUM('standard','concierge') DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS best_price     DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS packages_json  JSON          DEFAULT NULL;

-- =========================================================
-- 4. LEADS — Affiliate + Commission columns
-- =========================================================
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS affiliate_id       INT           DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS commission_amount  DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS commission_paid    TINYINT(1)    DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_paid_at TIMESTAMP     NULL DEFAULT NULL;

-- =========================================================
-- 5. AFFILIATES table
-- =========================================================
CREATE TABLE IF NOT EXISTS affiliates (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  slug            VARCHAR(50) UNIQUE NOT NULL,
  name            VARCHAR(200) NOT NULL,
  phone           VARCHAR(20) DEFAULT NULL,
  commission_rate DECIMAL(5,2) DEFAULT 0.00,
  is_active       TINYINT(1) DEFAULT 1,
  click_count     INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- 6. ADMIN_USERS — Affiliate role + affiliate_id column
-- =========================================================
ALTER TABLE admin_users
  MODIFY COLUMN role ENUM('superadmin','agent','affiliate') NOT NULL DEFAULT 'agent';
ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS affiliate_id INT DEFAULT NULL;

-- =========================================================
-- 7. APP_SETTINGS — Per-affiliate support (conditional PK change)
-- =========================================================
DROP PROCEDURE IF EXISTS migrate_settings_aff;
DELIMITER //
CREATE PROCEDURE migrate_settings_aff()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'app_settings'
      AND COLUMN_NAME  = 'affiliate_id'
  ) THEN
    ALTER TABLE app_settings
      DROP PRIMARY KEY,
      ADD COLUMN affiliate_id INT NOT NULL DEFAULT 0 AFTER `key`,
      ADD PRIMARY KEY (`key`, `affiliate_id`);
  END IF;
END //
DELIMITER ;
CALL migrate_settings_aff();
DROP PROCEDURE IF EXISTS migrate_settings_aff;

-- =========================================================
-- 8. NOTIFICATIONS table
-- =========================================================
CREATE TABLE IF NOT EXISTS notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  type       ENUM('new_lead','new_line_message') NOT NULL,
  ref_id     INT DEFAULT NULL,
  message    TEXT,
  is_read    TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_type_read (type, is_read)
);

-- =========================================================
-- 9. LINE tables
-- =========================================================
CREATE TABLE IF NOT EXISTS line_sessions (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  line_user_id VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(200),
  picture_url  TEXT,
  state        ENUM('bot','handoff') DEFAULT 'bot',
  last_message TEXT,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS line_messages (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  line_user_id VARCHAR(100) NOT NULL,
  direction    ENUM('in','out') NOT NULL,
  message      TEXT NOT NULL,
  sent_by      VARCHAR(100) DEFAULT 'bot',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (line_user_id)
);

-- =========================================================
-- 10. SOURCE ENUM — เพิ่ม 'other' option
-- =========================================================
ALTER TABLE leads
  MODIFY COLUMN source ENUM('organic','line_ads','facebook_ads','google','other') DEFAULT 'organic';

-- =========================================================
-- Done
-- =========================================================
SELECT 'migrate_prod_deploy.sql complete' AS status;
