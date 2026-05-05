import React from"react";
import { Users, CheckCircle2 } from"lucide-react";

const KpiTable = ({
 data,
 isPercentageType,
 isStudentCountType,
 formatCurrency,
 setSelectedGroupForDebtors
}) => {
 if (isPercentageType) {
 return (
 <div className="bg-[var(--bg-panel)] border border-emerald-500/10 rounded-2xl overflow-hidden shadow-xl">
 <div className="px-5 py-4 border-b border-[var(--border-glass)] flex items-center justify-between bg-emerald-500/5">
 <div className="flex items-center gap-2 text-emerald-400">
 <Users size={16} />
 <span className="text-[11px] font-black capitalize tracking-widest">Guruhlar tahlili</span>
 </div>
 <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
 <span className="text-[8px] font-black text-emerald-400 capitalize tracking-widest">
 Real Tushum: {formatCurrency(data.groups_income)}
 </span>
 </div>
 </div>
 <div className="p-2 overflow-x-auto">
 <table className="w-full text-left">
 <thead>
 <tr className="border-b border-[var(--border-glass)]">
 <th className="px-4 py-3 text-[8px] font-black text-[var(--text-muted)] capitalize tracking-[0.2em]">Guruh</th>
 <th className="px-4 py-3 text-[8px] font-black text-[var(--text-muted)] capitalize tracking-[0.2em] text-center">Talaba</th>
 <th className="px-4 py-3 text-[8px] font-black text-[var(--text-muted)] capitalize tracking-[0.2em] text-right">Sof Tushum</th>
 <th className="px-4 py-3 text-[8px] font-black text-[var(--text-muted)] capitalize tracking-[0.2em] text-right text-emerald-400">Ulushingiz</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-[var(--border-glass)]">
 {data.mentor_groups?.map((group) => (
 <tr key={group.id} className="hover:bg-emerald-500/[0.02] transition-colors group">
 <td className="px-4 py-3.5">
 <p className="text-[10px] font-black text-[var(--text-primary)] leading-tight capitalize">{group.name}</p>
 <p className="text-[8px] text-[var(--text-muted)] font-black capitalize tracking-widest opacity-60 group-hover:opacity-100">{group.branch_name ||"Asosiy"}</p>
 </td>
 <td className="px-4 py-3.5 text-center">
 <span className="text-[10px] font-black">{group.students_count}</span>
 </td>
 <td className="px-4 py-3.5 text-right font-black text-[10px] text-[var(--text-secondary)] tabular-nums">
 {formatCurrency(group.real_income || group.monthly_income)}
 </td>
 <td className="px-4 py-3.5 text-right font-black text-[10px] text-emerald-400 tabular-nums">
 {formatCurrency((group.real_income || group.monthly_income) * (data.commission_percentage / 100))}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 );
 }

 if (isStudentCountType) {
 return (
 <div className="bg-[var(--bg-panel)] border border-blue-500/10 rounded-2xl overflow-hidden shadow-xl">
 <div className="px-5 py-4 border-b border-[var(--border-glass)] flex items-center justify-between bg-blue-500/5">
 <div className="flex items-center gap-2 text-blue-400">
 <Users size={16} />
 <span className="text-[11px] font-black capitalize tracking-widest">O'quvchilar tahlili</span>
 </div>
 </div>
 <div className="p-2 overflow-x-auto">
 <table className="w-full text-left">
 <thead>
 <tr className="border-b border-[var(--border-glass)]">
 <th className="px-4 py-3 text-[8px] font-black text-[var(--text-muted)] capitalize tracking-widest">Guruh & Narx</th>
 <th className="px-4 py-3 text-[8px] font-black text-[var(--text-muted)] capitalize tracking-widest text-center">To'lov / Jami</th>
 <th className="px-4 py-3 text-[8px] font-black text-[var(--text-muted)] capitalize tracking-widest text-right">Tushum (Real/Max)</th>
 <th className="px-4 py-3 text-[8px] font-black text-[var(--text-muted)] capitalize tracking-widest text-right text-blue-400">Mentor ulushi</th>
 <th className="px-4 py-3 text-[8px] font-black text-[var(--text-muted)] capitalize tracking-widest text-center">Qarzdorlar</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-[var(--border-glass)]">
 {data.mentor_groups?.map((group) => (
 <tr key={group.id} className="hover:bg-blue-500/[0.02] transition-colors group">
 <td className="px-4 py-3.5">
 <p className="text-[10px] font-black text-[var(--text-primary)] leading-tight capitalize">{group.name}</p>
 <p className="text-[8px] text-blue-400 font-black capitalize tracking-widest">{formatCurrency(group.monthly_price)}</p>
 </td>
 <td className="px-4 py-3.5 text-center font-black text-[10px] text-[var(--text-primary)] tabular-nums">
 {group.paid_students_count || 0} / {group.students_count || 0}
 </td>
 <td className="px-4 py-3.5 text-right font-black text-[10px] tabular-nums whitespace-nowrap">
 <span className="text-emerald-500">{formatCurrency(group.monthly_income)}</span>
 <span className="text-[var(--text-muted)] mx-1">/</span>
 <span className="text-[var(--text-muted)]">{formatCurrency(group.expected_income)}</span>
 </td>
 <td className="px-4 py-3.5 text-right font-black text-[10px] text-blue-400 tabular-nums">
 {formatCurrency(group.mentor_share_paid || 0)}
 </td>
 <td className="px-4 py-3.5 text-center">
 {group.unpaid_students && group.unpaid_students.length > 0 ? (
 <button
 onClick={() => setSelectedGroupForDebtors(group)}
 className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/20 rounded-lg text-[8px] font-black capitalize tracking-widest transition-all flex items-center gap-1.5 mx-auto shadow-sm"
 >
 <Users size={10} />
 Qarzdorlar ({group.unpaid_students.length})
 </button>
 ) : (
 <span className="text-[8px] font-black text-emerald-500 capitalize flex items-center justify-center gap-1">
 <CheckCircle2 size={10} /> To'liq
 </span>
 )}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 );
 }

 return null;
};

export default KpiTable;
