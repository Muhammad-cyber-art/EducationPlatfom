import React from"react";
import GoBackButton from"../../sendback";
import { Save, X, Edit3, Layers, Trash2 } from"lucide-react";

const StudentHeader = ({
 studentData,
 isEditing,
 canEditStudent,
 userRole,
 handleSaveEdit,
 dispatch,
 archiveMutation,
 student_id
}) => {
 return (
 <div className="flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-[100] bg-[var(--bg-void)] py-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:static sm:bg-transparent">
 <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
 <GoBackButton />
 <div className="h-6 w-px bg-[var(--border-glass)] hidden sm:block"></div>
 <h1 className="text-base sm:text-lg font-bold text-[var(--text-primary)] truncate capitalize tracking-tight">
 {studentData?.full_name}
 </h1>
 </div>

 <div className="flex items-center gap-2 shrink-0">
 {canEditStudent && (
 <div className="flex gap-1 bg-[var(--bg-panel)] p-0.5 sm:p-1 rounded-xl border border-[var(--border-glass)] shadow-xl">
 {isEditing ? (
 <>
 <button onClick={handleSaveEdit} className="p-2 sm:p-2.5 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-all" title="Saqlash">
 <Save size={18} />
 </button>
 <button onClick={() => dispatch({ type:'SET_EDITING', payload: false })} className="p-2 sm:p-2.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-all" title="Bekor qilish">
 <X size={18} />
 </button>
 </>
 ) : (
 <>
 <button onClick={() => dispatch({ type:'SET_EDITING', payload: true })} className="p-2 sm:p-2.5 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all" title="Tahrirlash">
 <Edit3 size={18} />
 </button>
 {(userRole ==='admin' || userRole ==='super_admin') && (
 <button onClick={() => dispatch({ type:'TOGGLE_MERGE_MODAL', payload: true })} className="p-2 sm:p-2.5 text-amber-500 hover:bg-amber-500/10 rounded-lg transition-all" title="Birlashtirish">
 <Layers size={18} />
 </button>
 )}
 <button
 onClick={() => { const r = prompt("O'chirish sababi:"); if (r) archiveMutation.mutate(r); }}
 className="p-2 sm:p-2.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
 title="O'chirish"
 >
 <Trash2 size={18} />
 </button>
 </>
 )}
 </div>
 )}
 </div>
 </div>
 );
};

export default StudentHeader;
