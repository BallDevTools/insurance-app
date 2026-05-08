CREATE TABLE IF NOT EXISTS admin_users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(200) DEFAULT NULL,
  role          ENUM('superadmin','agent','affiliate') NOT NULL DEFAULT 'agent',
  affiliate_id  INT DEFAULT NULL,
  last_login    DATETIME DEFAULT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
