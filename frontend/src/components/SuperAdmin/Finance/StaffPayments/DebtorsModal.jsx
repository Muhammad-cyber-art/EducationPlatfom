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
            'discount': { icon: Crown, color: 'text-purple-600 dark:text-purple-300', bg: 'bg-purple-100 dark:bg-purple-500/20', border: 'border-purple-200 dark:border-purple-500/30' },
            'low_income': { icon: HandHeart, color: 'text-amber-600 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-500/20', border: 'border-amber-200 dark:border-amber-500/30' },
            'negotiated': { icon: DollarSign, color: 'text-blue-600 dark:text-blue-300', bg: 'bg-blue-100 dark:bg-blue-500/20', border: 'border-blue-200 dark:border-blue-500/30' },
            'teacher_negotiated': { icon: Crown, color: 'text-cyan-600 dark:text-cyan-300', bg: 'bg-cyan-100 dark:bg-cyan-500/20', border: 'border-cyan-200 dark:border-cyan-500/30' },
            'regular': { icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-300', bg: 'bg-emerald-100 dark:bg-emerald-500/20', border: 'border-emerald-200 dark:border-emerald-500/30' }
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
            <div className={`p-4 bg-[var(--bg-panel)] border ${isPaid ? 'border-emerald-500/20' : 'border-amber-500/20'} rounded-2xl transition-all duration-300 hover:shadow-lg hover:shadow-[var(--shadow-color)] group relative overflow-hidden`}>
                {/* Decorative background element */}
                <div className={`absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full blur-3xl opacity-10 transition-opacity group-hover:opacity-20 ${isPaid ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                
                <div className="flex items-center justify-between gap-4 relative z-10">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg flex-shrink-0 shadow-inner ${isPaid ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                            {student.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-extrabold text-[var(--text-primary)] capitalize leading-tight truncate tracking-tight">{student.name}</p>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                {getFinancialStatusBadge(student.financial_status, student.financial_status_label)}
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter ${isPaid ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                                    {student.status}
                                </span>
                                {student.negotiated_price && (
                                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 tabular-nums bg-blue-500/5 px-2 py-0.5 rounded-full">
                                        {formatCurrency(student.negotiated_price)}
                                    </span>
                                )}
                                {hasRefund && !refundIgnored && (
                                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                        Refund: -{formatCurrency(student.refund_amount)}
                                    </span>
                                )}
                                {hasRefund && refundIgnored && (
                                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                                        Refund bekor
                                    </span>
                                )}
                            </div>
                            {(student.paid_at || student.payment_method) && (
                                <div className="flex items-center gap-3 mt-2 text-[10px] text-[var(--text-muted)] font-medium">
                                    {student.paid_at && (
                                        <span className="flex items-center gap-1"><Calendar size={10} /> {student.paid_at}</span>
                                    )}
                                    {student.payment_method && (
                                        <span className="flex items-center gap-1"><CreditCard size={10} /> {student.payment_method}</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                        <p className={`text-base font-black tabular-nums tracking-tighter ${isPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                            {formatCurrency(student.expected)}
                        </p>
                        <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest opacity-80">
                            {isPaid ? 'To\'langan' : 'Kutilayotgan'}
                        </p>
                    </div>
                </div>
                
                <div className={`grid ${hasRefund && !refundIgnored ? 'grid-cols-4' : 'grid-cols-3'} gap-3 mt-4 pt-4 border-t border-[var(--shadow-color)]/10 relative z-10`}>
                    <div className="text-center group/item transition-transform hover:scale-105">
                        <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Kutilgan</p>
                        <p className="text-xs font-bold text-[var(--text-secondary)] tabular-nums">
                            {formatCurrency(student.expected)}
                        </p>
                    </div>
                    <div className="text-center group/item transition-transform hover:scale-105">
                        <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">To'langan</p>
                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {formatCurrency(student.actual || 0)}
                        </p>
                    </div>
                    {hasRefund && !refundIgnored && (
                        <div className="text-center group/item transition-transform hover:scale-105">
                            <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Refund</p>
                            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                -{formatCurrency(student.refund_amount)}
                            </p>
                        </div>
                    )}
                    <div className="text-center group/item transition-transform hover:scale-105">
                        <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Qolgan</p>
                        <p className={`text-xs font-bold tabular-nums ${remaining > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {formatCurrency(remaining)}
                        </p>
                    </div>
                </div>
            </div>
        );
    };

    return createPortal(
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 sm:p-6 bg-black/40 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-[var(--bg-panel)] border border-[var(--shadow-color)]/20 rounded-[2.5rem] w-full max-w-5xl max-h-[95vh] overflow-hidden shadow-[0_32px_64px_-12px_var(--shadow-color)] flex flex-col animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-6 sm:p-8 flex items-center justify-between bg-gradient-to-b from-[var(--bg-void)]/50 to-transparent">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-[var(--gold)]/10 rounded-2xl flex items-center justify-center shadow-inner">
                            <Users size={28} className="text-[var(--gold)]" />
                        </div>
                        <div>
                            <h4 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
                                O'quvchilar Ro'yxati
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="px-2.5 py-0.5 rounded-full bg-[var(--gold)]/10 text-[var(--gold)] text-[10px] font-black uppercase tracking-widest">
                                    Guruh: {group.name}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3.5 hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 rounded-2xl transition-all duration-300 hover:rotate-90"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="px-8 flex gap-4">
                    <button
                        onClick={() => setActiveTab('debtors')}
                        className={`px-6 py-4 text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-3 rounded-t-2xl border-b-2 ${activeTab === 'debtors' ? 'text-[var(--gold)] border-[var(--gold)] bg-[var(--gold)]/5' : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-primary)] hover:bg-[var(--bg-void)]/50'}`}
                    >
                        <AlertCircle size={16} />
                        Qarzdorlar <span className="ml-1 opacity-60">({unpaidStudents.length})</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('paid')}
                        className={`px-6 py-4 text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-3 rounded-t-2xl border-b-2 ${activeTab === 'paid' ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500 bg-emerald-500/5' : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-primary)] hover:bg-[var(--bg-void)]/50'}`}
                    >
                        <CheckCircle2 size={16} />
                        To'laganlar <span className="ml-1 opacity-60">({paidStudents.length})</span>
                    </button>
                </div>
                <div className="mx-8 border-b border-[var(--shadow-color)]/10"></div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar bg-gradient-to-b from-transparent to-[var(--bg-void)]/20">
                    {activeTab === 'debtors' ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {unpaidStudents.length === 0 ? (
                                <div className="col-span-full flex flex-col items-center justify-center py-32 opacity-30">
                                    <div className="p-6 bg-emerald-500/10 rounded-full mb-6">
                                        <CheckCircle2 size={64} className="text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <p className="text-lg font-bold text-[var(--text-muted)] uppercase tracking-[0.2em]">Qarzdorlar yo'q</p>
                                </div>
                            ) : (
                                unpaidStudents.map((st) => <StudentCard key={st.id} student={st} isPaid={false} />)
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {paidStudents.length === 0 ? (
                                <div className="col-span-full flex flex-col items-center justify-center py-32 opacity-30">
                                    <div className="p-6 bg-amber-500/10 rounded-full mb-6">
                                        <Clock size={64} className="text-amber-600 dark:text-amber-400" />
                                    </div>
                                    <p className="text-lg font-bold text-[var(--text-muted)] uppercase tracking-[0.2em]">To'lovlar hali yo'q</p>
                                </div>
                            ) : (
                                paidStudents.map((st) => <StudentCard key={st.id} student={st} isPaid={true} />)
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-[var(--shadow-color)]/10 bg-[var(--bg-panel)] relative z-20">
                    {activeTab === 'debtors' && unpaidStudents.length > 0 ? (
                        <div className="flex flex-col sm:flex-row justify-between items-center p-6 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-3xl shadow-inner gap-4">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-amber-500/10 rounded-2xl">
                                    <AlertCircle size={24} className="text-amber-600 dark:text-amber-400" />
                                </div>
                                <div>
                                    <span className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest block">Jami qarz</span>
                                    <span className="text-sm font-medium text-[var(--text-muted)]">Guruh bo'yicha kutilayotgan summa</span>
                                </div>
                            </div>
                            <span className="text-3xl font-black text-[var(--text-primary)] tabular-nums tracking-tighter">
                                {formatCurrency(unpaidStudents.reduce((acc, s) => acc + ((s.expected || 0) - (s.actual || 0)), 0))}
                            </span>
                        </div>
                    ) : (
                        <div className="flex flex-col sm:flex-row justify-between items-center p-6 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-3xl shadow-inner gap-4">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-emerald-500/10 rounded-2xl">
                                    <CheckCircle2 size={24} className="text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div>
                                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block">Jami to'lov</span>
                                    <span className="text-sm font-medium text-[var(--text-muted)]">Guruh bo'yicha yig'ilgan summa</span>
                                </div>
                            </div>
                            <span className="text-3xl font-black text-[var(--text-primary)] tabular-nums tracking-tighter">
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

