import { Shield, Users, Star } from 'lucide-react';

export function TrustStrip() {
  const insurers = [
    'วิริยะ',
    'กรุงเทพประกันภัย',
    'เมืองไทยประกันภัย',
    'AXA',
    'AIG',
    'Allianz'
  ];

  return (
    <div className="bg-white border-y border-[#E9E3D7] py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 sm:gap-8 mb-8 sm:mb-12">
          <div className="text-center">
            <div className="flex justify-center mb-2 text-[#153C3C]">
              <Shield size={32} />
            </div>
            <div className="text-2xl sm:text-3xl mb-1" style={{ fontWeight: 700 }}>12+</div>
            <div className="text-sm text-[#6F766E]">บริษัทประกันชั้นนำ</div>
          </div>
          <div className="text-center">
            <div className="flex justify-center mb-2 text-[#153C3C]">
              <Users size={32} />
            </div>
            <div className="text-2xl sm:text-3xl mb-1" style={{ fontWeight: 700 }}>50,000+</div>
            <div className="text-sm text-[#6F766E]">ลูกค้าที่ไว้วางใจ</div>
          </div>
          <div className="text-center">
            <div className="flex justify-center mb-2 text-[#153C3C]">
              <Star size={32} />
            </div>
            <div className="text-2xl sm:text-3xl mb-1" style={{ fontWeight: 700 }}>4.8/5</div>
            <div className="text-sm text-[#6F766E]">คะแนนรีวิว</div>
          </div>
        </div>

        {/* Insurer Logos */}
        <div className="border-t border-[#E9E3D7] pt-8">
          <p className="text-center text-[#6F766E] mb-6">บริษัทประกันภัยชั้นนำที่ร่วมงานกับเรา</p>
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            {insurers.map((name, idx) => (
              <div
                key={idx}
                className="flex items-center justify-center px-4 sm:px-6 py-2 sm:py-3 bg-[#F7F4EE] rounded-lg text-[#153C3C] min-w-[100px] sm:min-w-[120px]"
              >
                <span style={{ fontWeight: 600 }}>{name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
