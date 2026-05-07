-- 1. Extend role ENUM
ALTER TABLE admin_users
  MODIFY COLUMN role ENUM('superadmin','agent','affiliate') NOT NULL DEFAULT 'agent',
  ADD COLUMN affiliate_id INT DEFAULT NULL;

-- 2. Affiliates table
CREATE TABLE IF NOT EXISTS affiliates (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  slug            VARCHAR(50) UNIQUE NOT NULL,
  name            VARCHAR(200) NOT NULL,
  phone           VARCHAR(20) DEFAULT NULL,
  commission_rate DECIMAL(5,2) DEFAULT 0.00,
  is_active       TINYINT(1) DEFAULT 1,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Leads: add affiliate + commission columns
ALTER TABLE leads
  ADD COLUMN affiliate_id      INT DEFAULT NULL,
  ADD COLUMN commission_amount DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN commission_paid   TINYINT(1) DEFAULT 0;
