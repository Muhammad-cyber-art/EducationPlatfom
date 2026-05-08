import React from 'react';
import { CreditCard } from 'lucide-react';
import AmountInput from '../../Common/AmountInput';

const FinancialSection = ({ formData, setFormData, handleChange }) => (
  <div className="lux-card">
    <div className="flex items-center gap-4 mb-10 border-b border-[var(--border-glass)] pb-6">
      <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-500">
        <CreditCard size={24} />
      </div>
      <div>
        <h2 className="!text-white !text-lg capitalize font-black">To'lov va Status</h2>
        <p className="text-[10px] text-[var(--text-muted)] font-black capitalize tracking-widest mt-1">Moliyaviy strategiya</p>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div>
        <label className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-3 block">O'quvchi holati</label>
        <select name="status" value={formData.status} onChange={handleChange} className="lux-input !bg-[#0a0a0a]">
          <option value="regular">Oddiy</option>
          <option value="discount">Imtiyozli</option>
          <option value="low_income">Kam ta'minlangan</option>
          <option value="negotiated">Kelishilgan narx</option>
        </select>
      </div>
      <div>
        <label className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-3 block">Individual narx</label>
        <AmountInput
          name="custom_fee"
          value={formData.custom_fee}
          onChange={handleChange}
          placeholder="Ixtiyoriy summa"
          className="lux-input !bg-[#0a0a0a] pr-12"
        />
      </div>
      <div className="md:col-span-2 pt-2">
        <label className="flex items-center gap-3 cursor-pointer group">
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={formData.create_payment}
              onChange={(e) => setFormData(prev => ({ ...prev, create_payment: e.target.checked }))}
            />
            <div className="w-12 h-6 bg-white/10 rounded-full peer-checked:bg-[var(--gold)] transition-all"></div>
            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-all peer-checked:translate-x-6"></div>
          </div>
          <div>
            <span className="text-[11px] font-black capitalize tracking-widest text-white group-hover:text-[var(--gold)] transition-colors">
              Oylik to'lov varaqasi yaratilsin
            </span>
            <p className="text-[9px] text-[var(--text-muted)] capitalize font-bold mt-0.5">
              {formData.create_payment ? "Ushbu oy uchun avtomatik Billing yoqilgan" : "Faqat guruhga qo'shiladi, Billing (to'lov) yaratilmaydi"}
            </p>
          </div>
        </label>
      </div>
    </div>
  </div>
);

export default FinancialSection;
