-- Scraper tables migration
-- Run after schema.sql

CREATE TABLE IF NOT EXISTS scraped_brands (
  id INT AUTO_INCREMENT PRIMARY KEY,
  brand_id_724 INT NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS scraped_models (
  id INT AUTO_INCREMENT PRIMARY KEY,
  brand_id INT NOT NULL,
  model_id_724 INT NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  FOREIGN KEY (brand_id) REFERENCES scraped_brands(id)
);

CREATE TABLE IF NOT EXISTS scraped_packages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  model_id INT NOT NULL,
  car_year YEAR NOT NULL,
  insurance_class VARCHAR(10) NOT NULL,
  company_name VARCHAR(200) NOT NULL,
  premium_amount DECIMAL(10,2),
  premium_discounted DECIMAL(10,2),
  coverage JSON,
  source_url VARCHAR(500),
  scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_package (model_id, car_year, insurance_class, company_name),
  FOREIGN KEY (model_id) REFERENCES scraped_models(id)
);

CREATE TABLE IF NOT EXISTS scraper_progress (
  id INT AUTO_INCREMENT PRIMARY KEY,
  model_id_724 INT NOT NULL,
  car_year YEAR NOT NULL,
  status ENUM('pending','done','error') DEFAULT 'pending',
  error_msg VARCHAR(500),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_progress (model_id_724, car_year)
);

CREATE TABLE IF NOT EXISTS scraper_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  run_type ENUM('manual','scheduled') DEFAULT 'scheduled',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP NULL,
  total_scraped INT DEFAULT 0,
  total_errors INT DEFAULT 0,
  status ENUM('running','done','error','stopped') DEFAULT 'running'
);
