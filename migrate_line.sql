-- LINE Bot tables migration
-- Run after migrate_admin.sql

CREATE TABLE IF NOT EXISTS line_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  line_user_id VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(200),
  picture_url VARCHAR(500),
  state ENUM('bot','handoff') DEFAULT 'bot',
  context JSON,
  last_message TEXT,
  ask_count INT DEFAULT 0,
  handoff_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS line_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  line_user_id VARCHAR(100) NOT NULL,
  direction ENUM('in','out') NOT NULL,
  message TEXT NOT NULL,
  sent_by VARCHAR(100) DEFAULT 'bot',  -- 'bot' | 'ai' | 'admin:{username}'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (line_user_id),
  INDEX idx_created (created_at)
);
