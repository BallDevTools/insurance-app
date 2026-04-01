import { Check } from 'lucide-react';

export function PackagePreview() {
  const packages = [
    {
      type: 'ประกันชั้น 1',
      badge: 'คุ้มครองครบ',
      price: '15,000',
      features: [
        'คุ้มครองตัวรถเต็มมูลค่า',
        'ซ่อมศูนย์ได้',
        'รับผิดชอบบุคคลภายนอก',
        'อุบัติเหตุส่วนบุคคล'
      ],
      popular: false
    },
    {
      type: 'ประกันชั้น 2+',
      badge: 'แนะนำ',
      price: '8,500',
      features: [
        'คุ้มครองตัวรถบางส่วน',
        'ซ่อมศูนย์ได้',
        'รับผิดชอบบุคคลภายนอก',
        'อุบัติเหตุส่วนบุคคล'
      ],
      popular: true
    },
    {
      type: 'ประกันชั้น 3+',
      badge: 'ประหยัด',
      price: '3,200',
      features: [
        'รับผิดชอบบุคคลภายนอก',
        'อุบัติเหตุส่วนบุคคล',
        'ราคาประหยัด',
        'เหมาะสำหรับรถเก่า'
      ],
      popular: false
    }
  ];

  return (
    <section className="py-16 sm:py-24 bg-gradient-to-b from-white to-[#F7F4EE]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="mb-4" style={{ fontSize: '2rem', fontWeight: 700 }}>เลือกแผนที่เหมาะกับคุณ</h2>
          <p className="text-[#6F766E] max-w-2xl mx-auto">
            เราคัดสรรแผนประกันจากบริษัทชั้นนำ ให้คุณเลือกได้ตามงบและความต้องการ
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
          {packages.map((pkg, idx) => (
            <div
              key={idx}
              className={`bg-white rounded-2xl p-6 sm:p-8 border-2 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl ${
                pkg.popular
                  ? 'border-[#D6A85F] shadow-xl relative'
                  : 'border-[#E9E3D7] hover:border-[#153C3C]'
              }`}
            >
              {pkg.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-2 bg-gradient-to-r from-[#D6A85F] to-[#C09850] text-white rounded-full text-sm shadow-lg" style={{ fontWeight: 600 }}>
                  {pkg.badge}
                </div>
              )}
              {!pkg.popular && (
                <div className="text-center mb-4">
                  <span className="px-4 py-1 bg-[#F7F4EE] text-[#6F766E] rounded-full text-sm" style={{ fontWeight: 500 }}>
                    {pkg.badge}
                  </span>
                </div>
              )}

              <div className={`text-center ${pkg.popular ? 'mt-4' : ''}`}>
                <h3 className="mb-2" style={{ fontWeight: 600 }}>{pkg.type}</h3>
                <div className="mb-6">
                  <span className="text-[#6F766E]">เริ่มต้น</span>
                  <div className="flex items-baseline justify-center gap-1 mt-1">
                    <span style={{ fontSize: '2.5rem', fontWeight: 700 }} className="text-[#153C3C]">{pkg.price}</span>
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
                className={`w-full px-6 py-3 rounded-xl transition-all duration-200 ${
                  pkg.popular
                    ? 'bg-[#153C3C] text-white hover:bg-[#2D6A6A] shadow-lg hover:shadow-xl'
                    : 'bg-[#F7F4EE] text-[#153C3C] hover:bg-[#E9E3D7]'
                }`}
              >
                ดูรายละเอียด
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
