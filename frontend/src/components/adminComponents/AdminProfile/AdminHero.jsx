import React from"react";
import { Activity, Hash } from"lucide-react";

const AdminHero = ({ admin }) => {
 return (
 <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10 p-6 md:p-8 rounded-3xl bg-[var(--bg-panel)] border border-[var(--border-glass)] shadow-2xl relative overflow-hidden group">
 <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--gold)]/0 via-[var(--gold)]/50 to-[var(--gold)]/0 opacity-50 group-hover:opacity-100 transition-opacity duration-700" />

 {/* Avatar Box */}
 <div className="relative shrink-0">
 <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-[var(--bg-void)] border border-[var(--border-glass)] p-1.5 shadow-[0_0_30px_rgba(184,134,11,0.1)] group-hover:shadow-[0_0_40px_rgba(184,134,11,0.2)] transition-shadow duration-500">
 <div className="w-full h-full rounded-xl overflow-hidden bg-[var(--bg-panel)] flex items-center justify-center">
 {admin.image ? (
 <img src={admin.image} className="w-full h-full object-cover" alt="Avatar" />
 ) : (
 <div className="flex flex-col items-center">
 <span className="text-2xl md:text-3xl font-black text-[var(--gold)]">{admin.first_name?.[0]}{admin.last_name?.[0]}</span>
 </div>
 )}
 </div>
 </div>
 <div className="absolute -bottom-2 -right-2 px-3 py-1 bg-[var(--gold)] text-black text-[8px] md:text-[9px] font-black capitalize tracking-widest rounded-lg shadow-lg border border-white/20 z-10">
 {admin.role ==='super_admin' ?'Super Admin' :'Admin'}
 </div>
 </div>

 {/* Info Text */}
 <div className="flex-1 text-center md:text-left space-y-3">
 <div>
 <h1 className="text-2xl md:text-4xl font-black text-[var(--text-primary)] tracking-tighter capitalize leading-none mb-1">{admin.first_name} {admin.last_name}</h1>
 <p className="text-[11px] font-bold text-[var(--gold)] capitalize tracking-[0.3em] opacity-80 pl-0.5">@{admin.username}</p>
 </div>

 <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-1">
 <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] font-black capitalize tracking-widest">
 <Activity size={12} /> Faol Status
 </span>
 <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-void)] text-[var(--text-muted)] border border-[var(--border-glass)] text-[9px] font-black capitalize tracking-widest">
 <Hash size={12} /> ID: {admin.id}
 </span>
 </div>
 </div>
 </div>
 );
};

export default AdminHero;
