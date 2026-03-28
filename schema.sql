-- =============================================
-- ระบบประกันรถยนต์ - Database Schema
-- =============================================

CREATE DATABASE IF NOT EXISTS insurance_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE insurance_db;

-- ตารางยี่ห้อรถ
CREATE TABLE IF NOT EXISTS car_brands (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ตารางรุ่นรถ
CREATE TABLE IF NOT EXISTS car_models (
  id INT AUTO_INCREMENT PRIMARY KEY,
  brand_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  base_value DECIMAL(12,2) NOT NULL DEFAULT 500000.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (brand_id) REFERENCES car_brands(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ตารางจังหวัด
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
  car_value DECIMAL(12,2) NOT NULL,
  premium_amount DECIMAL(10,2) NOT NULL,
  coverage_details JSON,
  status ENUM('pending','contacted','completed','cancelled') DEFAULT 'pending',
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
-- Seed Data - ยี่ห้อรถ
-- =============================================
INSERT INTO car_brands (name) VALUES
  ('Toyota'),
  ('Honda'),
  ('Isuzu'),
  ('Mazda'),
  ('Ford'),
  ('Mitsubishi'),
  ('Nissan'),
  ('Suzuki'),
  ('BMW'),
  ('Mercedes-Benz'),
  ('Chevrolet'),
  ('MG'),
  ('BYD'),
  ('Volvo'),
  ('Hyundai')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Seed Data - รุ่นรถ (Toyota)
INSERT INTO car_models (brand_id, name, base_value) VALUES
  (1, 'Camry', 1200000),
  (1, 'Corolla', 950000),
  (1, 'Yaris', 650000),
  (1, 'Fortuner', 1500000),
  (1, 'Hilux Revo', 900000),
  (1, 'CHR', 1050000),
  (1, 'RAV4', 1400000),
  (1, 'Alphard', 3500000);

-- Honda
INSERT INTO car_models (brand_id, name, base_value) VALUES
  (2, 'Civic', 1050000),
  (2, 'City', 780000),
  (2, 'HR-V', 1100000),
  (2, 'CR-V', 1400000),
  (2, 'Accord', 1350000),
  (2, 'Jazz', 680000),
  (2, 'WR-V', 890000);

-- Isuzu
INSERT INTO car_models (brand_id, name, base_value) VALUES
  (3, 'D-Max', 850000),
  (3, 'MU-X', 1200000);

-- Mazda
INSERT INTO car_models (brand_id, name, base_value) VALUES
  (4, 'Mazda2', 720000),
  (4, 'Mazda3', 1050000),
  (4, 'CX-5', 1350000),
  (4, 'CX-8', 1800000);

-- Ford
INSERT INTO car_models (brand_id, name, base_value) VALUES
  (5, 'Ranger', 950000),
  (5, 'Everest', 1700000);

-- Mitsubishi
INSERT INTO car_models (brand_id, name, base_value) VALUES
  (6, 'Triton', 850000),
  (6, 'Pajero Sport', 1450000),
  (6, 'Attrage', 620000),
  (6, 'Eclipse Cross', 1200000);

-- Nissan
INSERT INTO car_models (brand_id, name, base_value) VALUES
  (7, 'Navara', 850000),
  (7, 'Terra', 1400000),
  (7, 'Almera', 680000);

-- Suzuki
INSERT INTO car_models (brand_id, name, base_value) VALUES
  (8, 'Swift', 650000),
  (8, 'Ciaz', 720000),
  (8, 'Vitara', 950000),
  (8, 'Ertiga', 780000);

-- BMW
INSERT INTO car_models (brand_id, name, base_value) VALUES
  (9, 'Series 3', 2500000),
  (9, 'Series 5', 3800000),
  (9, 'X1', 2200000),
  (9, 'X3', 3200000),
  (9, 'X5', 5000000);

-- Mercedes-Benz
INSERT INTO car_models (brand_id, name, base_value) VALUES
  (10, 'C-Class', 2800000),
  (10, 'E-Class', 4500000),
  (10, 'GLA', 2600000),
  (10, 'GLC', 3500000);

-- MG
INSERT INTO car_models (brand_id, name, base_value) VALUES
  (12, 'MG3', 590000),
  (12, 'MG5', 780000),
  (12, 'ZS', 890000),
  (12, 'HS', 1150000);

-- BYD
INSERT INTO car_models (brand_id, name, base_value) VALUES
  (13, 'Dolphin', 950000),
  (13, 'Atto 3', 1150000),
  (13, 'Seal', 1450000);

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
  ('อื่นๆ', 1.00);
