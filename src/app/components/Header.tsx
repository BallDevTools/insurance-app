import { MessageCircle, Menu, X } from 'lucide-react';
import { useState } from 'react';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-[#FFFFFF] border-b border-[#E9E3D7] shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-[#153C3C] to-[#2D6A6A] rounded-xl flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="white" opacity="0.9"/>
                <path d="M2 17L12 22L22 17V12L12 17L2 12V17Z" fill="white" opacity="0.6"/>
              </svg>
            </div>
            <span className="font-semibold text-lg sm:text-xl text-[#153C3C]">ประกันรถดีดี</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#" className="text-[#6F766E] hover:text-[#153C3C] transition-colors">เกี่ยวกับเรา</a>
            <a href="#" className="text-[#6F766E] hover:text-[#153C3C] transition-colors">บริษัทประกันชั้นนำ</a>
            <a href="#" className="text-[#6F766E] hover:text-[#153C3C] transition-colors">คำถามที่พบบ่อย</a>
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-4">
            <button className="flex items-center gap-2 px-6 py-3 bg-[#06C755] hover:bg-[#05b24b] text-white rounded-xl transition-all duration-200 shadow-sm hover:shadow-md">
              <MessageCircle size={20} />
              <span>ติดต่อทาง LINE</span>
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-[#153C3C]"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#E9E3D7] py-4 space-y-4 animate-in slide-in-from-top-4 duration-300">
            <a href="#" className="block text-[#6F766E] hover:text-[#153C3C] transition-colors">เกี่ยวกับเรา</a>
            <a href="#" className="block text-[#6F766E] hover:text-[#153C3C] transition-colors">บริษัทประกันชั้นนำ</a>
            <a href="#" className="block text-[#6F766E] hover:text-[#153C3C] transition-colors">คำถามที่พบบ่อย</a>
            <button className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#06C755] text-white rounded-xl">
              <MessageCircle size={20} />
              <span>ติดต่อทาง LINE</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
