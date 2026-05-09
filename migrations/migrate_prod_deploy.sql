-- migrate_prod_deploy.sql
-- Production deploy: UTM + IP tracking + Affiliate + supporting tables
-- Compatible with MySQL 5.7+ (no ADD COLUMN IF NOT EXISTS)

-- Helper procedure: add column only if not exists
DROP PROCEDURE IF EXISTS _add_col;
DELIMITER //
CREATE PROCEDURE _add_col(IN tbl VARCHAR(64), IN col VARCHAR(64), IN def TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col
  ) THEN
    SET @_sql = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', def);
    PREPARE _stmt FROM @_sql;
    EXECUTE _stmt;
    DEALLOCATE PREPARE _stmt;
  END IF;
END //
DELIMITER ;

-- =========================================================
-- 1. LEADS — UTM Attribution
-- =========================================================
CALL _add_col('leads', 'utm_campaign',  'VARCHAR(200) DEFAULT NULL');
CALL _add_col('leads', 'utm_medium',    'VARCHAR(100) DEFAULT NULL');
CALL _add_col('leads', 'utm_content',   'VARCHAR(200) DEFAULT NULL');

-- =========================================================
-- 2. LEADS — IP Tracking
-- =========================================================
CALL _add_col('leads', 'visitor_id',    'VARCHAR(36) DEFAULT NULL');
CALL _add_col('leads', 'ip_address',    'VARCHAR(45) DEFAULT NULL');
CALL _add_col('leads', 'ip_country',    'VARCHAR(10) DEFAULT NULL');
CALL _add_col('leads', 'ip_city',       'VARCHAR(100) DEFAULT NULL');
CALL _add_col('leads', 'ip_isp',        'VARCHAR(200) DEFAULT NULL');
CALL _add_col('leads', 'ip_mobile',     'TINYINT(1) DEFAULT NULL');
CALL _add_col('leads', 'ip_proxy',      'TINYINT(1) DEFAULT NULL');
CALL _add_col('leads', 'ip_geo',        'JSON DEFAULT NULL');
CALL _add_col('leads', 'query_params',  'JSON DEFAULT NULL');

-- =========================================================
-- 3. LEADS — Funnel + Partial + Package
-- =========================================================
CALL _add_col('leads', 'partial_token', 'VARCHAR(32) DEFAULT NULL');
CALL _add_col('leads', 'best_price',    'DECIMAL(10,2) DEFAULT NULL');
CALL _add_col('leads', 'packages_json', 'JSON DEFAULT NULL');
CALL _add_col('leads', 'lead_type',     "ENUM('standard','concierge') DEFAULT 'standard'");

-- funnel_stage: MODIFY if exists (เพิ่ม partial ใน ENUM)
DROP PROCEDURE IF EXISTS _mod_funnel;
DELIMITER //
CREATE PROCEDURE _mod_funnel()
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leads' AND COLUMN_NAME = 'funnel_stage'
  ) THEN
    ALTER TABLE leads MODIFY COLUMN funnel_stage ENUM('cold','warm','hot','partial') DEFAULT 'hot';
  ELSE
    ALTER TABLE leads ADD COLUMN funnel_stage ENUM('cold','warm','hot','partial') DEFAULT 'hot';
  END IF;
END //
DELIMITER ;
CALL _mod_funnel();
DROP PROCEDURE IF EXISTS _mod_funnel;

-- =========================================================
-- 4. LEADS — Affiliate + Commission
-- =========================================================
CALL _add_col('leads', 'affiliate_id',       'INT DEFAULT NULL');
CALL _add_col('leads', 'commission_amount',  'DECIMAL(10,2) DEFAULT NULL');
CALL _add_col('leads', 'commission_paid',    'TINYINT(1) DEFAULT 0');
CALL _add_col('leads', 'commission_paid_at', 'TIMESTAMP NULL DEFAULT NULL');

-- source ENUM: add 'other' option
ALTER TABLE leads
  MODIFY COLUMN source ENUM('organic','line_ads','facebook_ads','google','other') DEFAULT 'organic';

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
-- 6. ADMIN_USERS — Affiliate role + affiliate_id
-- =========================================================
ALTER TABLE admin_users
  MODIFY COLUMN role ENUM('superadmin','agent','affiliate') NOT NULL DEFAULT 'agent';
CALL _add_col('admin_users', 'affiliate_id', 'INT DEFAULT NULL');

-- =========================================================
-- 7. APP_SETTINGS — Per-affiliate PK change (conditional)
-- =========================================================
DROP PROCEDURE IF EXISTS _migrate_settings_aff;
DELIMITER //
CREATE PROCEDURE _migrate_settings_aff()
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
CALL _migrate_settings_aff();
DROP PROCEDURE IF EXISTS _migrate_settings_aff;

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
-- Cleanup helper procedure
-- =========================================================
DROP PROCEDURE IF EXISTS _add_col;

SELECT 'migrate_prod_deploy.sql complete' AS status;
