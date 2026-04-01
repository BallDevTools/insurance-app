import { useState } from 'react';
import { Header } from './components/Header';
import { QuoteCard } from './components/QuoteCard';
import { TrustStrip } from './components/TrustStrip';
import { BenefitCards } from './components/BenefitCards';
import { PackagePreview } from './components/PackagePreview';
import { FAQ } from './components/FAQ';
import { Footer } from './components/Footer';
import { QuoteFlowModal } from './components/QuoteFlowModal';
import { ResultsPage } from './components/ResultsPage';
import { MessageCircle, Sparkles } from 'lucide-react';

export default function App() {
  const [view, setView] = useState<'landing' | 'results'>('landing');
  const [modalOpen, setModalOpen] = useState(false);
  const [quoteData, setQuoteData] = useState(null);

  const handleQuoteSubmit = (data: any) => {
    setQuoteData(data);
    setModalOpen(true);
  };

  const handleViewResults = () => {
    setView('results');
    window.scrollTo(0, 0);
  };

  if (view === 'results') {
    return (
      <>
        <Header />
        <button
          onClick={() => setView('landing')}
          className="fixed top-24 left-4 z-40 px-4 py-2 bg-white hover:bg-[#F7F4EE] text-[#153C3C] rounded-xl shadow-lg border border-[#E9E3D7] transition-all duration-200 text-sm"
        >
          ← กลับหน้าแรก
        </button>
        <ResultsPage carData={quoteData} />
        <Footer />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F4EE]">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#F7F4EE] via-[#FFFFFF] to-[#F7F4EE] opacity-50" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left Content */}
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-[#E9E3D7] mb-6 shadow-sm">
                <Sparkles size={16} className="text-[#D6A85F]" />
                <span className="text-sm text-[#6F766E]">เปรียบเทียบแผนจาก 12+ บริษัทชั้นนำ</span>
              </div>

              <h1 className="mb-6" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, lineHeight: 1.1 }}>
                เช็คราคาประกันรถ<br />
                <span className="text-[#153C3C]">ใน 30 วินาที</span>
              </h1>

              <p className="text-lg sm:text-xl text-[#6F766E] mb-8 leading-relaxed max-w-xl">
                เลือกยี่ห้อ รุ่น ปีรถ แล้วดูราคาเบื้องต้นได้ทันที<br />
                ไม่ต้องกรอกข้อมูลเยอะ ไม่ต้องรอนาน
              </p>

              {/* Desktop CTA Buttons */}
              <div className="hidden sm:flex items-center gap-4 mb-8">
                <button
                  onClick={handleViewResults}
                  className="px-8 py-4 bg-[#153C3C] hover:bg-[#2D6A6A] text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  ดูตัวอย่างผลลัพธ์
                </button>
                <button className="px-8 py-4 bg-white hover:bg-[#F7F4EE] text-[#153C3C] rounded-xl border border-[#E9E3D7] transition-all duration-200">
                  วิธีการทำงาน
                </button>
              </div>

              {/* Trust Indicators */}
              <div className="flex flex-wrap items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="#2E7D32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-[#6F766E]">ไม่มีค่าธรรมเนียมซ่อนเร้น</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="#2E7D32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-[#6F766E]">ใช้บริการฟรี 100%</span>
                </div>
              </div>
            </div>

            {/* Right - Quote Card */}
            <div className="relative">
              {/* Decorative elements */}
              <div className="absolute -top-6 -right-6 w-32 h-32 bg-gradient-to-br from-[#D6A85F] to-[#C09850] rounded-full blur-3xl opacity-20" />
              <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-gradient-to-br from-[#153C3C] to-[#2D6A6A] rounded-full blur-3xl opacity-20" />

              <div className="relative">
                <QuoteCard onSubmit={handleQuoteSubmit} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Strip */}
      <TrustStrip />

      {/* Benefits */}
      <BenefitCards />

      {/* Package Preview */}
      <PackagePreview />

      {/* FAQ */}
      <FAQ />

      {/* Footer */}
      <Footer />

      {/* Quote Flow Modal */}
      <QuoteFlowModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialData={quoteData}
      />

      {/* Mobile Floating CTA */}
      <div className="sm:hidden fixed bottom-4 right-4 z-40">
        <button className="w-14 h-14 bg-[#06C755] hover:bg-[#05b24b] text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-200 hover:scale-110">
          <MessageCircle size={24} />
        </button>
      </div>

      {/* Demo Navigation Helper */}
      <div className="fixed top-24 right-4 z-40 bg-white rounded-2xl p-4 shadow-xl border border-[#E9E3D7] max-w-xs hidden lg:block">
        <p className="text-sm text-[#6F766E] mb-3">
          <span style={{ fontWeight: 600 }} className="text-[#153C3C]">Demo Navigation:</span><br />
          เลือกรถและกดปุ่มเพื่อเห็น Quote Flow หรือ
        </p>
        <button
          onClick={handleViewResults}
          className="w-full px-4 py-2 bg-[#153C3C] hover:bg-[#2D6A6A] text-white rounded-xl text-sm transition-all duration-200"
        >
          ดูหน้าผลลัพธ์
        </button>
      </div>
    </div>
  );
}
