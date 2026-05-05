import React from"react";
import { History, Trash2, Bookmark, CheckCircle, X } from"lucide-react";

const DetailRow = ({ label, value }) => (
 <div className="flex items-center justify-between py-0.5">
 <span className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest">{label}</span>
 <span className="text-[11px] font-bold text-[var(--text-primary)] tracking-tight">{value}</span>
 </div>
);

const PaymentHistory = ({
 data,
 staff_id,
 formatCurrency,
 isSuperAdmin,
 handleDeleteHistory,
 dispatch,
 setPayModal
}) => {
 return (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-2xl overflow-hidden shadow-lg">
 <div className="px-5 py-3 border-b border-[var(--border-glass)] flex items-center justify-between bg-[var(--bg-void)]/30">
 <div className="flex items-center gap-2">
 <History size={14} className="text-[var(--gold)]" />
 <span className="text-[10px] font-black text-[var(--text-primary)] capitalize tracking-widest">To'lov Tarixi</span>
 </div>
 </div>

 <div className="max-h-[220px] overflow-y-auto custom-scrollbar">
 <table className="w-full text-left">
 <tbody className="divide-y divide-[var(--border-glass)]">
 {data.payment_history?.map((item) => (
 <tr key={item.id} className={`hover:bg-[var(--gold-dim)] transition-colors group ${parseInt(staff_id) === item.id ?'bg-[var(--gold)]/5' :''}`}>
 <td className="px-5 py-3">
 <p className="text-[10px] font-black text-[var(--text-primary)]">{item.month}</p>
 <p className="text-[8px] font-bold text-[var(--text-muted)] capitalize">{item.is_paid ?"To'langan" :"Kutilmoqda"}</p>
 </td>
 <td className="px-5 py-3 text-[11px] font-black text-[var(--text-primary)] tabular-nums text-right flex items-center justify-end gap-3">
 <span>{formatCurrency(item.total_amount || item.amount || item.salary_base)}</span>
 {isSuperAdmin && (
 <button onClick={(e) => { e.stopPropagation(); handleDeleteHistory(item.id); }} className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100">
 <Trash2 size={12} />
 </button>
 )}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>

 <div className="bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-2xl overflow-hidden shadow-lg p-5">
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-2">
 <Bookmark size={14} className="text-[var(--gold)]" />
 <span className="text-[10px] font-black text-[var(--text-primary)] capitalize tracking-widest">Hisob Tafsiloti</span>
 </div>
 {isSuperAdmin && data.id && (
 <button onClick={() => handleDeleteHistory(data.id)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg translate-x-2" title="Joriy oyni o'chirish">
 <Trash2 size={12} />
 </button>
 )}
 </div>

 <div className="space-y-3 mb-6">
 <DetailRow label="Hisoblangan oy" value={data.month} />
 <DetailRow label="Tasdiqlangan sana" value={data.paid_at ? new Date(data.paid_at).toLocaleDateString() :"---"} />
 <DetailRow label="Tasdiqlovchi" value={data.marked_by ||"---"} />
 </div>

 {!data.is_paid ? (
 <button onClick={() => dispatch(setPayModal(true))} className="w-full py-3.5 rounded-xl bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-black font-black text-[10px] capitalize tracking-widest flex items-center justify-center gap-2 shadow-[0_10px_30px_rgba(184,134,11,0.2)] transition-all active:scale-[0.98]">
 To'lovni tasdiqlash
 </button>
 ) : (
 <div className="w-full py-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-black text-[10px] capitalize tracking-widest flex items-center justify-center gap-2">
 <CheckCircle size={14} /> To'lov yakunlangan
 </div>
 )}
 </div>
 </div>
 );
};

export default PaymentHistory;
