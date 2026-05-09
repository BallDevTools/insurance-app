-- Living Bot: Knowledge Base + Unknown Queue
CREATE TABLE IF NOT EXISTS bot_knowledge (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category VARCHAR(100) DEFAULT 'ทั่วไป',
  question_sample TEXT NOT NULL,
  keywords TEXT NOT NULL,
  answer TEXT NOT NULL,
  match_count INT DEFAULT 0,
  is_active TINYINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bot_unknowns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message TEXT NOT NULL,
  frequency INT DEFAULT 1,
  status ENUM('pending','taught','ignored') DEFAULT 'pending',
  taught_knowledge_id INT,
  last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed: ตัวอย่าง Knowledge เริ่มต้น
INSERT INTO bot_knowledge (category, question_sample, keywords, answer) VALUES
('ความคุ้มครอง', 'ประกันชั้น 1 คุ้มครองอะไรบ้าง', 'ชั้น1,ประกันชั้น1,class1,ชั้นหนึ่ง',
 'ประกันชั้น 1 คุ้มครองครบทุกกรณีครับ\n• ชนทั้งฝ่ายเราและคู่กรณี\n• ไฟไหม้ / น้ำท่วม\n• โจรกรรม\n• ภัยธรรมชาติ\nเหมาะกับรถใหม่ อายุไม่เกิน 5 ปีครับ 🛡️'),
('ความคุ้มครอง', 'ประกันชั้น 2+ ต่างจากชั้น 1 ยังไง', 'ชั้น2+,ชั้นสอง,2+,class2plus,class2+',
 'ประกันชั้น 2+ คุ้มครองครับ\n• รถคู่กรณีเมื่อเราเป็นฝ่ายชน\n• รถเราเมื่อถูกชน / ชนกับสัตว์\n• ไฟไหม้ / โจรกรรม\n⚠️ ไม่คุ้มครองน้ำท่วมครับ'),
('ความคุ้มครอง', 'ประกันชั้น 3+ คืออะไร', 'ชั้น3+,สามพลัส,3+,class3plus,class3+',
 'ประกันชั้น 3+ คุ้มครองครับ\n• รถคู่กรณีเมื่อเราเป็นฝ่ายชน\n• รถเราเมื่อถูกชน (จากรถยนต์เท่านั้น)\n⚠️ ไม่คุ้มครองไฟไหม้ โจรกรรม น้ำท่วม\nเหมาะกับรถเก่า ราคาประหยัดครับ 👍'),
('การเคลม', 'เคลมประกันยังไง ทำอย่างไร', 'เคลม,แจ้งเคลม,อุบัติเหตุ,ชน,ถูกชน,เสียหาย',
 'แจ้งเคลมได้เลยครับ 📞\n1. ถ่ายรูปความเสียหายไว้ก่อน\n2. แจ้งเบอร์โทรศัพท์ในกรมธรรม์\n3. รอเจ้าหน้าที่ประเมินความเสียหาย\n\nหากต้องการให้เจ้าหน้าที่ช่วย พิมพ์ "ติดต่อเจ้าหน้าที่" ได้เลยครับ'),
('ทั่วไป', 'พรบ คืออะไร', 'พรบ,พรบ.,ประกันภาคบังคับ,ภาคบังคับ',
 'พรบ. หรือประกันภาคบังคับ คือประกันที่รถทุกคันต้องมีตามกฎหมายครับ\n• คุ้มครองค่ารักษาพยาบาลเบื้องต้น ทั้งผู้ขับขี่และผู้เสียหาย\n• ไม่คุ้มครองทรัพย์สิน\nแนะนำทำควบคู่กับประกันชั้น 1-3 ครับ 🛡️');
