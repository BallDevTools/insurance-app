-- เพิ่ม affiliate_id ใน app_settings เพื่อรองรับ per-affiliate settings
-- affiliate_id = 0 = global (superadmin), affiliate_id = N = ของ affiliate นั้น

ALTER TABLE app_settings
  DROP PRIMARY KEY,
  ADD COLUMN affiliate_id INT NOT NULL DEFAULT 0 AFTER `key`,
  ADD PRIMARY KEY (`key`, `affiliate_id`);
