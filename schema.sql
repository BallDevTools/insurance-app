-- =============================================
-- ระบบประกันรถยนต์ - Database Schema
-- =============================================

CREATE DATABASE IF NOT EXISTS insurance_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE insurance_db;

-- ตารางจังหวัด (ยังใช้สำหรับเก็บข้อมูล quote)
CREATE TABLE IF NOT EXISTS provinces (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  risk_factor DECIMAL(4,2) NOT NULL DEFAULT 1.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ตารางใบเสนอราคา (quotes)
CREATE TABLE IF NOT EXISTS quotes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  quote_number VARCHAR(20) UNIQUE NOT NULL,
  car_brand VARCHAR(100) NOT NULL,
  car_model VARCHAR(100) NOT NULL,
  car_year YEAR NOT NULL,
  license_plate VARCHAR(20) NOT NULL,
  province VARCHAR(100) NOT NULL,
  insurance_type ENUM('class1','class2plus','class3plus') NOT NULL,
  car_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  premium_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  coverage_details JSON,
  status ENUM('pending','contacted','completed','cancelled') DEFAULT 'pending',
  expires_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ตารางข้อมูลลูกค้า (leads)
CREATE TABLE IF NOT EXISTS customer_leads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  quote_id INT NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(200),
  preferred_contact ENUM('phone','email','line') DEFAULT 'phone',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quote_id) REFERENCES quotes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- Seed Data - จังหวัด
-- =============================================
INSERT INTO provinces (name, risk_factor) VALUES
  ('กรุงเทพมหานคร', 1.25),
  ('นนทบุรี', 1.20),
  ('ปทุมธานี', 1.18),
  ('สมุทรปราการ', 1.18),
  ('เชียงใหม่', 1.10),
  ('ขอนแก่น', 1.05),
  ('นครราชสีมา', 1.05),
  ('อุดรธานี', 1.05),
  ('ภูเก็ต', 1.10),
  ('สงขลา', 1.08),
  ('ชลบุรี', 1.12),
  ('ระยอง', 1.10),
  ('เชียงราย', 1.05),
  ('สุราษฎร์ธานี', 1.05),
  ('นครสวรรค์', 1.03),
  ('พิษณุโลก', 1.03),
  ('อื่นๆ', 1.00)
ON DUPLICATE KEY UPDATE risk_factor = VALUES(risk_factor);
