-- เพิ่ม user_agent column ใน leads table
ALTER TABLE leads
  ADD COLUMN user_agent VARCHAR(500) DEFAULT NULL AFTER ip_geo;
