import React from "react";
import { X, LogOut, Trash2, GraduationCap, AlertCircle } from "lucide-react";

export default function UnenrollSelectModal({
    isOpen,
    onClose,
    studentData,
    onUnenroll,
    onArchive
}) {
    if (!isOpen) return null;

    const groups = studentData?.groups || [];

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-lg bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-5 border-b border-[var(--border-glass)]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500">
                            <Trash2 size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-[var(--text-primary)] capitalize tracking-tight">O'chirish Tanlovi</h2>
                            <p className="text-[10px] text-[var(--text-muted)] font-bold capitalize tracking-widest mt-0.5">O'quvchini qayerdan o'chirmoqchisiz?</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-white/5 rounded-xl transition-all"
                    >
                        <X size={20} className="text-[var(--text-muted)]" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    <div className="flex items-start gap-4 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                        <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={18} />
                        <p className="text-[11px] text-[var(--text-secondary)] font-medium leading-relaxed">
                            <span className="text-amber-500 font-black tracking-tight">{studentData?.full_name}</span> bir nechta guruhda o'qiydi. Uni faqat bitta guruhdan chiqarishingiz yoki butunlay tizimdan o'chirishingiz mumkin.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] px-1">Guruhdan chiqarish</p>
                        <div className="grid grid-cols-1 gap-2">
                            {groups.map(group => (
                                <button
                                    key={group.id}
                                    onClick={() => {
                                        if (window.confirm(`${group.name} guruhidan chiqarishni tasdiqlaysizmi?`)) {
                                            onUnenroll(group.id);
                                            onClose();
                                        }
                                    }}
                                    className="flex items-center justify-between p-4 bg-[var(--bg-void)]/50 hover:bg-[var(--gold)] hover:text-black border border-[var(--border-glass)] rounded-2xl transition-all group/btn"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-[var(--bg-panel)] flex items-center justify-center text-[var(--gold)] group-hover/btn:bg-black/10 group-hover/btn:text-black">
                                            <GraduationCap size={16} />
                                        </div>
                                        <div className="text-left min-w-0">
                                            <p className="text-[12px] font-black truncate">{group.name}</p>
                                            <p className="text-[8px] font-bold opacity-60 uppercase tracking-widest">{group.subject || "Kurs"}</p>
                                        </div>
                                    </div>
                                    <LogOut size={16} className="shrink-0 opacity-40 group-hover/btn:opacity-100" />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-[var(--border-glass)]">
                        <button
                            onClick={() => {
                                const reason = prompt("Butunlay o'chirish sababi:");
                                if (reason) {
                                    onArchive(reason);
                                    onClose();
                                }
                            }}
                            className="w-full flex items-center justify-center gap-3 p-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-black text-[12px] capitalize tracking-wider shadow-lg shadow-red-500/20 transition-all active:scale-95"
                        >
                            <Trash2 size={18} />
                            Tizimdan butkul o'chirish (Arxiv)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
