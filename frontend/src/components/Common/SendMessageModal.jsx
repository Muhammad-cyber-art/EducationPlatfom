import React, { useState } from "react";
import { Send, X, Loader2 } from "lucide-react";
import api from "../../tokenUpdater/updater";
import toast from "react-hot-toast";

/**
 * Universal Xabar Yuborish Modali
 * @param {boolean} isOpen
 * @param {function} onClose
 * @param {number|null} groupId - Agar guruhga yuborilsa ID, agar bo'sh bo'lsa global xabar (Super Admin)
 */
const SendMessageModal = ({ isOpen, onClose, groupId = null, branchId = null, showGlobalOption = false }) => {
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [sendToAll, setSendToAll] = useState(false);

    if (!isOpen) return null;

    const handleSend = async (e) => {
        e.preventDefault();
        if (!message.trim()) return;

        setLoading(true);
        try {
            const payload = {
                message: message,
                group_id: groupId,
                branch_id: branchId,
                send_to_all_branches: sendToAll
            };
            await api.post("/bot/broadcast/", payload);
            toast.success("Xabar yuborildi!");
            setMessage("");
            onClose();
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || "Xatolik yuz berdi");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            {/* Backdrop - remains dark/blurred for contrast */}
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Modal Container - Fixed White Style */}
            <div className="relative bg-white border border-slate-200 rounded-[32px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)] w-full max-w-md overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">

                {/* Header */}
                <div className="px-8 py-8 border-b border-slate-100 flex justify-between items-center bg-white">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-100">
                            <Send size={22} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-black tracking-tight leading-none">
                                {sendToAll ? "Global Xabar" : (groupId ? "Guruhga Xabar" : (branchId ? "Filialga Xabar" : "Xabar Yuborish"))}
                            </h3>
                            <p className="text-[12px] font-bold text-slate-500 mt-2 uppercase tracking-[1.5px]">
                                {sendToAll ? "Barcha o'quvchilarga" : (groupId ? "Faqat guruh a'zolariga" : (branchId ? "Faqat filial o'quvchilariga" : "Tanlanganlar uchun"))}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-black hover:bg-slate-50 rounded-full transition-all active:scale-90"
                    >
                        <X size={26} />
                    </button>
                </div>

                {/* Body - Fixed White Form */}
                <form onSubmit={handleSend} className="p-8 space-y-8 bg-white">
                    {showGlobalOption && (
                        <label
                            htmlFor="sendToAll"
                            className="flex items-center gap-4 p-5 bg-white rounded-2xl border-2 border-slate-200 cursor-pointer hover:border-black transition-all group"
                        >
                            <input
                                type="checkbox"
                                id="sendToAll"
                                checked={sendToAll}
                                onChange={(e) => setSendToAll(e.target.checked)}
                                className="h-6 w-6 rounded-md border-slate-300 text-black focus:ring-black cursor-pointer transition-all"
                            />
                            <span className="text-sm font-black text-black transition-colors">
                                Barcha filialarga yuborish
                            </span>
                        </label>
                    )}

                    <div className="space-y-3">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-[2px] ml-1">
                            Xabar matnini kiriting
                        </label>
                        <textarea
                            autoFocus
                            rows={5}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Xabaringizni bu yerga yozing..."
                            className="w-full bg-white border-2 border-slate-100 rounded-2xl p-6 text-base font-bold text-black placeholder:text-slate-300 focus:border-black focus:ring-0 focus:outline-none transition-all resize-none shadow-sm"
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-4 text-sm font-black text-slate-400 hover:text-black uppercase tracking-widest transition-colors"
                        >
                            Bekor qilish
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !message.trim()}
                            className="flex-[1.5] py-5 bg-black hover:bg-slate-800 text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-slate-200 transition-all active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                        >
                            {loading ? (
                                <Loader2 className="animate-spin" size={22} strokeWidth={3} />
                            ) : (
                                <Send size={20} strokeWidth={3} />
                            )}
                            {loading ? "Yuborilmoqda" : "Xabarni Yuborish"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SendMessageModal;
