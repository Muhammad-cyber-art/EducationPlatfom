import React from"react";
import { MapPin, Building2, X } from"lucide-react";

const AdminBranches = ({
 admin,
 staffBranches,
 removeBranchMutation
}) => {
 if (staffBranches.length === 0) return null;

 return (
 <div className="space-y-4 pt-4 border-t border-[var(--border-glass)]">
 <div className="flex items-center justify-between px-1">
 <h3 className="text-[10px] md:text-[11px] font-black text-[var(--text-muted)] capitalize tracking-[0.2em] flex items-center gap-2">
 <MapPin size={14} className="text-[var(--gold)]" /> Qo'shimcha Filiallar
 </h3>
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
 {staffBranches.filter(b => b.branch).map(branchAccess => {
 const isMain = admin.branch?.id === branchAccess.branch.id;
 return (
 <div key={branchAccess.id} className={`flex items-center justify-between p-3.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] group hover:border-[var(--gold)]/30 transition-all ${isMain ?'bg-[var(--gold)]/5 border-[var(--gold)]/20' :''}`}>
 <div className="flex items-center gap-3">
 <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isMain ?'bg-[var(--gold)]/20 text-[var(--gold)]' :'bg-[var(--bg-void)] text-[var(--text-secondary)]'}`}>
 <Building2 size={16} />
 </div>
 <div>
 <h4 className="text-[10px] font-black text-[var(--text-primary)] capitalize tracking-wide">{branchAccess.branch.name}</h4>
 <p className="text-[8px] text-[var(--text-muted)] capitalize tracking-wider font-bold">{branchAccess.access_level ||'Kirish'}</p>
 </div>
 </div>
 {!isMain && (
 <button onClick={() => removeBranchMutation.mutate(branchAccess.id)} className="p-2 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all" title="O'chirish">
 <X size={16} />
 </button>
 )}
 </div>
 );
 })}
 </div>
 </div>
 );
};

export default AdminBranches;
