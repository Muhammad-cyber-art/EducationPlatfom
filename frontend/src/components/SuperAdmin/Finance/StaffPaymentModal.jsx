import React, { useState } from'react';
import { createPortal } from'react-dom';
import { X, CheckCircle2, ShieldCheck, Loader2, Banknote } from'lucide-react';
import AmountInput from'../../Common/AmountInput';

const StaffPaymentModal = ({ isOpen, onClose, onConfirm, info, amount, incomeType }) => {
 const [loading, setLoading] = useState(false);
 const [bonus, setBonus] = useState(0);
 const [deduction, setDeduction] = useState(0);

 const handleConfirm = async () => {
 setLoading(true);
 try {
 await onConfirm(bonus, deduction);
 } catch (error) {
 console.error("Confirmation error:", error);
 } finally {
 setLoading(false);
 }
 };

 const finalAmount = Math.max(0, (amount || 0) + Number(bonus) - Number(deduction));

 if (!isOpen) return null;

 return createPortal(
 <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">

 {/* Modal Content */}
 <div className="relative w-full max-w-[360px] overflow-hidden bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-2xl shadow-2xl shadow-indigo-500/10">

 {/* Yuqoridagi dekorativ gradient line */}
 <div className="h-1.5 w-full bg-gradient-to-r from-indigo-600 via-violet-500 to-indigo-600"></div>

 <div className="p-5 md:p-7">
 {/* Yopish tugmasi */}
 <button
 onClick={onClose}
 disabled={loading}
 className="absolute top-5 right-5 text-slate-500 hover:text-white transition-colors p-1.5 hover:bg-[var(--bg-void)] rounded-lg disabled:opacity-50"
 >
 <X size={18} />
 </button>

 {/* Markaziy Ikonka */}
 <div className="flex justify-center mb-6">
 <div className="relative">
 <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 animate-pulse"></div>
 <div className="relative bg-indigo-500/10 p-4 rounded-xl border border-indigo-500/20">
 <Banknote size={32} className="text-indigo-400" />
 </div>
 </div>
 </div>

 {/* Sarlavha va Xodim Ma'lumoti */}
 <div className="text-center mb-6">
 <h2 className="text-xl font-black text-white mb-2 tracking-tight capitalize">To'lovni Tasdiqlash</h2>
 <div className="bg-slate-900/50 border border-[var(--border-glass)] p-3 rounded-xl mb-4">
 <p className="text-[8px] font-black text-slate-600 capitalize tracking-[0.3em] mb-1">Xodim</p>
 <p className="text-sm font-black text-indigo-300 capitalize">
 {info?.employee_first_name} {info?.employee_last_name}
 </p>
 </div>
 {/* Income Type Badge */}
 {incomeType === 'mentor_attendance' && (
 <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 mb-4">
 <span className="text-[9px] font-bold text-purple-400 capitalize tracking-wide">
 Mentor Davomati Asosida
 </span>
 </div>
 )}
 {incomeType === 'actual' && info?.salary_type === 'percentage' && (
 <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mb-4">
 <span className="text-[9px] font-bold text-emerald-400 capitalize tracking-wide">
 Asl Tushum Asosida
 </span>
 </div>
 )}
 </div>

 {/* Maoshni Tahrirlash (Bonus/Ayirma) */}
 <div className="space-y-4 mb-8">
 <div className="grid grid-cols-2 gap-3">
 <div className="space-y-1.5">
 <label className="text-[9px] font-black text-emerald-500 capitalize tracking-widest ml-1">Bonus (+)</label>
 <AmountInput
 value={bonus ||""}
 onChange={(e) => setBonus(Number(e.target.value))}
 placeholder="0"
 className="w-full bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-xl py-2 px-3 text-xs font-black text-emerald-400 focus:outline-none focus:border-emerald-500/50 transition-all shadow-inner"
 />
 </div>
 <div className="space-y-1.5">
 <label className="text-[9px] font-black text-rose-500 capitalize tracking-widest ml-1">Jarima (-)</label>
 <AmountInput
 value={deduction ||""}
 onChange={(e) => setDeduction(Number(e.target.value))}
 placeholder="0"
 className="w-full bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-xl py-2 px-3 text-xs font-black text-rose-400 focus:outline-none focus:border-rose-500/50 transition-all shadow-inner"
 />
 </div>
 </div>

 <div className="p-4 rounded-2xl bg-[var(--bg-void)] border border-indigo-500/20 shadow-inner">
 <div className="flex justify-between items-center mb-1">
 <span className="text-[10px] font-bold text-slate-500 capitalize tracking-tight">Kutilayotgan maosh:</span>
 <span className="text-[10px] font-black text-slate-300 tabular-nums">{(amount || 0).toLocaleString()} UZS</span>
 </div>
 <div className="flex justify-between items-center pt-2 border-t border-[var(--border-glass)]">
 <span className="text-xs font-black text-indigo-400 capitalize tracking-widest">Yakuniy Summa:</span>
 <span className="text-lg font-black text-white tabular-nums tracking-tighter">
 {finalAmount.toLocaleString()} <span className="text-[10px] text-slate-500">UZS</span>
 </span>
 </div>
 </div>
 </div>

 {/* Harakat tugmalari */}
 <div className="space-y-3">
 <button
 onClick={handleConfirm}
 disabled={loading}
 className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-black text-[11px] capitalize tracking-widest py-3.5 rounded-xl transition-all shadow-xl shadow-indigo-600/20 active:scale-95 disabled:opacity-50"
 >
 {loading ? (
 <>
 <Loader2 className="animate-spin" size={16} />
 Amalga oshirilmoqda...
 </>
 ) : (
 <>
 <CheckCircle2 size={16} />
 Tasdiqlash va To'lash
 </>
 )}
 </button>

 <button
 onClick={onClose}
 disabled={loading}
 className="w-full bg-transparent hover:bg-slate-800/30 text-slate-500 hover:text-slate-300 font-black text-[10px] capitalize tracking-[0.2em] py-2 transition-all rounded-lg"
 >
 Bekor qilish
 </button>
 </div>

 {/* Footer Info */}
 <div className="mt-6 flex items-center justify-center gap-2 text-[8px] text-slate-800 capitalize tracking-widest font-black border-t border-[var(--border-glass)] pt-5">
 <ShieldCheck size={10} className="text-slate-800" />
 Moliya bo'limi nazoratida
 </div>
 </div>
 </div>
 </div>,
 document.body
 );
};

export default StaffPaymentModal;