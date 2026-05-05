import React from"react";
import { createPortal } from"react-dom";
import { X, Users } from"lucide-react";

const DebtorsModal = ({ group, onClose, formatCurrency }) => {
 if (!group) return null;

 return createPortal(
 <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
 <div className="bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-[2.5rem] w-full max-w-lg max-h-[85vh] overflow-hidden shadow-[0_0_50px_rgba(244,63,94,0.15)] flex flex-col">
 <div className="p-6 border-b border-[var(--border-glass)] flex items-center justify-between">
 <div>
 <h4 className="text-sm font-black text-[var(--text-primary)] capitalize tracking-tight">Qarzdorlar Ro'yxati</h4>
 <p className="text-[9px] font-black text-rose-400 capitalize tracking-widest mt-1">Guruh: {group.name}</p>
 </div>
 <button
 onClick={onClose}
 className="p-2 hover:bg-rose-500/10 text-[var(--text-muted)] hover:text-rose-500 rounded-xl transition-all"
 >
 <X size={20} />
 </button>
 </div>
 <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
 {group.unpaid_students?.map((st) => (
 <div key={st.id} className="p-4 bg-[var(--bg-void)]/40 border border-[var(--border-glass)] rounded-2xl flex items-center justify-between hover:border-rose-500/30 transition-all group">
 <div className="flex items-center gap-4">
 <div className="w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-500 font-black text-xs">
 {st.name.charAt(0)}
 </div>
 <div>
 <p className="text-xs font-black text-[var(--text-primary)] capitalize leading-none">{st.name}</p>
 <p className="text-[8px] font-bold text-rose-400/60 capitalize tracking-widest mt-1.5">{st.status}</p>
 </div>
 </div>
 <div className="text-right">
 <p className="text-[10px] font-black text-rose-400 tabular-nums">{formatCurrency(st.expected)}</p>
 <p className="text-[7px] font-black text-[var(--text-muted)] capitalize tracking-widest opacity-50">Kutilayotgan to'lov</p>
 </div>
 </div>
 ))}
 </div>
 <div className="p-6 bg-rose-500/5 border-t border-[var(--border-glass)]">
 <div className="flex justify-between items-center text-xs font-black capitalize">
 <span className="text-rose-400">Jami qarz:</span>
 <span className="text-[var(--text-primary)]">{formatCurrency(group.unpaid_students?.reduce((acc, s) => acc + s.expected, 0))}</span>
 </div>
 </div>
 </div>
 </div>,
 document.body
 );
};

export default DebtorsModal;
