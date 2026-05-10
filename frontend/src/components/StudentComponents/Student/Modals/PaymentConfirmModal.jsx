import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { CreditCard, Loader2, Banknote, Smartphone, Image as ImageIcon, CheckCircle2, AlertCircle } from "lucide-react";
import api from "../../../../tokenUpdater/updater";

export const PaymentConfirmModal = ({ isOpen, onClose, onConfirm, data, loading }) => {
    const [method, setMethod] = useState("cash");
    const [amount, setAmount] = useState("");
    const [receiptImage, setReceiptImage] = useState(null);
    const [preview, setPreview] = useState(null);
    const [noReceipt, setNoReceipt] = useState(false);
    const [notes, setNotes] = useState("");
    const [calculateRefund, setCalculateRefund] = useState(true);
    const [refundAmount, setRefundAmount] = useState(null);

    // Hisoblangan summani o'rnatish
    useEffect(() => {
        if (data?.amount) {
            const baseAmount = Number(data.amount);
            if (calculateRefund && refundAmount > 0) {
                setAmount((baseAmount - refundAmount).toString());
            } else {
                setAmount(baseAmount.toString());
            }
        }
        if (data?.ignore_refund !== undefined) setCalculateRefund(!data.ignore_refund);
    }, [data, calculateRefund, refundAmount]);

    useEffect(() => {
        const fetchRefundAmount = async () => {
            if (data?.id && isOpen) {
                try {
                    const response = await api.get(`/finance/student-payments/${data.id}/calculate-refund/`);
                    setRefundAmount(response.data.refund_amount || 0);
                } catch (error) {
                    setRefundAmount(0);
                }
            }
        };
        fetchRefundAmount();
    }, [data?.id, isOpen]);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setReceiptImage(file);
            setPreview(URL.createObjectURL(file));
        }
    };

    const handleConfirmClick = () => {
        // Backend hisoblaydi, amount jo'natilmaydi
        onConfirm({
            payment_method: method,
            receipt_image: method === 'click' ? receiptImage : null,
            is_receiptless: method === 'click' ? noReceipt : false,
            notes: notes,
            ignore_refund: !calculateRefund
        });
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return "";
        try {
            const date = new Date(dateStr);
            return date.toLocaleString('uz-UZ', { month: 'long', year: 'numeric' });
        } catch { return dateStr; }
    };

    return createPortal(
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto">
            <div className="bg-[var(--bg-panel)] border-2 border-amber-500/30 w-full max-w-lg rounded-[2.5rem] p-8 md:p-10 shadow-[0_0_50px_rgba(245,158,11,0.15)] animate-in zoom-in-95 duration-200 my-auto">
                <div className="flex flex-col items-center space-y-6">
                    <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
                        <CreditCard size={32} strokeWidth={1.5} />
                    </div>

                    <div className="text-center space-y-1">
                        <h3 className="text-2xl font-black text-white capitalize tracking-tighter">To'lovni Tasdiqlash</h3>
                        <p className="text-[9px] font-bold text-amber-500 uppercase tracking-[0.3em]">Moliya Operatsiyasi</p>
                    </div>

                    {/* Student Info Summary */}
                    <div className="w-full bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-3xl p-5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-[var(--text-muted)]">
                                <CheckCircle2 size={20} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">{data?.studentName}</span>
                                <span className="text-xs font-bold text-white">{formatDate(data?.month)}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-xs font-black text-emerald-500">{Number(data?.amount).toLocaleString()} <span className="text-[8px] opacity-60">UZS</span></span>
                        </div>
                    </div>

                    {/* Method Tabs */}
                    <div className="w-full grid grid-cols-2 gap-2 bg-[var(--bg-void)] p-1.5 rounded-[2rem] border border-[var(--border-glass)]">
                        <button
                            onClick={() => setMethod('cash')}
                            className={`flex items-center justify-center gap-2 py-3.5 rounded-[1.7rem] text-[11px] font-black transition-all ${method === 'cash' ? 'bg-amber-500 text-black shadow-lg' : 'text-[var(--text-muted)] hover:bg-white/5'}`}
                        >
                            <Banknote size={16} /> Naqd
                        </button>
                        <button
                            onClick={() => setMethod('click')}
                            className={`flex items-center justify-center gap-2 py-3.5 rounded-[1.7rem] text-[11px] font-black transition-all ${method === 'click' ? 'bg-amber-500 text-black shadow-lg' : 'text-[var(--text-muted)] hover:bg-white/5'}`}
                        >
                            <Smartphone size={16} /> Click / Karta
                        </button>
                    </div>

                    {/* Refund Toggle */}
                    {refundAmount !== null && refundAmount > 0 && (
                        <div className="w-full bg-[var(--bg-void)] border-2 border-[var(--border-glass)] rounded-2xl p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${calculateRefund ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'}`}>
                                        <AlertCircle size={16} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-white capitalize leading-tight">Refund hisoblash</p>
                                        <p className="text-[8px] font-medium text-[var(--text-muted)] opacity-70">Darslarni hisoblash va qaytarish</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={calculateRefund}
                                        onChange={(e) => setCalculateRefund(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-14 h-8 bg-[var(--bg-panel)] border-2 border-[var(--border-glass)] rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:start-[3px] after:bg-white after:border-gray-300 after:border-2 after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500 peer-checked:border-emerald-500"></div>
                                </label>
                            </div>
                            <div className="mt-3 pt-3 border-t border-[var(--border-glass)] flex items-center justify-between">
                                <p className="text-[8px] font-medium text-[var(--text-muted)] opacity-70">
                                    Hisoblanadigan refund:
                                </p>
                                <p className="text-[10px] font-bold text-emerald-400 tabular-nums">
                                    {refundAmount.toLocaleString()} UZS
                                </p>
                            </div>
                            {calculateRefund ? (
                                <div className="mt-3 pt-3 border-t border-[var(--border-glass)]">
                                    <p className="text-[8px] font-medium text-emerald-400 leading-relaxed">
                                        Refund hisoblash yoqilgan. Darslarga qarab qaytarish hisoblanadi.
                                    </p>
                                </div>
                            ) : (
                                <div className="mt-3 pt-3 border-t border-[var(--border-glass)]">
                                    <p className="text-[8px] font-medium text-amber-400 leading-relaxed">
                                        Refund hisoblash o'chirildi. To'lov butun summa qabul qilinadi.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Dynamic Inputs */}
                    <div className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* Summa ko'rsatish - read-only, backend hisoblaydi */}
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-4">
                                {calculateRefund ? 'Refund bilan hisoblangan summa' : 'Oylik to\'lov summasi'}
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={Number(amount || 0).toLocaleString()}
                                    readOnly
                                    className="w-full bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-2xl py-4 px-6 text-xl font-black text-emerald-400 focus:border-amber-500/50 outline-none transition-all cursor-not-allowed"
                                    placeholder="0"
                                />
                                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[var(--text-muted)]">UZS</span>
                            </div>
                            {/* Tushuntirish */}
                            {calculateRefund && refundAmount > 0 && data?.amount && (
                                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 mt-2">
                                    <div className="flex justify-between items-center text-[10px] mb-1">
                                        <span className="text-[var(--text-muted)]">Oylik to'lov:</span>
                                        <span className="text-white font-bold">{Number(data.amount).toLocaleString()} UZS</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] mb-1">
                                        <span className="text-emerald-400">Refund (-):</span>
                                        <span className="text-emerald-400 font-bold">-{Number(refundAmount).toLocaleString()} UZS</span>
                                    </div>
                                    <div className="border-t border-[var(--border-glass)] my-1"></div>
                                    <div className="flex justify-between items-center text-[10px]">
                                        <span className="text-amber-400 font-bold">To'lanadigan:</span>
                                        <span className="text-amber-400 font-bold">{Number(amount || 0).toLocaleString()} UZS</span>
                                    </div>
                                </div>
                            )}
                            {!calculateRefund && (
                                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 mt-2">
                                    <p className="text-[10px] text-amber-400 font-medium">Refund hisoblanmaydi. To'liq summa qabul qilinadi.</p>
                                </div>
                            )}
                        </div>

                        {method === 'click' && (
                            <div className="space-y-4">
                                {!noReceipt ? (
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-4">Chek (Rasm)</label>
                                        <div 
                                            onClick={() => document.getElementById('receipt-upload').click()}
                                            className="w-full h-32 bg-[var(--bg-void)] border-2 border-dashed border-[var(--border-glass)] rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-amber-500/30 hover:bg-amber-500/5 transition-all overflow-hidden relative group"
                                        >
                                            {preview ? (
                                                <>
                                                    <img src={preview} alt="Receipt preview" className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity" />
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <ImageIcon className="text-white drop-shadow-lg" size={32} />
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <ImageIcon className="text-[var(--text-muted)]" size={32} />
                                                    <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Chekni yuklash</span>
                                                </>
                                            )}
                                            <input id="receipt-upload" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
                                        <AlertCircle className="text-amber-500 shrink-0" size={18} />
                                        <p className="text-[10px] font-medium text-amber-500 leading-relaxed">
                                            Chek yo'qligi sababini quyidagi eslatma maydoniga yozib qoldiring. Bu moliya bo'limi uchun zarur.
                                        </p>
                                    </div>
                                )}

                                <div className="flex items-center gap-2 px-2">
                                    <input 
                                        type="checkbox" 
                                        id="no-receipt" 
                                        checked={noReceipt}
                                        onChange={(e) => setNoReceipt(e.target.checked)}
                                        className="w-4 h-4 accent-amber-500"
                                    />
                                    <label htmlFor="no-receipt" className="text-[10px] font-bold text-white cursor-pointer select-none">Chek mavjud emas (Cheksiz)</label>
                                </div>
                            </div>
                        )}

                        {/* Common Notes Field */}
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-4">Eslatma (Ehtiyoj bo'lsa)</label>
                            <textarea 
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                required={noReceipt}
                                className={`w-full bg-[var(--bg-void)] border rounded-2xl py-4 px-6 text-xs font-bold text-white outline-none transition-all h-24 resize-none ${noReceipt && !notes ? 'border-red-500/50 bg-red-500/5' : 'border-[var(--border-glass)] focus:border-amber-500/50'}`}
                                placeholder={noReceipt ? "Chek yo'qligi sababini yozing..." : "Qo'shimcha ma'lumot..."}
                            />
                        </div>
                    </div>

                    <div className="flex gap-4 w-full pt-2">
                        <button
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1 py-4 rounded-2xl border border-[var(--border-glass)] text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all disabled:opacity-50"
                        >
                            Bekor qilish
                        </button>
                        <button
                            onClick={handleConfirmClick}
                            disabled={loading || (method === 'click' && !noReceipt && !receiptImage) || (noReceipt && !notes)}
                            className="flex-1 py-4 rounded-2xl bg-amber-500 text-black text-[10px] font-black uppercase tracking-widest shadow-[0_10px_20px_rgba(245,158,11,0.2)] hover:shadow-[0_15px_30px_rgba(245,158,11,0.3)] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:bg-gray-500 disabled:shadow-none"
                        >
                            {loading ? <Loader2 size={18} className="animate-spin" /> : "Tasdiqlash"}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
