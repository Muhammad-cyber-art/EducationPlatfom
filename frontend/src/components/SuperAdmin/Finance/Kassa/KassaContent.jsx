import React from "react";
import {
    User, Banknote, Smartphone, CheckCircle2, ShieldCheck,
    FileText, Image as ImageIcon, TrendingDown, CreditCard
} from "lucide-react";
import { formatCurrency } from "./useKassa";

const IncomeTable = ({ payments, loading, isSuperAdmin, onVerify, onDetail, onReceipt }) => (
    <table className="w-full text-left border-collapse">
        <thead>
            <tr className="bg-white/[0.03] border-b border-[var(--border-glass)]">
                <th className="px-8 py-6 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">O'quvchi / Guruh</th>
                <th className="px-8 py-6 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">To'lov Usuli</th>
                <th className="px-8 py-6 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">Summa</th>
                <th className="px-8 py-6 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">Qabul Qildi</th>
                <th className="px-8 py-6 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">Vaqt</th>
                <th className="px-8 py-6 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em] text-right">Amallar</th>
            </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-glass)]">
            {loading ? (
                <tr><td colSpan="6" className="p-32 text-center text-[var(--gold)] animate-pulse uppercase font-black tracking-widest">Ma'lumotlar yuklanmoqda...</td></tr>
            ) : payments.length === 0 ? (
                <tr><td colSpan="6" className="p-32 text-center text-[var(--text-muted)] font-black uppercase tracking-widest">Hozircha hech qanday tushum topilmadi</td></tr>
            ) : payments.map((p) => (
                <tr key={p.id} className="hover:bg-white/[0.04] transition-all duration-300 group/row">
                    <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-muted)] group-hover/row:border-[var(--gold)]/30 transition-colors">
                                <User size={22} strokeWidth={1.5} />
                            </div>
                            <div>
                                <p className="text-sm font-black text-white capitalize">{p.student_name}</p>
                                <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest mt-1 opacity-70">{p.group_name}</p>
                            </div>
                        </div>
                    </td>
                    <td className="px-8 py-6">
                        <div className={`inline-flex items-center gap-3 px-4 py-2 rounded-2xl border text-[10px] font-black uppercase tracking-wider ${p.payment_method === 'cash' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-blue-500/10 border-blue-500/20 text-blue-500'}`}>
                            {p.payment_method === 'cash' ? <Banknote size={14} /> : <Smartphone size={14} />}
                            {p.payment_method === 'cash' ? 'Naqd (Cash)' : 'Click / Card'}
                        </div>
                    </td>
                    <td className="px-8 py-6">
                        <div className="text-base font-black text-white tabular-nums tracking-tight">{formatCurrency(p.amount)}</div>
                        {p.refund_amount > 0 && !p.refund_ignored && (
                            <div className="mt-1 text-[9px] font-bold text-emerald-400">Refund: -{formatCurrency(p.refund_amount)}</div>
                        )}
                        {p.refund_amount > 0 && p.refund_ignored && (
                            <div className="mt-1 text-[9px] font-bold text-amber-400">Refund bekor</div>
                        )}
                    </td>
                    <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${p.is_verified ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-white/5 text-[var(--gold)] border-white/10'}`}>
                                {p.is_verified ? <CheckCircle2 size={16} /> : <ShieldCheck size={16} />}
                            </div>
                            <span className="text-[11px] font-black uppercase text-[var(--text-secondary)]">{p.marked_by || "Tizim"}</span>
                        </div>
                    </td>
                    <td className="px-8 py-6">
                        <div className="text-[11px] font-black text-white">{new Date(p.paid_at).toLocaleDateString('uz-UZ')}</div>
                        <div className="text-[10px] text-[var(--text-muted)] font-black">{new Date(p.paid_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-3 opacity-0 group-hover/row:opacity-100 transition-all duration-300">
                            {isSuperAdmin && !p.is_verified && (
                                <button onClick={() => onVerify(p.id)} className="w-11 h-11 flex items-center justify-center bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-lg active:scale-90"><CheckCircle2 size={18} /></button>
                            )}
                            {p.receipt_image && <button onClick={() => onReceipt(p.receipt_image)} className="w-11 h-11 flex items-center justify-center bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-xl hover:bg-blue-500 hover:text-white transition-all shadow-lg active:scale-90"><ImageIcon size={18} /></button>}
                            <button onClick={() => onDetail(p)} className="w-11 h-11 flex items-center justify-center bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/20 rounded-xl hover:bg-[var(--gold)] hover:text-black transition-all shadow-lg active:scale-90"><FileText size={18} /></button>
                        </div>
                    </td>
                </tr>
            ))}
        </tbody>
    </table>
);

const ExpenseTable = ({ withdrawals, loading }) => (
    <table className="w-full text-left border-collapse">
        <thead>
            <tr className="bg-white/[0.03] border-b border-[var(--border-glass)]">
                <th className="px-8 py-6 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">Operatsiya</th>
                <th className="px-8 py-6 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">Toifa</th>
                <th className="px-8 py-6 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">Summa</th>
                <th className="px-8 py-6 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">Mas'ul</th>
                <th className="px-8 py-6 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">Vaqt</th>
                <th className="px-8 py-6 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em] text-right">Status</th>
            </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-glass)]">
            {loading ? (
                <tr><td colSpan="6" className="p-32 text-center text-red-500 animate-pulse uppercase font-black tracking-widest">Yuklanmoqda...</td></tr>
            ) : withdrawals.length === 0 ? (
                <tr><td colSpan="6" className="p-32 text-center text-[var(--text-muted)] font-black uppercase tracking-widest">Hozircha hech qanday chiqim topilmadi</td></tr>
            ) : withdrawals.map((w) => (
                <tr key={w.id} className="hover:bg-white/[0.04] transition-all duration-300 group/row">
                    <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 group-hover/row:bg-red-500 group-hover/row:text-white transition-all">
                                <TrendingDown size={22} strokeWidth={1.5} />
                            </div>
                            <div>
                                <p className="text-sm font-black text-white capitalize">{w.title}</p>
                                <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest mt-1 opacity-70 truncate max-w-[200px]">{w.description}</p>
                            </div>
                        </div>
                    </td>
                    <td className="px-8 py-6">
                        <div className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-wider">
                            <CreditCard size={14} />
                            {w.category === 'owner_withdrawal' ? 'Avans / Pul Olish' : 'Boshqa Chiqim'}
                        </div>
                    </td>
                    <td className="px-8 py-6 text-base font-black text-red-500 tabular-nums tracking-tight">{formatCurrency(w.amount)}</td>
                    <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 text-[var(--gold)]">
                                <User size={16} />
                            </div>
                            <span className="text-[11px] font-black uppercase text-[var(--text-secondary)]">{w.marked_by_name || "Super Admin"}</span>
                        </div>
                    </td>
                    <td className="px-8 py-6">
                        <div className="text-[11px] font-black text-white">{w.date}</div>
                        <div className="text-[10px] text-[var(--text-muted)] font-black">Chiqim operatsiyasi</div>
                    </td>
                    <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-2 text-emerald-500 font-black text-[10px] uppercase tracking-widest">
                            <CheckCircle2 size={14} />
                            Bajarildi
                        </div>
                    </td>
                </tr>
            ))}
        </tbody>
    </table>
);

const MobileIncomeCard = ({ item, isSuperAdmin, onVerify, onDetail }) => (
    <>
        <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-muted)]">
                    <User size={18} />
                </div>
                <div>
                    <h3 className="text-sm font-black text-white capitalize">{item.student_name}</h3>
                    <p className="text-[9px] text-[var(--gold)] font-black uppercase tracking-widest">{item.group_name}</p>
                </div>
            </div>
            <div className={`px-3 py-1.5 rounded-xl border text-[8px] font-black uppercase tracking-widest ${item.payment_method === 'cash' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-blue-500/10 border-blue-500/20 text-blue-500'}`}>
                {item.payment_method === 'cash' ? 'Naqd' : 'Click/Card'}
            </div>
        </div>
        <div className="flex justify-between items-end">
            <div className="space-y-1">
                <p className="text-[8px] text-[var(--text-muted)] font-black uppercase tracking-widest">To'lov summasi</p>
                <p className="text-lg font-black text-white tabular-nums">{formatCurrency(item.amount)}</p>
                {item.refund_amount > 0 && !item.refund_ignored && (
                    <p className="text-[9px] font-bold text-emerald-400">Refund: -{formatCurrency(item.refund_amount)}</p>
                )}
                {item.refund_amount > 0 && item.refund_ignored && (
                    <p className="text-[9px] font-bold text-amber-400">Refund bekor</p>
                )}
            </div>
            <div className="flex gap-2">
                {isSuperAdmin && !item.is_verified && (
                    <button onClick={() => onVerify(item.id)} className="w-10 h-10 flex items-center justify-center bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl active:scale-90 transition-all"><CheckCircle2 size={16} /></button>
                )}
                <button onClick={() => onDetail(item)} className="w-10 h-10 flex items-center justify-center bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/20 rounded-xl active:scale-90 transition-all"><FileText size={16} /></button>
            </div>
        </div>
        <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">
            <span>{new Date(item.paid_at).toLocaleDateString('uz-UZ')}</span>
            <span className="flex items-center gap-1"><ShieldCheck size={10} /> {item.marked_by || "Tizim"}</span>
        </div>
    </>
);

const MobileExpenseCard = ({ item }) => (
    <>
        <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                    <TrendingDown size={18} />
                </div>
                <div>
                    <h3 className="text-sm font-black text-white capitalize">{item.title}</h3>
                    <p className="text-[9px] text-red-500/60 font-black uppercase tracking-widest">Chiqim Operatsiyasi</p>
                </div>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[8px] font-black uppercase tracking-widest">
                {item.category === 'owner_withdrawal' ? 'Avans' : 'Boshqa'}
            </div>
        </div>
        <div className="mb-4">
            <p className="text-[9px] text-[var(--text-muted)] font-black uppercase tracking-widest mb-1">Chiqim summasi</p>
            <p className="text-xl font-black text-red-500 tabular-nums">{formatCurrency(item.amount)}</p>
        </div>
        <div className="pt-4 border-t border-white/5 flex justify-between items-center text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">
            <span>{item.date}</span>
            <span className="flex items-center gap-1 text-emerald-500"><CheckCircle2 size={10} /> Bajarildi</span>
        </div>
    </>
);

const KassaContent = ({ activeTab, payments, withdrawals, loading, isSuperAdmin, onVerify, onDetail }) => {
    const data = activeTab === 'incomes' ? payments : withdrawals;
    const onReceipt = (url) => window.open(url, '_blank');

    return (
        <div className="relative">
            {/* Desktop Table View */}
            <div className="hidden lg:block lux-card !p-0 !rounded-[2.5rem] overflow-hidden border-[var(--border-glass)] shadow-2xl bg-[var(--bg-panel)]/20 backdrop-blur-xl">
                <div className="overflow-x-auto">
                    {activeTab === "incomes" ? (
                        <IncomeTable
                            payments={payments}
                            loading={loading}
                            isSuperAdmin={isSuperAdmin}
                            onVerify={onVerify}
                            onDetail={onDetail}
                            onReceipt={onReceipt}
                        />
                    ) : (
                        <ExpenseTable withdrawals={withdrawals} loading={loading} />
                    )}
                </div>
            </div>

            {/* Mobile/Tablet Card View */}
            <div className="lg:hidden space-y-4">
                {loading ? (
                    <div className="p-20 text-center text-[var(--gold)] animate-pulse font-black uppercase tracking-widest">Yuklanmoqda...</div>
                ) : data.length === 0 ? (
                    <div className="p-20 text-center text-[var(--text-muted)] font-black uppercase tracking-widest">Hech qanday ma'lumot topilmadi</div>
                ) : data.map((item) => (
                    <div key={item.id} className="p-5 bg-[var(--bg-panel)]/40 border border-[var(--border-glass)] rounded-3xl backdrop-blur-xl relative overflow-hidden active:scale-[0.98] transition-all">
                        {activeTab === 'incomes' ? (
                            <MobileIncomeCard
                                item={item}
                                isSuperAdmin={isSuperAdmin}
                                onVerify={onVerify}
                                onDetail={onDetail}
                            />
                        ) : (
                            <MobileExpenseCard item={item} />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default KassaContent;
