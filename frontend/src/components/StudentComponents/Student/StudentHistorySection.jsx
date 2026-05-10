import React from"react";
import { History, CheckCircle2, Edit3, Trash2, XCircle, ArrowUpRight, ArrowDownRight, ChevronRight, LogIn } from"lucide-react";
import { PaymentCheckout } from"./Helpers";

const StudentHistorySection = ({
 payments,
 extraTransactions,
 transfers,
 canConfirmPayment,
 userRole,
 handlePaymentConfirm,
 handleDeleteHistory,
 dispatch
}) => {
 return (
 <div className="space-y-6">
 {/* TREASURY HISTORIA */}
 <div className="lux-card !p-0 overflow-hidden">
 <div className="p-6 border-b border-[var(--border-glass)] flex items-center justify-between">
 <div className="flex items-center gap-4">
 <History size={18} className="text-[var(--gold)]" />
 <span className="text-[10px] font-black text-[var(--text-primary)] capitalize tracking-[0.3em]">To'lovlar tarixi</span>
 </div>
 </div>
 <div className="divide-y divide-[var(--border-glass)]">
 {payments.length > 0 ? (
 <div className="divide-y divide-[var(--border-glass)]">
 {payments.map((p) => (
 <div key={p.id} className="p-6 flex items-center justify-between group hover:bg-[var(--gold-dim)] transition-colors">
 <div className="flex items-center gap-5">
 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-[10px] border border-[var(--border-glass)] ${p.is_paid ?'bg-emerald-500 shadow-[0_0_15px_#10b98120] text-black' :'bg-red-500 shadow-[0_0_15px_#ef444420] text-white'}`}>
 {new Date(p.month).toLocaleDateString('uz-UZ', { month:'short' }).toUpperCase()}
 </div>
 <div>
 <p className="text-sm font-bold text-[var(--text-primary)] capitalize tracking-tight flex items-center gap-2">
 {new Date(p.month).toLocaleDateString('uz-UZ', { month:'long', year:'numeric' })}
 {p.group_name && (
 <span className="text-[7px] bg-[var(--gold)]/10 text-[var(--gold)] px-2 py-0.5 rounded-full border border-[var(--gold)]/20 tracking-widest leading-none">
 {p.group_name}
 </span>
 )}
 </p>
 <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
 <p className="text-[9px] font-bold text-[var(--text-muted)] capitalize tracking-widest">To'lov #{p.id}</p>
 <p className="text-[9px] font-bold text-[var(--gold)] capitalize tracking-widest">📅 {p.lessons_count} dars</p>
 <p className="text-[9px] font-bold text-blue-400 capitalize tracking-widest">💰 {Math.floor(p.daily_price || 0).toLocaleString()} UZS/kun</p>
 {p.absences_count > 0 && (
 <p className="text-[9px] font-bold text-red-400 capitalize tracking-widest">⚠️ {p.absences_count} qoldirgan</p>
 )}
 {p.refund_amount > 0 && !p.refund_ignored && p.is_paid && (
 <p className="text-[9px] font-bold text-emerald-400 capitalize tracking-widest">✅ Refund: {Math.floor(p.refund_amount).toLocaleString()} UZS</p>
 )}
 {p.refund_amount > 0 && p.refund_ignored && p.is_paid && (
 <p className="text-[9px] font-bold text-amber-400 capitalize tracking-widest">🚫 Refund bekor qilingan</p>
 )}
 {p.notes && (
 <p className="text-[9px] font-bold text-purple-400 capitalize tracking-widest">📝 {p.notes}</p>
 )}
 </div>
 </div>
 </div>
 <div className="flex items-center gap-8">
 <p className="text-sm font-black text-[var(--text-primary)]">{p.amount?.toLocaleString()} UZS</p>
 <div className="flex items-center gap-2">
 {p.is_paid ? (
 <CheckCircle2 size={20} className="text-emerald-500" />
 ) : canConfirmPayment ? (
 <PaymentCheckout payment={p} onConfirm={handlePaymentConfirm} />
 ) : <XCircle size={20} className="text-red-500 opacity-30" />}

 {canConfirmPayment && (
 <button
 onClick={() => dispatch({ type:'TOGGLE_EDIT_PAYMENT', payload: true, payment: p })}
 className="p-3 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-black rounded-xl transition-all"
 title="Summani tahrirlash"
 >
 <Edit3 size={18} />
 </button>
 )}

 {userRole ==='super_admin' && (
 <button
 onClick={() => handleDeleteHistory(p.id)}
 className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all"
 title="O'chirish"
 >
 <Trash2 size={18} />
 </button>
 )}
 </div>
 </div>
 </div>
 ))}
 </div>
 ) : null}

 {extraTransactions?.length > 0 && (
 <div className={`${payments.length > 0 ?'border-t-4 border-[var(--border-glass)]' :''} bg-[var(--bg-void)]/30`}>
 <div className="px-6 py-4 bg-[var(--bg-panel)]/50 border-b border-[var(--border-glass)]">
 <h4 className="text-[9px] font-black text-[var(--gold)] capitalize tracking-[0.3em]">Qo'shimcha tushumlar (Portal orqali)</h4>
 </div>
 <div className="space-y-4 p-4">
 {extraTransactions?.map((tx, idx) => (
 <div key={idx} className="flex items-center justify-between p-5 bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-2xl group/item hover:border-[var(--gold)]/30 transition-all">
 <div className="flex items-center gap-4">
 <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${tx.transaction_type ==='income' ?'bg-[var(--gold)]/10 text-[var(--gold)]' :'bg-red-500/10 text-red-500'}`}>
 {tx.transaction_type ==='income' ? <ArrowUpRight size={22} /> : <ArrowDownRight size={22} />}
 </div>
 <div>
 <p className="text-[11px] font-black text-white capitalize tracking-widest">{tx.title}</p>
 <div className="flex items-center gap-2 mt-1">
 <p className="text-[9px] font-bold text-[var(--text-muted)] capitalize">{tx.date}</p>
 <span className="w-1 h-1 rounded-full bg-[var(--border-glass)]"></span>
 <p className="text-[9px] font-bold text-[var(--gold)]/60 capitalize">{tx.marked_by_name}</p>
 </div>
 {tx.description && <p className="text-[10px] text-[var(--text-muted)] mt-2 opacity-80">{tx.description}</p>}
 </div>
 </div>
 <div className="text-right">
 <p className={`text-sm font-black tracking-tighter ${tx.transaction_type ==='income' ?'text-[var(--gold)]' :'text-red-500'}`}>
 {tx.transaction_type ==='income' ?'+' :'-'}{Number(tx.amount).toLocaleString()} UZS
 </p>
 <p className="text-[8px] font-black text-[var(--text-muted)] capitalize tracking-widest mt-1 opacity-40">PORTAL</p>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {payments.length === 0 && extraTransactions.length === 0 && (
 <div className="py-20 text-center opacity-30">
 <History size={48} className="mx-auto mb-4" />
 <p className="text-[10px] font-bold capitalize tracking-widest">To'lovlar tarixi bo'sh</p>
 </div>
 )}
 </div>
 </div>

 {/* TRANSFER HISTORIA */}
 {transfers.length > 0 && (
 <div className="lux-card hover:!transform-none !p-0 overflow-hidden border-l-4 border-l-[var(--gold)]/30">
 <div className="p-6 border-b border-[var(--border-glass)] flex items-center justify-between bg-[var(--gold-dim)]">
 <div className="flex items-center gap-4">
 <History size={18} className="text-[var(--gold)]" />
 <span className="text-[10px] font-black text-[var(--text-primary)] capitalize tracking-[0.3em]">Guruhlar tarixi (Transferlar)</span>
 </div>
 </div>
 <div className="p-6 space-y-4">
 {transfers.map((tr) => (
 <div key={tr.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-2xl group/item hover:border-[var(--gold)]/30 transition-all gap-4 shadow-lg hover:shadow-[var(--gold)]/5">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-xl bg-[var(--gold)]/10 flex items-center justify-center text-[var(--gold)]">
 <LogIn size={22} />
 </div>
 <div>
 <p className="text-[11px] font-black text-white capitalize tracking-widest flex items-center gap-2">
 {tr.from_group_name} <ChevronRight size={10} className="text-[var(--gold)]" /> {tr.to_group_name}
 </p>
 <div className="flex items-center gap-2 mt-1">
 <p className="text-[9px] font-bold text-[var(--text-muted)] capitalize tracking-widest">{tr.transfer_date}</p>
 <span className="w-1 h-1 rounded-full bg-[var(--border-glass)]"></span>
 <p className="text-[9px] font-bold text-[var(--gold)]/60 capitalize tracking-widest">{tr.marked_by_name}</p>
 </div>
 {tr.reason && <p className="text-[10px] text-[var(--text-muted)] mt-2 opacity-80 leading-relaxed">{tr.reason}</p>}
 </div>
 </div>
 <div className="text-right flex flex-col items-end gap-1">
 <div className="flex items-center gap-2">
 <p className="text-[8px] font-bold text-[var(--text-muted)] capitalize">Eski guruh:</p>
 <p className="text-[10px] font-black text-white">{Number(tr.old_group_fee).toLocaleString()} UZS</p>
 </div>
 <div className="flex items-center gap-2">
 <p className="text-[8px] font-bold text-[var(--text-muted)] capitalize">Yangi guruh:</p>
 <p className="text-[10px] font-black text-[var(--gold)]">{Number(tr.new_group_fee).toLocaleString()} UZS</p>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 );
};

export default StudentHistorySection;
