import React, { useState } from"react";
import { CreditCard } from"lucide-react";

export const ProfileAttribute = React.memo(({ icon, label, value, colorClass }) => (
 <div className="flex justify-between items-start gap-4">
 <div className="flex items-center gap-3">
 <div className="text-[var(--gold)] opacity-60">{icon}</div>
 <p className="text-[8px] font-bold text-[var(--text-muted)] capitalize tracking-widest">
 {label}
 </p>
 </div>
 <div className="text-right flex-1 min-w-0">
 <div className={`text-[11px] font-bold capitalize tracking-tight ${colorClass ? `${colorClass} px-2 py-0.5 rounded-full inline-block shadow-sm mt-[-2px]` :'text-[var(--text-primary)]'} ${label ==="Eslatmalar" ?"whitespace-pre-wrap break-words leading-relaxed" :"truncate"}`}>
 {value}
 </div>
 </div>
 </div>
));

export const PaymentCheckout = ({ payment, onConfirm }) => {
 // To'lov allaqachon amalga oshirilgan bo'lsa, umuman ko'rsatilmaydi
 if (payment?.is_paid) {
 return null;
 }

 const [ignoreRefund, setIgnoreRefund] = useState(false);
 const refundAmount = payment?.refund_amount;

 if (!refundAmount || refundAmount <= 0) {
 return (
 <button
 onClick={() => onConfirm(payment.id)}
 className="p-3 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-black rounded-xl font-black capitalize tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95"
 title="To'lash"
 >
 <CreditCard size={18} />
 </button>
 );
 }

 return (
 <div className="flex items-center gap-3 bg-[var(--bg-void)]/40 border border-[var(--border-glass)] py-1.5 px-2.5 rounded-2xl shadow-lg animate-in fade-in zoom-in-95">
 <label className="flex items-center gap-2.5 cursor-pointer pl-1 pr-2 select-none group" title={!ignoreRefund ?"Chegirmani qo'llash" :"Chegirmani bekor qilish"}>
 <div className="relative inline-flex items-center">
 <input
 type="checkbox"
 className="sr-only peer"
 checked={!ignoreRefund}
 onChange={() => setIgnoreRefund(!ignoreRefund)}
 />
 <div className="w-8 h-4 bg-[var(--text-muted)]/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500 group-hover:after:scale-95 shadow-inner"></div>
 </div>
 <div className="flex flex-col justify-center">
 <span className="text-[7px] font-black capitalize tracking-[0.2em] text-[var(--text-muted)] leading-none mb-0.5">
 Chegirma
 </span>
 <span className={`text-[10px] font-black capitalize tracking-widest leading-none transition-all ${!ignoreRefund ?"text-emerald-500" :"text-gray-500 line-through opacity-50"}`}>
 -{Math.floor(refundAmount).toLocaleString()}
 </span>
 </div>
 </label>

 <div className="w-px h-6 bg-[var(--border-glass)]"></div>

 <button
 onClick={() => onConfirm(payment.id, null, ignoreRefund)}
 className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-black transition-all shadow-md active:scale-90 flex items-center justify-center cursor-pointer relative z-10"
 title="To'lovni tasdiqlash"
 >
 <CreditCard size={16} />
 </button>
 </div>
 );
};
