import { Facebook, Instagram, Twitter } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-white border-t border-[#E9E3D7] py-12 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Company Info */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-[#153C3C] to-[#2D6A6A] rounded-xl flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="white" opacity="0.9"/>
                  <path d="M2 17L12 22L22 17V12L12 17L2 12V17Z" fill="white" opacity="0.6"/>
                </svg>
              </div>
              <span className="font-semibold text-lg text-[#153C3C]">ประกันรถดีดี</span>
            </div>
            <p className="text-[#6F766E] text-sm leading-relaxed mb-4">
              เปรียบเทียบและเลือกประกันรถยนต์จากบริษัทชั้นนำ ง่าย รวดเร็ว ใสสะอาด
            </p>
            <div className="flex gap-3">
              <a href="#" className="w-10 h-10 bg-[#F7F4EE] hover:bg-[#E9E3D7] rounded-lg flex items-center justify-center text-[#153C3C] transition-colors">
                <Facebook size={20} />
              </a>
              <a href="#" className="w-10 h-10 bg-[#F7F4EE] hover:bg-[#E9E3D7] rounded-lg flex items-center justify-center text-[#153C3C] transition-colors">
                <Instagram size={20} />
              </a>
              <a href="#" className="w-10 h-10 bg-[#F7F4EE] hover:bg-[#E9E3D7] rounded-lg flex items-center justify-center text-[#153C3C] transition-colors">
                <Twitter size={20} />
              </a>
            </div>
          </div>

          {/* Products */}
          <div>
            <h4 className="mb-4" style={{ fontWeight: 600 }}>ผลิตภัณฑ์</h4>
            <ul className="space-y-3 text-sm text-[#6F766E]">
              <li><a href="#" className="hover:text-[#153C3C] transition-colors">ประกันชั้น 1</a></li>
              <li><a href="#" className="hover:text-[#153C3C] transition-colors">ประกันชั้น 2+</a></li>
              <li><a href="#" className="hover:text-[#153C3C] transition-colors">ประกันชั้น 3+</a></li>
              <li><a href="#" className="hover:text-[#153C3C] transition-colors">เปรียบเทียบแผน</a></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="mb-4" style={{ fontWeight: 600 }}>บริษัท</h4>
            <ul className="space-y-3 text-sm text-[#6F766E]">
              <li><a href="#" className="hover:text-[#153C3C] transition-colors">เกี่ยวกับเรา</a></li>
              <li><a href="#" className="hover:text-[#153C3C] transition-colors">บริษัทคู่ค้า</a></li>
              <li><a href="#" className="hover:text-[#153C3C] transition-colors">บทความ</a></li>
              <li><a href="#" className="hover:text-[#153C3C] transition-colors">ติดต่อเรา</a></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="mb-4" style={{ fontWeight: 600 }}>ช่วยเหลือ</h4>
            <ul className="space-y-3 text-sm text-[#6F766E]">
              <li><a href="#" className="hover:text-[#153C3C] transition-colors">คำถามที่พบบ่อย</a></li>
              <li><a href="#" className="hover:text-[#153C3C] transition-colors">วิธีการชำระเงิน</a></li>
              <li><a href="#" className="hover:text-[#153C3C] transition-colors">นโยบายความเป็นส่วนตัว</a></li>
              <li><a href="#" className="hover:text-[#153C3C] transition-colors">เงื่อนไขการใช้งาน</a></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-[#E9E3D7]">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-[#6F766E]">
            <p>© 2026 ประกันรถดีดี. สงวนลิขสิทธิ์.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-[#153C3C] transition-colors">นโยบายความเป็นส่วนตัว</a>
              <a href="#" className="hover:text-[#153C3C] transition-colors">เงื่อนไขการใช้งาน</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
