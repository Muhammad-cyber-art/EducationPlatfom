import React, { useState } from "react";
import { createPortal } from "react-dom";
import { X, BookOpen, AlignLeft, Send, AlertCircle, Loader2 } from "lucide-react";
import api from "../../tokenUpdater/updater";
import toast from "react-hot-toast";

/**
 * Mock Test yaratish modali.
 * Hozircha statik (mock) ma'lumotlar bilan ishlaydi.
 */
const AddMockTestModal = ({ isOpen, onClose, groupId }) => {
    const [formData, setFormData] = useState({ subject: '', type: '', group: groupId });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            // Assuming 'api' is an imported instance of an API client (e.g., axios)
            await api.post("/homework_attends/mock-tests/", {
                subject: formData.subject,
                type: formData.type,
                group: groupId
            });
            toast.success("Mock test muvaffaqiyatli yaratildi!");
            setFormData({ subject: '', type: '', group: groupId });
            onClose();
        } catch (err) {
            console.error("Mock Test yaratishda xato:", err);
            setError("Test yaratishda xatolik yuz berdi. Iltimos qaytadan urinib ko'ring.");
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 pt-16 sm:pt-4 transition-all overflow-y-auto">
            <div className="bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">

                {/* --- HEADER --- */}
                <div className="px-8 py-6 border-b border-[var(--border-glass)] flex justify-between items-center bg-[var(--bg-void)]/40">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-[var(--gold)]/10 text-[var(--gold)]">
                            <BookOpen size={20} />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-[var(--text-primary)] uppercase tracking-tight italic">Mock Test Yaratish</h2>
                            <p className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-widest opacity-60">Yangi imtihon</p>
                        </div>
                    </div>
                    <button
                        onClick={() => onClose(false)}
                        className="p-2 text-[var(--text-secondary)] hover:text-white transition-all bg-white/5 rounded-full"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* --- BODY --- */}
                <form onSubmit={handleSubmit} className="p-8 space-y-6">

                    {/* Fan nomi */}
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">
                            Mavzu nomi
                        </label>
                        <div className="relative group">
                            <input
                                type="text"
                                placeholder="Masalan: Full Mock , Oylik test sinov..."
                                value={formData.subject}
                                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                className="lux-input !bg-[var(--bg-void)]/50 !py-4"
                                required
                            />
                        </div>
                    </div>

                    {/* Imtihon turi */}
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">
                            Imtihon Turi
                        </label>
                        <div className="relative group">
                            <input
                                type="text"
                                placeholder="Masalan: Oylik nazorat, Haftalik test..."
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                className="lux-input !bg-[var(--bg-void)]/50 !py-4"
                                required
                            />
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                            <AlertCircle className="text-red-500 shrink-0" size={20} />
                            <p className="text-xs font-medium text-red-400">{error}</p>
                        </div>
                    )}

                    {/* --- FOOTER --- */}
                    <div className="flex flex-col gap-4 pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-black bg-[var(--gold)] rounded-2xl hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-[var(--gold-glow)]"
                        >
                            {loading ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <>
                                    <Send size={16} /> Yaratish
                                </>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => onClose(false)}
                            disabled={loading}
                            className="w-full py-3 text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest hover:text-white transition-all underline underline-offset-4"
                        >
                            Bekor qilish
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default AddMockTestModal;
