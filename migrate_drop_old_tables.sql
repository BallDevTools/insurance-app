-- Migration: ลบตาราง car_brands / car_models (ไม่ใช้แล้ว)
-- ระบบใช้ scraped_brands / scraped_models / scraped_packages แทน
-- Run: mysql -u root -p insurance_db < migrate_drop_old_tables.sql

USE insurance_db;

DROP TABLE IF EXISTS car_models;
DROP TABLE IF EXISTS car_brands;
