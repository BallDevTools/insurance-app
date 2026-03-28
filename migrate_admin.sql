USE insurance_db;

-- ตาราง Admin Users
CREATE TABLE IF NOT EXISTS admin_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(200) DEFAULT 'Administrator',
  role ENUM('superadmin','agent') DEFAULT 'superadmin',
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ตาราง Notes สำหรับ Lead
CREATE TABLE IF NOT EXISTS lead_notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lead_id INT NOT NULL,
  note TEXT NOT NULL,
  created_by VARCHAR(100) DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES customer_leads(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ตาราง App Settings (key-value)
CREATE TABLE IF NOT EXISTS app_settings (
  `key` VARCHAR(100) PRIMARY KEY,
  `value` TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default insurance rates
INSERT INTO app_settings (`key`, `value`) VALUES
  ('class1_rate',      '0.042'),
  ('class1_min',       '12000'),
  ('class2plus_rate',  '0.022'),
  ('class2plus_min',   '7000'),
  ('class3plus_rate',  '0.010'),
  ('class3plus_min',   '3500'),
  ('site_phone',       '02-xxx-xxxx'),
  ('site_email',       'info@insurance.co.th')
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);
