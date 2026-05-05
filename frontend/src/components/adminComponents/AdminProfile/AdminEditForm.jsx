import React from"react";
import { User, ShieldCheck, Phone, EyeOff, Eye, Save, X, Loader2 } from"lucide-react";

const AdminEditForm = ({
 editForm,
 showPassword,
 updateMutation,
 dispatch
}) => {
 return (
 <div className="space-y-10 animate-in fade-in zoom-in-95 duration-500 pb-10">
 <div className="flex flex-col items-center gap-2 mb-8">
 <span className="text-[10px] sm:text-[11px] font-black text-[var(--gold)] capitalize tracking-[0.5em]">Tahrirlash rejimi</span>
 <h3 className="text-base sm:text-lg font-black text-[var(--text-primary)] capitalize tracking-widest">Profil ma'lumotlarini o'zgartirish</h3>
 <div className="w-16 h-0.5 bg-[var(--gold)]/40 rounded-full mt-2" />
 </div>

 <div className="lux-card !p-6 sm:!p-10 border-[var(--gold)]/20 shadow-[0_20px_60px_-15px_rgba(184,134,11,0.1)]">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
 {/* Personal Info Group */}
 <div className="space-y-6">
 <h4 className="text-[11px] font-black text-[var(--gold)] capitalize tracking-[0.3em] pb-3 border-b border-[var(--border-glass)] flex items-center gap-2">
 <User size={14} /> Shaxsiy ma'lumotlar
 </h4>
 <div className="grid grid-cols-1 gap-5">
 <div className="space-y-2">
 <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1">Ism</label>
 <input
 className="lux-input !bg-[var(--bg-void)]/50 !py-3.5 !px-5 w-full"
 value={editForm.first_name ||""}
 onChange={(e) => dispatch({ type:"UPDATE_EDIT_FIELD", payload: { first_name: e.target.value } })}
 placeholder="Ismni kiriting"
 />
 </div>
 <div className="space-y-2">
 <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1">Familiya</label>
 <input
 className="lux-input !bg-[var(--bg-void)]/50 !py-3.5 !px-5 w-full"
 value={editForm.last_name ||""}
 onChange={(e) => dispatch({ type:"UPDATE_EDIT_FIELD", payload: { last_name: e.target.value } })}
 placeholder="Familiyani kiriting"
 />
 </div>
 </div>
 </div>

 {/* Account Info Group */}
 <div className="space-y-6">
 <h4 className="text-[11px] font-black text-[var(--gold)] capitalize tracking-[0.3em] pb-3 border-b border-[var(--border-glass)] flex items-center gap-2">
 <ShieldCheck size={14} /> Hisob va Aloqa
 </h4>
 <div className="space-y-5">
 <div className="space-y-2">
 <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1">Username</label>
 <input
 className="lux-input !bg-[var(--bg-void)]/50 !py-3.5 !px-5 w-full"
 value={editForm.username ||""}
 onChange={(e) => dispatch({ type:"UPDATE_EDIT_FIELD", payload: { username: e.target.value } })}
 placeholder="Username"
 />
 </div>
 <div className="space-y-2">
 <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1">Telefon</label>
 <div className="relative">
 <input
 className="lux-input !bg-[var(--bg-void)]/50 !py-3.5 !pl-12 !pr-5 w-full"
 value={editForm.phone_number ||""}
 onChange={(e) => dispatch({ type:"UPDATE_EDIT_FIELD", payload: { phone_number: e.target.value } })}
 placeholder="Telefon raqami"
 />
 <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
 </div>
 </div>
 <div className="space-y-2">
 <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1">Yangi Parol (ixtiyoriy)</label>
 <div className="relative">
 <input
 type={showPassword ?"text" :"password"}
 className="lux-input !bg-[var(--bg-void)]/50 !py-3.5 !pl-5 !pr-12 w-full"
 value={editForm.password ||""}
 onChange={(e) => dispatch({ type:"UPDATE_EDIT_FIELD", payload: { password: e.target.value } })}
 placeholder="••••••••"
 />
 <button
 type="button"
 onClick={() => dispatch({ type:'TOGGLE_SHOW_PASSWORD' })}
 className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--gold)] transition-colors"
 >
 {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
 </button>
 </div>
 </div>
 </div>
 </div>
 </div>

 <div className="mt-12 pt-8 border-t border-[var(--border-glass)] flex flex-wrap items-end justify-between gap-6">
 <div className="flex flex-col">
 <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1 mb-2">Admin holati</label>
 <select
 className="lux-input !py-2.5 !px-5 !w-44 !text-xs !bg-[var(--bg-void)]/50"
 value={editForm.is_active === false ?"false" :"true"}
 onChange={(e) => dispatch({ type:"UPDATE_EDIT_FIELD", payload: { is_active: e.target.value ==="true" } })}
 >
 <option value="true">Faol</option>
 <option value="false">Faol emas</option>
 </select>
 </div>

 <div className="flex items-center gap-4">
 <button
 onClick={() => dispatch({ type:'TOGGLE_EDIT_MODAL', payload: false })}
 className="px-8 py-3 rounded-xl border border-[var(--border-glass)] text-[10px] font-black capitalize tracking-widest hover:bg-white/5 transition-all text-[var(--text-secondary)]"
 >
 Bekor qilish
 </button>
 <button
 onClick={() => updateMutation.mutate(editForm)}
 disabled={updateMutation.isPending}
 className="lux-btn-primary px-10 py-3 rounded-xl text-[10px] font-black capitalize tracking-widest shadow-[0_10px_30px_rgba(184,134,11,0.3)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
 >
 {updateMutation.isPending ? <Loader2 className="animate-spin" size={16} /> :"Saqlash"}
 </button>
 </div>
 </div>
 </div>
 </div>
 );
};

export default AdminEditForm;
