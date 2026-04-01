import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';

export function FAQ() {
  const faqs = [
    {
      question: 'ใช้บริการฟรีจริงไหม?',
      answer: 'ใช่ครับ บริการของเราฟรี 100% เราไม่มีค่าธรรมเนียมใดๆ ทั้งการเช็คราคาและขอใบเสนอราคา'
    },
    {
      question: 'ราคาที่เห็นคือราคาจริงไหม?',
      answer: 'ราคาที่แสดงเป็นราคาเบื้องต้นจากบริษัทประกัน ราคาจริงอาจแตกต่างเล็กน้อยตามรายละเอียดรถและประวัติการใช้งาน'
    },
    {
      question: 'ต้องเตรียมเอกสารอะไรบ้าง?',
      answer: 'คุณต้องมีสำเนาทะเบียนรถ บัตรประชาชน และใบขับขี่ ทีมเราจะแจ้งรายละเอียดเพิ่มเติมเมื่อคุณตัดสินใจซื้อ'
    },
    {
      question: 'ใช้เวลานานแค่ไหนกว่าจะได้กรมธรรม์?',
      answer: 'หลังจากชำระเงินและส่งเอกสารครบ คุณจะได้รับกรมธรรม์ภายใน 1-2 วันทำการ'
    },
    {
      question: 'ถ้ามีปัญหาหลังซื้อประกันติดต่อใคร?',
      answer: 'คุณสามารถติดต่อทีมเราผ่าน LINE หรือโทรได้ตลอด เราพร้อมช่วยเหลือและประสานงานกับบริษัทประกันให้'
    }
  ];

  return (
    <section className="py-16 sm:py-24 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="mb-4" style={{ fontSize: '2rem', fontWeight: 700 }}>คำถามที่พบบ่อย</h2>
          <p className="text-[#6F766E]">
            มีคำถามเพิ่มเติม? เรายินดีตอบทุกข้อสงสัย
          </p>
        </div>

        <Accordion.Root type="single" collapsible className="space-y-4">
          {faqs.map((faq, idx) => (
            <Accordion.Item
              key={idx}
              value={`item-${idx}`}
              className="bg-[#F7F4EE] rounded-2xl border border-[#E9E3D7] overflow-hidden"
            >
              <Accordion.Header>
                <Accordion.Trigger className="w-full flex items-center justify-between p-6 hover:bg-[#E9E3D7] transition-colors group">
                  <span className="text-left" style={{ fontWeight: 600 }}>{faq.question}</span>
                  <ChevronDown
                    size={20}
                    className="text-[#6F766E] transition-transform duration-300 group-data-[state=open]:rotate-180"
                  />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="px-6 pb-6 text-[#6F766E] data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                <div className="pt-2 border-t border-[#E9E3D7]">
                  {faq.answer}
                </div>
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>

        <div className="mt-12 text-center">
          <p className="text-[#6F766E] mb-4">ยังมีคำถามเพิ่มเติม?</p>
          <button className="px-8 py-3 bg-[#153C3C] hover:bg-[#2D6A6A] text-white rounded-xl transition-all duration-200">
            ติดต่อเรา
          </button>
        </div>
      </div>
    </section>
  );
}
