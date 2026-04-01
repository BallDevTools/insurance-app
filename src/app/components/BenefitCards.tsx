import { Zap, Clock, ShieldCheck } from 'lucide-react';

export function BenefitCards() {
  const benefits = [
    {
      icon: <Zap size={32} />,
      title: 'เช็คราคาใน 30 วินาที',
      description: 'เพียงเลือกรถและดูราคาจากหลายบริษัท ไม่ต้องรอนาน ไม่ต้องกรอกข้อมูลเยอะ'
    },
    {
      icon: <ShieldCheck size={32} />,
      title: 'เปรียบเทียบแผนประกันชั้นนำ',
      description: 'เราคัดสรรแผนประกันจากบริษัทชั้นนำ มีคุณภาพ ราคาใสสะอาด ครบจบในที่เดียว'
    },
    {
      icon: <Clock size={32} />,
      title: 'ขอใบเสนอราคาภายใน 5 นาที',
      description: 'ส่งข้อมูลผ่าน LINE หรือโทร ทีมเราจะส่งใบเสนอราคาเต็มให้ภายใน 5 นาที'
    }
  ];

  return (
    <section className="py-16 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="mb-4" style={{ fontSize: '2rem', fontWeight: 700 }}>ทำไมต้องเลือกเรา</h2>
          <p className="text-[#6F766E] max-w-2xl mx-auto">
            เราทำให้การเลือกประกันรถง่ายและรวดเร็ว ไม่มีค่าธรรมเนียมซ่อนเร้น
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {benefits.map((benefit, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl p-8 border border-[#E9E3D7] hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-[#153C3C] to-[#2D6A6A] rounded-2xl flex items-center justify-center text-white mb-6">
                {benefit.icon}
              </div>
              <h3 className="mb-3" style={{ fontWeight: 600 }}>{benefit.title}</h3>
              <p className="text-[#6F766E] leading-relaxed">{benefit.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
