import React from"react";
import { GraduationCap, MoreVertical, LogIn, LogOut, CheckCircle2, XCircle, User, CreditCard, Edit3 } from"lucide-react";
import { PaymentCheckout } from"./Helpers";

const StudentGroupsSection = ({
 groups,
 paymentsAllGroups,
 showGroupMenu,
 canConfirmPayment,
 dispatch,
 unenrollMutation,
 handlePaymentConfirm,
 navigate
}) => {
 return (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 {groups?.map(group => {
 const groupPayment = paymentsAllGroups.find(p => p.group === group.id);
 return (
 <div key={group.id} className="space-y-4">
 {/* GROUP ALIGNMENT */}
 <div className="lux-card !p-4 sm:!p-6 group cursor-pointer hover:border-[var(--gold)]/30 transition-all relative" onClick={() => navigate(`/admin/groups/${group.id}`)}>
 <div className="flex justify-between items-start mb-4 sm:mb-6">
 <div className="flex items-center gap-4">
 <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--gold)]">
 <GraduationCap size={24} />
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-[7px] sm:text-[8px] font-bold text-[var(--text-muted)] capitalize tracking-widest leading-none mb-1 sm:mb-1.5">Guruh</p>
 <h3 className="text-sm sm:text-lg font-bold text-[var(--text-primary)] capitalize tracking-tight group-hover:text-[var(--gold)] transition-colors truncate">{group.name}</h3>
 {group.days && (
 <p className="text-[8px] font-black capitalize tracking-[0.2em] mt-1.5">
 {group.days ==='even' ? (
 <span className="text-[var(--gold)] bg-[var(--gold)]/10 px-2 py-0.5 rounded-full border border-[var(--gold)]/20">Juft kunlar</span>
 ) : group.days ==='everyday' ? (
 <span className="text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Har kuni</span>
 ) : (
 <span className="text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full border border-blue-400/20">Toq kunlar</span>
 )}
 </p>
 )}
 </div>
 </div>
 <div className="relative">
 <button onClick={(e) => { e.stopPropagation(); dispatch({ type:'TOGGLE_MENU', payload: group.id }); }} className="p-2 text-[var(--text-muted)] hover:text-white transition-all"><MoreVertical size={18} /></button>

 {showGroupMenu === group.id && (
 <div className="absolute right-0 top-full mt-2 w-48 bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-xl shadow-2xl z-50 overflow-hidden animate-in zoom-in-95 duration-100 origin-top-right">
 <button
 onClick={(e) => { e.stopPropagation(); dispatch({ type:'TOGGLE_TRANSFER_MODAL', payload: true, group: group }); dispatch({ type:'TOGGLE_MENU', payload: false }); }}
 className="w-full flex items-center gap-2.5 px-4 py-3 text-[10px] font-bold text-[var(--text-primary)] capitalize tracking-wider hover:bg-[var(--gold)] hover:text-black transition-colors"
 >
 <LogIn size={14} /> Guruhni ko'chirish
 </button>
 <button
 onClick={(e) => { e.stopPropagation(); if (window.confirm("Guruhdan chiqarishni tasdiqlaysizmi?")) unenrollMutation.mutate(group.id); dispatch({ type:'TOGGLE_MENU', payload: false }); }}
 className="w-full flex items-center gap-2.5 px-4 py-3 text-[10px] font-bold text-red-500 capitalize tracking-wider hover:bg-red-500 hover:text-white transition-colors"
 >
 <LogOut size={14} /> Guruhdan chiqarish
 </button>
 </div>
 )}
 </div>
 </div>
 <div className="flex items-center justify-between text-[10px] font-bold text-[var(--text-secondary)]">
 <div className="flex items-center gap-2"><User size={12} className="opacity-40" /> {group.mentor?.first_name ||"Ustoz"}</div>
 <div className="flex items-center gap-2"><CreditCard size={12} className="opacity-40" /> {group.monthly_price?.toLocaleString()} UZS</div>
 </div>
 </div>

 {/* TREASURY STATUS FOR THIS GROUP */}
 <div className="lux-card !p-4 flex flex-col justify-between">
 <div className="flex justify-between items-center mb-4">
 <div className="flex items-center gap-4">
 <div className={`w-10 h-10 rounded-xl flex items-center justify-center border border-[var(--border-glass)] ${groupPayment?.is_paid ?'bg-emerald-500/10 text-emerald-500' :'bg-red-500/10 text-red-500'}`}>
 {groupPayment?.is_paid ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-[7px] font-bold text-[var(--text-muted)] capitalize tracking-widest leading-none mb-1">To'lov holati ({group.name})</p>
 <h3 className={`text-sm font-bold capitalize tracking-tight ${groupPayment?.is_paid ?'text-emerald-500' :'text-red-500'}`}>
 {groupPayment?.is_paid ?"To'langan" :"Qarzdorlik bor"}
 </h3>
 </div>
 </div>

 <div className="flex items-center gap-2">
 {groupPayment && canConfirmPayment && (
 <>
 <PaymentCheckout payment={groupPayment} onConfirm={handlePaymentConfirm} />
 <button
 onClick={() => dispatch({ type:'TOGGLE_EDIT_PAYMENT', payload: true, payment: groupPayment })}
 className="p-3 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-black rounded-xl transition-all"
 title="To'lovni tahrirlash"
 >
 <Edit3 size={18} />
 </button>
 </>
 )}
 </div>
 </div>
 <div className="h-1 w-full bg-[var(--bg-void)] rounded-full overflow-hidden">
 <div className={`h-full transition-all duration-1000 ${groupPayment?.is_paid ?'bg-emerald-500 w-full' :'bg-red-500 w-1/12'}`}></div>
 </div>
 </div>
 </div>
 );
 })}
 {groups?.length === 0 && (
 <div className="lux-card flex flex-col items-center justify-center py-12 opacity-40 grayscale">
 <GraduationCap size={48} className="mb-4" />
 <p className="text-[10px] font-black capitalize tracking-[0.3em]">Guruhga biriktirilmagan</p>
 </div>
 )}
 </div>
 );
};

export default StudentGroupsSection;
