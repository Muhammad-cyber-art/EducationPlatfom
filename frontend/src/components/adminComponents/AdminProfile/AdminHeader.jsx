import React from"react";
import GoBackButton from"../../sendback";
import { LogOut as LogOutIcon, ArrowRightLeft, Edit3, Trash2, Save, X } from"lucide-react";

const AdminHeader = ({
 admin_id,
 user_info,
 isEditModalOpen,
 editForm,
 dispatch,
 handleEditOpen,
 archiveMutation,
 updateMutation,
 LogOut
}) => {
 return (
 <div className="sticky top-0 z-40 bg-[var(--bg-void)] border-b border-[var(--border-glass)] px-4 py-3 md:px-8 transition-all">
 <div className="max-w-6xl mx-auto flex items-center justify-between">
 <div className="flex items-center gap-4">
 <GoBackButton />
 <span className="hidden md:block text-[10px] font-black text-[var(--text-muted)] capitalize tracking-[0.3em]">Xodim Profili</span>
 </div>

 {/* Action Buttons */}
 <div className="flex items-center gap-2">
 {!admin_id ? (
 <button onClick={LogOut} className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 rounded-xl text-[10px] font-black capitalize tracking-widest transition-all shadow-lg shadow-red-500/10 active:scale-95">
 Chiqish <LogOutIcon size={14} className="inline ml-1" />
 </button>
 ) : user_info.role ==="super_admin" ? (
 <>
 {!isEditModalOpen && (
 <div className="flex items-center gap-2">
 <button onClick={() => dispatch({ type:'TOGGLE_TRANSFER_MODAL', payload: true })} className="p-2.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--text-muted)] hover:text-amber-500 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all active:scale-95 group" title="Ko'chirish">
 <ArrowRightLeft size={18} className="group-hover:scale-110 transition-transform" />
 </button>
 <button onClick={handleEditOpen} className="p-2.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--text-muted)] hover:text-blue-500 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all active:scale-95 group" title="Tahrirlash">
 <Edit3 size={18} className="group-hover:scale-110 transition-transform" />
 </button>
 <button onClick={() => { const r = prompt("O'chirish uchun sababni kiriting:"); if (r !== null) archiveMutation.mutate(r) }} className="p-2.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--text-muted)] hover:text-red-500 hover:border-red-500/50 hover:bg-red-500/5 transition-all active:scale-95 group" title="O'chirish">
 <Trash2 size={18} className="group-hover:scale-110 transition-transform" />
 </button>
 </div>
 )}
 {isEditModalOpen && (
 <div className="flex items-center gap-2">
 <button onClick={() => updateMutation.mutate(editForm)} className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all active:scale-95 flex items-center gap-2" title="Saqlash">
 <Save size={18} /> <span className="text-[10px] font-black capitalize tracking-widest hidden sm:inline">Saqlash</span>
 </button>
 <button onClick={() => dispatch({ type:'TOGGLE_EDIT_MODAL', payload: false })} className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-95 flex items-center gap-2" title="Bekor qilish">
 <X size={18} /> <span className="text-[10px] font-black capitalize tracking-widest hidden sm:inline">Bekor qilish</span>
 </button>
 </div>
 )}
 </>
 ) : null}
 </div>
 </div>
 </div>
 );
};

export default AdminHeader;
