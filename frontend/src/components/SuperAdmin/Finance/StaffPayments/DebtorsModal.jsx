import React, { useState } from "react";
import { createPortal } from "react-dom";
import { X, Users, CheckCircle2, AlertCircle, Clock, Crown, HandHeart, DollarSign, Calendar, CreditCard } from "lucide-react";

const DebtorsModal = ({ group, onClose, formatCurrency }) => {
    if (!group) return null;

    const [activeTab, setActiveTab] = useState('debtors');

    const unpaidStudents = group.unpaid_students || [];
    const paidStudents = group.paid_students || [];

    const getFinancialStatusBadge = (status, label) => {
        const statusConfig = {
            'discount': { icon: Crown, color: 'text-purple-300', bg: 'bg-purple-500/20', border: 'border-purple-500/30' },
            'low_income': { icon: HandHeart, color: 'text-amber-300', bg: 'bg-amber-500/20', border: 'border-amber-500/30' },
            'negotiated': { icon: DollarSign, color: 'text-blue-300', bg: 'bg-blue-500/20', border: 'border-blue-500/30' },
            'regular': { icon: CheckCircle2, color: 'text-emerald-300', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30' }
        };
        const config = statusConfig[status] || statusConfig['regular'];
        const Icon = config.icon;

        return (
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl ${config.bg} ${config.border} border backdrop-blur-sm ${config.color}`}>
                <Icon size={12} />
                <span className="text-[9px] font-bold capitalize tracking-wide">{label}</span>
            </div>
        );
    };

    const StudentCard = ({ student, isPaid }) => {
        const remaining = (student.expected || 0) - (student.actual || 0);
        const hasRefund = isPaid && (student.refund_amount > 0 || student.refund_amount);
        const refundIgnored = student.refund_ignored;
        return (
            <div className={`p-3 bg-[var(--bg-void)]/40 backdrop-blur-sm ${isPaid ? 'hover:bg-[var(--bg-void)]/60' : 'hover:bg-[var(--bg-void)]/60'} border ${isPaid ? 'border-emerald-500/10' : 'border-amber-500/10'} rounded-xl transition-all duration-200 hover:scale-[1.005]`}>
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 ${isPaid ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                            {student.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-[var(--text-primary)] capitalize leading-tight truncate">{student.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                {getFinancialStatusBadge(student.financial_status, student.financial_status_label)}
                                <span className={`text-[8px] font-bold capitalize ${isPaid ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {student.status}
                                </span>
                                {student.negotiated_price && (
                                    <span className="text-[8px] font-medium text-blue-400 tabular-nums">
                                        {formatCurrency(student.negotiated_price)}
                                    </span>
                                )}
                                {/* Refund badge */}
                                {hasRefund && !refundIgnored && (
                                    <span className="text-[8px] font-bold text-emerald-400 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                        Refund: -{formatCurrency(student.refund_amount)}
                                    </span>
                                )}
                                {hasRefund && refundIgnored && (
                                    <span className="text-[8px] font-bold text-amber-400 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                        Refund bekor
                                    </span>
                                )}
                            </div>
                            {(student.paid_at || student.payment_method) && (
                                <div className="flex items-center gap-2 mt-1 text-[8px] text-[var(--text-muted)]">
                                    {student.paid_at && (
                                        <span className="truncate">{student.paid_at}</span>
                                    )}
                                    {student.payment_method && (
                                        <span className="truncate">• {student.payment_method}</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                        <p className={`text-sm font-bold tabular-nums ${isPaid ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {formatCurrency(student.expected)}
                        </p>
                        <p className="text-[8px] font-medium text-[var(--text-muted)] opacity-70">
                            {isPaid ? 'To\'langan' : 'Kutilayotgan'}
                        </p>
                    </div>
                </div>
                <div className={`grid ${hasRefund && !refundIgnored ? 'grid-cols-4' : 'grid-cols-3'} gap-2 mt-2 pt-2 border-t border-[var(--border-glass)]/30`}>
                    <div className="text-center">
                        <p className="text-[7px] font-medium text-[var(--text-muted)] opacity-60 mb-0.5">Kutilgan</p>
                        <p className="text-[10px] font-bold text-[var(--text-secondary)] tabular-nums">
                            {formatCurrency(student.expected)}
                        </p>
                    </div>
                    <div className="text-center">
                        <p className="text-[7px] font-medium text-[var(--text-muted)] opacity-60 mb-0.5">To'langan</p>
                        <p className="text-[10px] font-bold text-emerald-400 tabular-nums">
                            {formatCurrency(student.actual || 0)}
                        </p>
                    </div>
                    {/* Refund ustuni */}
                    {hasRefund && !refundIgnored && (
                        <div className="text-center ">
                            <p className="text-[7px] font-medium text-emerald-400 opacity-80 mb-0.5">Refund</p>
                            <p className="text-[10px] font-bold text-emerald-400 tabular-nums">
                                -{formatCurrency(student.refund_amount)}
                            </p>
                        </div>
                    )}
                    <div className="text-center">
                        <p className="text-[7px] font-medium text-[var(--text-muted)] opacity-60 mb-0.5">Qolgan</p>
                        <p className={`text-[10px] font-bold tabular-nums ${remaining > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {formatCurrency(remaining)}
                        </p>
                    </div>
                </div>
            </div>
        );
    };

    return createPortal(
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-500">
            <div className="bg-[var(--bg-panel)]/95 backdrop-blur-xl border border-[var(--border-glass)]/30 rounded-[2rem] w-full max-w-5xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col">
                {/* Header */}
                <div className="p-8 border-b border-[var(--border-glass)]/30 flex items-center justify-between">
                    <div>
                        <h4 className="text-xl font-bold text-[var(--text-primary)] capitalize tracking-tight flex items-center gap-3">
                            <div className="p-2.5 bg-[var(--gold)]/10 rounded-xl">
                                <Users size={22} className="text-[var(--gold)]" />
                            </div>
                            O'quvchilar Ro'yxati
                        </h4>
                        <p className="text-[11px] font-medium text-[var(--gold)] capitalize tracking-wide mt-2">Guruh: {group.name}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 hover:bg-[var(--bg-void)] text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-2xl transition-all duration-300 hover:scale-105"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-[var(--border-glass)]/30">
                    <button
                        onClick={() => setActiveTab('debtors')}
                        className={`flex-1 px-8 py-5 text-[11px] font-bold capitalize tracking-wide transition-all duration-300 flex items-center justify-center gap-2.5 ${activeTab === 'debtors' ? 'text-[var(--gold)] bg-[var(--gold)]/5 border-b-2 border-[var(--gold)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-void)]/30'}`}
                    >
                        <AlertCircle size={16} />
                        Qarzdorlar ({unpaidStudents.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('paid')}
                        className={`flex-1 px-8 py-5 text-[11px] font-bold capitalize tracking-wide transition-all duration-300 flex items-center justify-center gap-2.5 ${activeTab === 'paid' ? 'text-emerald-400 bg-emerald-500/5 border-b-2 border-emerald-400' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-void)]/30'}`}
                    >
                        <CheckCircle2 size={16} />
                        To'laganlar ({paidStudents.length})
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {activeTab === 'debtors' ? (
                        <div className="space-y-4">
                            {unpaidStudents.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-24 opacity-50">
                                    <div className="p-4 bg-emerald-500/10 rounded-full mb-4">
                                        <CheckCircle2 size={56} className="text-emerald-400" />
                                    </div>
                                    <p className="text-sm font-bold text-[var(--text-muted)] capitalize tracking-wide">Qarzdorlar yo'q</p>
                                </div>
                            ) : (
                                unpaidStudents.map((st) => <StudentCard key={st.id} student={st} isPaid={false} />)
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {paidStudents.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-24 opacity-50">
                                    <div className="p-4 bg-amber-500/10 rounded-full mb-4">
                                        <Clock size={56} className="text-amber-400" />
                                    </div>
                                    <p className="text-sm font-bold text-[var(--text-muted)] capitalize tracking-wide">To'lovlar hali yo'q</p>
                                </div>
                            ) : (
                                paidStudents.map((st) => <StudentCard key={st.id} student={st} isPaid={true} />)
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-[var(--border-glass)]/30 bg-[var(--bg-void)]/30">
                    {activeTab === 'debtors' && unpaidStudents.length > 0 ? (
                        <div className="flex justify-between items-center p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-500/10 rounded-xl">
                                    <AlertCircle size={20} className="text-amber-400" />
                                </div>
                                <span className="text-base font-bold text-amber-400 capitalize">Jami qarz:</span>
                            </div>
                            <span className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">
                                {formatCurrency(unpaidStudents.reduce((acc, s) => acc + ((s.expected || 0) - (s.actual || 0)), 0))}
                            </span>
                        </div>
                    ) : (
                        <div className="flex justify-between items-center p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-500/10 rounded-xl">
                                    <CheckCircle2 size={20} className="text-emerald-400" />
                                </div>
                                <span className="text-base font-bold text-emerald-400 capitalize">Jami to'lov:</span>
                            </div>
                            <span className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">
                                {formatCurrency(paidStudents.reduce((acc, s) => acc + (s.actual || 0), 0))}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default DebtorsModal;
