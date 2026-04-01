import { MessageCircle, Phone, Check, Car, Calendar, ShieldCheck } from 'lucide-react';

interface ResultsPageProps {
  carData?: any;
}

export function ResultsPage({ carData }: ResultsPageProps) {
  const packages = [
    {
      company: 'วิริยะประกันภัย',
      type: 'ชั้น 1',
      badge: 'คุ้มสุด',
      price: '14,800',
      originalPrice: '16,500',
      features: [
        'ซ่อมศูนย์ได้',
        'คุ้มครองรถยนต์เต็มมูลค่า',
        'รับผิดชอบบุคคลภายนอก 1,000,000 บาท',
        'อุบัติเหตุส่วนบุคคล 500,000 บาท',
        'รถเช่าทดแทน 3,000 บาท/วัน'
      ],
      featured: false
    },
    {
      company: 'กรุงเทพประกันภัย',
      type: 'ชั้น 1',
      badge: 'แนะนำ',
      price: '15,500',
      originalPrice: '17,000',
      features: [
        'ซ่อมศูนย์ได้',
        'คุ้มครองรถยนต์เต็มมูลค่า',
        'รับผิดชอบบุคคลภายนอก 1,000,000 บาท',
        'อุบัติเหตุส่วนบุคคล 500,000 บาท',
        'รถเช่าทดแทน 5,000 บาท/วัน',
        'ฟรี! ประกันตัวผู้ขับขี่'
      ],
      featured: true
    },
    {
      company: 'เมืองไทยประกันภัย',
      type: 'ชั้น 1',
      badge: 'พรีเมียม',
      price: '18,900',
      originalPrice: '20,500',
      features: [
        'ซ่อมศูนย์ได้',
        'คุ้มครองรถยนต์เต็มมูลค่า',
        'รับผิดชอบบุคคลภายนอก 2,000,000 บาท',
        'อุบัติเหตุส่วนบุคคล 1,000,000 บาท',
        'รถเช่าทดแทน 7,000 บาท/วัน',
        'ฟรี! ประกันตัวผู้ขับขี่ + ผู้โดยสาร'
      ],
      featured: false
    }
  ];

  return (
    <div className="min-h-screen bg-[#F7F4EE]">
      {/* Summary Card */}
      <div className="bg-white border-b border-[#E9E3D7] py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="mb-6" style={{ fontSize: '1.75rem', fontWeight: 700 }}>เรามีแผนประกันที่เหมาะกับคุณ</h2>

          <div className="bg-gradient-to-br from-[#153C3C] to-[#2D6A6A] rounded-2xl p-6 sm:p-8 text-white">
            <div className="grid sm:grid-cols-3 gap-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Car size={24} />
                </div>
                <div>
                  <div className="text-sm opacity-80">รถของคุณ</div>
                  <div style={{ fontWeight: 600 }}>Toyota Camry</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Calendar size={24} />
                </div>
                <div>
                  <div className="text-sm opacity-80">ปีรถ</div>
                  <div style={{ fontWeight: 600 }}>2025</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <div className="text-sm opacity-80">ประเภทประกัน</div>
                  <div style={{ fontWeight: 600 }}>ชั้น 1</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="lg:grid lg:grid-cols-3 lg:gap-8">
          {/* Package Cards */}
          <div className="lg:col-span-2 space-y-6 mb-8 lg:mb-0">
            {packages.map((pkg, idx) => (
              <div
                key={idx}
                className={`bg-white rounded-2xl p-6 sm:p-8 border-2 transition-all duration-300 hover:shadow-xl ${
                  pkg.featured
                    ? 'border-[#D6A85F] shadow-lg relative'
                    : 'border-[#E9E3D7]'
                }`}
              >
                {pkg.featured && (
                  <div className="absolute -top-4 left-6 px-6 py-2 bg-gradient-to-r from-[#D6A85F] to-[#C09850] text-white rounded-full text-sm shadow-lg" style={{ fontWeight: 600 }}>
                    {pkg.badge}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                  <div>
                    <h3 className="mb-1" style={{ fontWeight: 600 }}>{pkg.company}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[#6F766E]">{pkg.type}</span>
                      {!pkg.featured && (
                        <span className="px-3 py-1 bg-[#F7F4EE] text-[#6F766E] rounded-full text-xs" style={{ fontWeight: 500 }}>
                          {pkg.badge}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-[#6F766E] line-through">{pkg.originalPrice} บาท</div>
                    <div className="flex items-baseline gap-1">
                      <span style={{ fontSize: '2rem', fontWeight: 700 }} className="text-[#153C3C]">{pkg.price}</span>
                      <span className="text-[#6F766E]">บาท/ปี</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  {pkg.features.map((feature, fidx) => (
                    <div key={fidx} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-[#E8F5E9] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check size={14} className="text-[#2E7D32]" />
                      </div>
                      <span className="text-[#2B2B2B]">{feature}</span>
                    </div>
                  ))}
                </div>

                <button
                  className={`w-full px-6 py-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${
                    pkg.featured
                      ? 'bg-[#06C755] hover:bg-[#05b24b] text-white shadow-lg hover:shadow-xl'
                      : 'bg-[#153C3C] hover:bg-[#2D6A6A] text-white'
                  }`}
                >
                  <MessageCircle size={20} />
                  <span style={{ fontWeight: 600 }}>รับรายละเอียดทาง LINE</span>
                </button>
              </div>
            ))}
          </div>

          {/* Contact Panel - Desktop */}
          <div className="hidden lg:block">
            <div className="sticky top-24 bg-white rounded-2xl p-6 border border-[#E9E3D7] shadow-lg">
              <h3 className="mb-4" style={{ fontWeight: 600 }}>ต้องการความช่วยเหลือ?</h3>
              <p className="text-[#6F766E] mb-6 text-sm">
                ทีมเราพร้อมให้คำปรึกษาและช่วยเลือกแผนที่เหมาะกับคุณ
              </p>

              <div className="space-y-3">
                <button className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#06C755] hover:bg-[#05b24b] text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl">
                  <MessageCircle size={20} />
                  <span style={{ fontWeight: 600 }}>ติดต่อทาง LINE</span>
                </button>
                <button className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#153C3C] hover:bg-[#2D6A6A] text-white rounded-xl transition-all duration-200">
                  <Phone size={20} />
                  <span style={{ fontWeight: 600 }}>โทร 02-XXX-XXXX</span>
                </button>
              </div>

              <div className="mt-6 pt-6 border-t border-[#E9E3D7]">
                <div className="flex items-center gap-3 text-sm text-[#6F766E]">
                  <div className="w-8 h-8 bg-[#E8F5E9] rounded-full flex items-center justify-center flex-shrink-0">
                    <Check size={14} className="text-[#2E7D32]" />
                  </div>
                  <span>ทีมเราจะติดต่อกลับภายใน 5 นาที</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom CTA */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#E9E3D7] p-4 shadow-2xl z-40">
        <div className="flex gap-3">
          <button className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#153C3C] hover:bg-[#2D6A6A] text-white rounded-xl transition-all duration-200">
            <Phone size={20} />
            <span style={{ fontWeight: 600 }}>โทร</span>
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#06C755] hover:bg-[#05b24b] text-white rounded-xl transition-all duration-200 shadow-lg">
            <MessageCircle size={20} />
            <span style={{ fontWeight: 600 }}>LINE</span>
          </button>
        </div>
      </div>
    </div>
  );
}
