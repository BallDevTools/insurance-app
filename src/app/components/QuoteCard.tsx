import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface QuoteCardProps {
  onSubmit?: (data: any) => void;
}

export function QuoteCard({ onSubmit }: QuoteCardProps) {
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedType, setSelectedType] = useState('type1');

  const brands = ['Toyota', 'Honda', 'Mazda', 'Isuzu', 'Mitsubishi', 'Nissan', 'BMW', 'Mercedes-Benz'];
  const models = ['Camry', 'Accord', 'Civic', 'Corolla', 'Fortuner'];
  const years = ['2026', '2025', '2024', '2023', '2022', '2021', '2020'];

  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit({
        brand: selectedBrand,
        model: selectedModel,
        year: selectedYear,
        type: selectedType
      });
    }
  };

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl p-6 sm:p-8 border border-[#E9E3D7]">
      <h3 className="mb-6">เช็คราคาประกัน</h3>

      <div className="space-y-4">
        {/* Brand Selection */}
        <div>
          <label className="block mb-2 text-[#6F766E]">ยี่ห้อรถ</label>
          <div className="relative">
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full px-4 py-3 bg-[#FFFFFF] border border-[#E9E3D7] rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-[#153C3C] focus:border-transparent transition-all"
            >
              <option value="">เลือกยี่ห้อ</option>
              {brands.map(brand => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6F766E] pointer-events-none" size={20} />
          </div>
        </div>

        {/* Model Selection */}
        <div>
          <label className="block mb-2 text-[#6F766E]">รุ่นรถ</label>
          <div className="relative">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={!selectedBrand}
              className="w-full px-4 py-3 bg-[#FFFFFF] border border-[#E9E3D7] rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-[#153C3C] focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">เลือกรุ่น</option>
              {models.map(model => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6F766E] pointer-events-none" size={20} />
          </div>
        </div>

        {/* Year Selection */}
        <div>
          <label className="block mb-2 text-[#6F766E]">ปีรถ</label>
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              disabled={!selectedModel}
              className="w-full px-4 py-3 bg-[#FFFFFF] border border-[#E9E3D7] rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-[#153C3C] focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">เลือกปี</option>
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6F766E] pointer-events-none" size={20} />
          </div>
        </div>

        {/* Insurance Type Selection */}
        <div>
          <label className="block mb-3 text-[#6F766E]">ประเภทประกัน</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSelectedType('type1')}
              className={`px-4 py-3 rounded-xl transition-all duration-200 ${
                selectedType === 'type1'
                  ? 'bg-[#153C3C] text-white shadow-md'
                  : 'bg-[#F7F4EE] text-[#2B2B2B] hover:bg-[#E9E3D7]'
              }`}
            >
              ชั้น 1
            </button>
            <button
              onClick={() => setSelectedType('type2+')}
              className={`px-4 py-3 rounded-xl transition-all duration-200 ${
                selectedType === 'type2+'
                  ? 'bg-[#153C3C] text-white shadow-md'
                  : 'bg-[#F7F4EE] text-[#2B2B2B] hover:bg-[#E9E3D7]'
              }`}
            >
              ชั้น 2+
            </button>
            <button
              onClick={() => setSelectedType('type3+')}
              className={`px-4 py-3 rounded-xl transition-all duration-200 ${
                selectedType === 'type3+'
                  ? 'bg-[#153C3C] text-white shadow-md'
                  : 'bg-[#F7F4EE] text-[#2B2B2B] hover:bg-[#E9E3D7]'
              }`}
            >
              ชั้น 3+
            </button>
            <button
              onClick={() => setSelectedType('recommend')}
              className={`px-4 py-3 rounded-xl transition-all duration-200 ${
                selectedType === 'recommend'
                  ? 'bg-[#153C3C] text-white shadow-md'
                  : 'bg-[#F7F4EE] text-[#2B2B2B] hover:bg-[#E9E3D7]'
              }`}
            >
              แนะนำ
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!selectedBrand || !selectedModel || !selectedYear}
          className="w-full px-6 py-4 bg-[#153C3C] hover:bg-[#2D6A6A] text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#153C3C]"
        >
          ดูราคาเบื้องต้น
        </button>

        {/* Microcopy */}
        <p className="text-sm text-center text-[#6F766E]">
          ยังไม่ต้องกรอกทะเบียน
        </p>
      </div>
    </div>
  );
}
