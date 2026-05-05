import React from"react";
import { X, Loader2, Save } from"lucide-react";

const MentorPermissionsModal = ({ isOpen, onClose, labels, permissions, dispatch, mutation }) => {
 if (!isOpen) return null;

 return (
 <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-3xl animate-in fade-in duration-300">
 <div className="w-full max-w-[340px] lux-card !bg-[var(--bg-panel)]/95 shadow-2xl !p-6 md:!p-8 border border-[var(--border-glass)]">
 <div className="flex justify-between items-center mb-6 md:mb-8 border-b border-[var(--border-glass)] pb-4">
 <h3 className="text-[10px] font-black text-[var(--gold)] capitalize tracking-[0.3em]">USTOZ HUQUQLARI</h3>
 <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white transition-all p-1 hover:bg-white/10 rounded-lg">
 <X size={18} />
 </button>
 </div>
 <div className="space-y-3">
 {Object.keys(labels).map((key) => (
 <div key={key} className="flex justify-between items-center p-3 rounded-xl bg-[var(--bg-void)]/40 border border-[var(--border-glass)] hover:bg-[var(--bg-void)]/80 transition-colors">
 <span className="text-[10px] font-black text-[var(--text-primary)] capitalize tracking-widest">{labels[key]}</span>
 <button
 onClick={() => dispatch({ type:'TOGGLE_PERMISSION_KEY', key })}
 className={`w-10 h-5 rounded-full relative flex items-center transition-all duration-300 ${permissions[key] ?'bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.4)]' :'bg-white/10'}`}
 >
 <div className={`absolute w-3.5 h-3.5 bg-white rounded-full transition-all duration-300 ${permissions[key] ?'left-5.5' :'left-1'}`} />
 </button>
 </div>
 ))}
 <button
 onClick={() => mutation.mutate(permissions)}
 disabled={mutation.isPending}
 className="w-full mt-6 py-3 bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-black font-black text-[10px] capitalize tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(184,134,11,0.3)] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
 >
 {mutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} SAQLASH
 </button>
 </div>
 </div>
 </div>
 );
};

export default MentorPermissionsModal;
