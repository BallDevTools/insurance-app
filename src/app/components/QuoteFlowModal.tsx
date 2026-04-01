import { useState } from 'react';
import { X, Check, MessageCircle, Phone } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

interface QuoteFlowModalProps {
  open: boolean;
  onClose: () => void;
  initialData?: any;
}

export function QuoteFlowModal({ open, onClose, initialData }: QuoteFlowModalProps) {
  const [step, setStep] = useState(1);

  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 animate-in fade-in duration-200" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-[#E9E3D7]">
            <div>
              <h3 style={{ fontWeight: 600 }}>เช็คราคาประกันรถ</h3>
              <p className="text-sm text-[#6F766E] mt-1">ขั้นตอนที่ {step} จาก 3</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#F7F4EE] rounded-xl transition-colors"
            >
              <X size={24} className="text-[#6F766E]" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="h-2 bg-[#F7F4EE]">
            <div
              className="h-full bg-gradient-to-r from-[#153C3C] to-[#2D6A6A] transition-all duration-300"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>

          {/* Content */}
          <div className="p-6 sm:p-8 overflow-y-auto max-h-[calc(90vh-140px)]">
            {step === 1 && <Step1 onNext={() => setStep(2)} initialData={initialData} />}
            {step === 2 && <Step2 onNext={() => setStep(3)} onBack={() => setStep(1)} />}
            {step === 3 && <Step3 onClose={onClose} />}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Step1({ onNext, initialData }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2" style={{ fontWeight: 600 }}>ข้อมูลรถของคุณ</h3>
        <p className="text-[#6F766E]">ตรวจสอบข้อมูลรถของคุณ</p>
      </div>

      <div className="bg-[#F7F4EE] rounded-2xl p-6 space-y-4">
        <div className="flex justify-between">
          <span className="text-[#6F766E]">ยี่ห้อ</span>
          <span style={{ fontWeight: 600 }}>{initialData?.brand || 'Toyota'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#6F766E]">รุ่น</span>
          <span style={{ fontWeight: 600 }}>{initialData?.model || 'Camry'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#6F766E]">ปี</span>
          <span style={{ fontWeight: 600 }}>{initialData?.year || '2025'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#6F766E]">ประเภทประกัน</span>
          <span style={{ fontWeight: 600 }}>ชั้น 1</span>
        </div>
      </div>

      <button
        onClick={onNext}
        className="w-full px-6 py-4 bg-[#153C3C] hover:bg-[#2D6A6A] text-white rounded-xl transition-all duration-200 shadow-lg"
      >
        ถัดไป
      </button>
    </div>
  );
}

function Step2({ onNext, onBack }: any) {
  const [selected, setSelected] = useState('standard');

  const options = [
    {
      id: 'basic',
      name: 'แผนประหยัด',
      price: '12,800',
      features: ['ซ่อมอู่ทั่วไป', 'คุ้มครองตัวรถ', 'รับผิดชอบบุคคลภายนอก']
    },
    {
      id: 'standard',
      name: 'แผนมาตรฐาน',
      price: '15,500',
      badge: 'แนะนำ',
      features: ['ซ่อมศูนย์ได้', 'คุ้มครองตัวรถ', 'รับผิดชอบบุคคลภายนอก', 'อุบัติเหตุส่วนบุคคล']
    },
    {
      id: 'premium',
      name: 'แผนพรีเมียม',
      price: '18,900',
      features: ['ซ่อมศูนย์ได้', 'คุ้มครองตัวรถ', 'รับผิดชอบบุคคลภายนอก', 'อุบัติเหตุส่วนบุคคล', 'รถเช่าทดแทน']
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2" style={{ fontWeight: 600 }}>เลือกแผนประกัน</h3>
        <p className="text-[#6F766E]">เลือกแผนที่เหมาะกับคุณ</p>
      </div>

      <div className="space-y-4">
        {options.map(option => (
          <button
            key={option.id}
            onClick={() => setSelected(option.id)}
            className={`w-full text-left p-6 rounded-2xl border-2 transition-all duration-200 ${
              selected === option.id
                ? 'border-[#153C3C] bg-[#F7F4EE] shadow-lg'
                : 'border-[#E9E3D7] hover:border-[#153C3C]/50'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ fontWeight: 600 }}>{option.name}</span>
                  {option.badge && (
                    <span className="px-3 py-1 bg-[#D6A85F] text-white rounded-full text-xs" style={{ fontWeight: 600 }}>
                      {option.badge}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1">
                  <span style={{ fontSize: '1.5rem', fontWeight: 700 }} className="text-[#153C3C]">{option.price}</span>
                  <span className="text-sm text-[#6F766E]">บาท/ปี</span>
                </div>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                selected === option.id ? 'border-[#153C3C] bg-[#153C3C]' : 'border-[#E9E3D7]'
              }`}>
                {selected === option.id && <Check size={16} className="text-white" />}
              </div>
            </div>
            <div className="space-y-2">
              {option.features.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm text-[#6F766E]">
                  <div className="w-4 h-4 rounded-full bg-[#E8F5E9] flex items-center justify-center flex-shrink-0">
                    <Check size={10} className="text-[#2E7D32]" />
                  </div>
                  {feature}
                </div>
              ))}
            </div>
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 px-6 py-4 bg-[#F7F4EE] hover:bg-[#E9E3D7] text-[#153C3C] rounded-xl transition-all duration-200"
        >
          ย้อนกลับ
        </button>
        <button
          onClick={onNext}
          className="flex-1 px-6 py-4 bg-[#153C3C] hover:bg-[#2D6A6A] text-white rounded-xl transition-all duration-200 shadow-lg"
        >
          ดูราคาเต็ม
        </button>
      </div>
    </div>
  );
}

function Step3({ onClose }: any) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-[#153C3C] to-[#2D6A6A] rounded-full flex items-center justify-center mx-auto mb-6">
          <Check size={40} className="text-white" />
        </div>
        <h3 className="mb-2" style={{ fontWeight: 600 }}>เราหาแผนที่ดีที่สุดให้คุณแล้ว!</h3>
        <p className="text-[#6F766E]">
          ติดต่อเราเพื่อรับใบเสนอราคาเต็มและรายละเอียดแผนประกัน
        </p>
      </div>

      <div className="bg-gradient-to-br from-[#153C3C] to-[#2D6A6A] rounded-2xl p-8 text-white text-center">
        <div className="text-sm opacity-90 mb-2">ราคาเบื้องต้น</div>
        <div className="flex items-baseline justify-center gap-2 mb-1">
          <span style={{ fontSize: '3rem', fontWeight: 700 }}>15,500</span>
          <span className="text-xl">บาท/ปี</span>
        </div>
        <div className="text-sm opacity-90">แผนมาตรฐาน • Toyota Camry 2025</div>
      </div>

      <div className="space-y-3">
        <button className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#06C755] hover:bg-[#05b24b] text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl">
          <MessageCircle size={24} />
          <span style={{ fontWeight: 600 }}>รับรายละเอียดทาง LINE</span>
        </button>
        <button className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#153C3C] hover:bg-[#2D6A6A] text-white rounded-xl transition-all duration-200">
          <Phone size={24} />
          <span style={{ fontWeight: 600 }}>โทรรับคำปรึกษา</span>
        </button>
      </div>

      <p className="text-center text-sm text-[#6F766E]">
        ทีมเราจะติดต่อกลับภายใน 5 นาที
      </p>

      <button
        onClick={onClose}
        className="w-full px-6 py-3 text-[#6F766E] hover:text-[#153C3C] transition-colors"
      >
        ปิด
      </button>
    </div>
  );
}
