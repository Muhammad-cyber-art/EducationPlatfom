import React from"react";
import { createPortal } from"react-dom";
import { CreditCard, Loader2 } from"lucide-react";

export const PaymentConfirmModal = ({ isOpen, onClose, onConfirm, data, loading }) => {
 if (!isOpen) return null;

 const formatDate = (dateStr) => {
 if (!dateStr) return"";
 try {
 const date = new Date(dateStr);
 return date.toLocaleString('uz-UZ', { month:'long', year:'numeric' });
 } catch { return dateStr; }
 };

 return createPortal(
 <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
 <div className="bg-[var(--bg-panel)] border-2 border-amber-500/30 w-full max-w-md rounded-[2.5rem] p-10 shadow-[0_0_50px_rgba(245,158,11,0.15)] animate-in zoom-in-95 duration-200">
 <div className="flex flex-col items-center text-center space-y-6">
 <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.1)]">
 <CreditCard size={40} strokeWidth={1.5} />
 </div>

 <div className="space-y-2">
 <h3 className="text-2xl font-black text-white capitalize tracking-tighter">To'lovni Tasdiqlash</h3>
 <p className="text-[10px] font-bold text-amber-500 capitalize tracking-[0.3em]">Diqqat! Ushbu amalni qaytarib bo'lmaydi</p>
 </div>

 <div className="w-full bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-3xl p-6 space-y-4">
 <div className="flex justify-between items-center border-b border-[var(--border-glass)] pb-3">
 <span className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest">O'quvchi</span>
 <span className="text-xs font-bold text-white capitalize">{data?.studentName}</span>
 </div>
 <div className="flex justify-between items-center border-b border-[var(--border-glass)] pb-3">
 <span className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest">Sana</span>
 <span className="text-xs font-bold text-[var(--gold)] capitalize">{formatDate(data?.month)}</span>
 </div>
 <div className="flex justify-between items-center">
 <span className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest">To'lov Summasi</span>
 <span className="text-xl font-black text-emerald-500">{Number(data?.amount).toLocaleString()} <span className="text-[10px] ml-1">UZS</span></span>
 </div>
 </div>

 <div className="flex flex-col sm:flex-row gap-4 w-full pt-4">
 <button
 onClick={onClose}
 disabled={loading}
 className="flex-1 py-4 rounded-2xl border border-[var(--border-glass)] text-[11px] font-black capitalize tracking-widest hover:bg-white/5 transition-all disabled:opacity-50"
 >
 Bekor qilish
 </button>
 <button
 onClick={onConfirm}
 disabled={loading}
 className="flex-1 py-4 rounded-2xl bg-amber-500 text-black text-[11px] font-black capitalize tracking-widest shadow-[0_10px_20px_rgba(245,158,11,0.2)] hover:shadow-[0_15px_30px_rgba(245,158,11,0.3)] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
 >
 {loading ? <Loader2 size={18} className="animate-spin" /> :"Tasdiqlash"}
 </button>
 </div>
 </div>
 </div>
 </div>,
 document.body
 );
};
