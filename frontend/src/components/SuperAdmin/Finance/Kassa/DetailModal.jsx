import React from "react";
import { X, FileText, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "./useKassa";

const DetailModal = ({ show, payment, onClose, onVerify, isSuperAdmin }) => {
    if (!show || !payment) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative w-full max-w-lg bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-[2.5rem] shadow-2xl overflow-hidden animate-lux-pop">
                <div className="p-8 border-b border-[var(--border-glass)] flex items-center justify-between bg-gradient-to-r from-[var(--gold)]/10 to-transparent">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-[var(--gold-dim)] flex items-center justify-center text-[var(--gold)] border border-[var(--gold)]/20 shadow-inner"><FileText size={24} /></div>
                        <div><h2 className="text-xl font-black text-white tracking-tight">To'lov Tafsilotlari</h2><p className="text-[9px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">ID: STP-{payment.id}</p></div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-white/5 text-gray-400 hover:text-white rounded-xl transition-all"><X size={20} /></button>
                </div>
                <div className="p-8 space-y-6 text-white">
                    <div className="grid grid-cols-2 gap-6 font-bold text-sm">
                        <div><p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">O'quvchi</p>{payment.student_name}</div>
                        <div className="text-right"><p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Guruh</p><span className="text-[var(--gold)]">{payment.group_name}</span></div>
                        <div><p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">To'langan Summa</p>{formatCurrency(payment.amount)}</div>
                        <div className="text-right"><p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Metod</p>{payment.payment_method_display || payment.payment_method || "Naqd"}</div>
                        {payment.refund_amount > 0 && !payment.refund_ignored && (
                            <>
                                <div className="col-span-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="text-[9px] text-emerald-400 uppercase tracking-widest mb-1">Refund (Qaytarilgan)</p>
                                            <p className="text-lg font-black text-emerald-400">-{formatCurrency(payment.refund_amount)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Oylik to'lov</p>
                                            <p className="text-sm font-bold text-white">{formatCurrency(Number(payment.amount) + Number(payment.refund_amount))}</p>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                        {payment.refund_amount > 0 && payment.refund_ignored && (
                            <div className="col-span-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                <p className="text-[9px] text-amber-400 uppercase tracking-widest mb-1">Refund Status</p>
                                <p className="text-sm font-black text-amber-400">Refund bekor qilingan (Hisoblanmadi)</p>
                            </div>
                        )}
                    </div>
                    {payment.notes && <div className="p-4 bg-white/5 rounded-xl text-xs italic text-gray-400">"{payment.notes}"</div>}
                </div>
                <div className="p-6 bg-white/[0.02] border-t border-[var(--border-glass)] flex gap-3">
                    {isSuperAdmin && !payment.is_verified && (
                        <button onClick={() => onVerify(payment.id)} className="flex-1 h-12 bg-emerald-600 text-white font-black text-[11px] uppercase tracking-widest rounded-2xl hover:bg-emerald-500 transition-all shadow-lg active:scale-95">Tasdiqlash</button>
                    )}
                    <button onClick={onClose} className="flex-1 h-12 bg-white/5 text-white font-black text-[11px] uppercase tracking-widest rounded-2xl hover:bg-white/10 transition-all border border-white/10">Yopish</button>
                </div>
            </div>
        </div>
    );
};

export default DetailModal;
