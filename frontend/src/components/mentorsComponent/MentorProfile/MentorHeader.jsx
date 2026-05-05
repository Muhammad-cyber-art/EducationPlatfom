import React from"react";
import { X, Check, ArrowRightLeft, Edit3, Shield, Trash2 } from"lucide-react";

const MentorHeader = ({ 
 mentor, 
 isEditing, 
 editData, 
 canEditMentor, 
 isSuperAdmin, 
 dispatch, 
 handleUpdate, 
 handleDelete 
}) => {
 const mentorColor = mentor.color ||'#b8860b';

 return (
 <div className="pb-4 border-b border-[var(--border-glass)] overflow-hidden">
 <div className="flex items-center gap-3 sm:gap-5 min-w-0">
 {/* Avatar */}
 <div className="relative shrink-0">
 <div
 className="w-14 h-14 sm:w-18 sm:h-18 rounded-2xl overflow-hidden bg-[var(--bg-panel)] border border-[var(--border-glass)] p-1 shadow-lg"
 style={{ boxShadow: `0 8px 24px ${mentorColor}20` }}>
 <div className="w-full h-full rounded-xl overflow-hidden bg-[var(--bg-void)] flex items-center justify-center">
 {mentor.image ? (
 <img src={mentor.image} className="w-full h-full object-cover" alt="" />
 ) : (
 <span className="text-lg sm:text-2xl font-black tracking-tighter" style={{ color: mentorColor }}>
 {mentor.first_name?.[0]}{mentor.last_name?.[0]}
 </span>
 )}
 </div>
 </div>
 <div
 className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[var(--bg-void)] shadow-lg"
 style={{ background: mentorColor }}
 />
 </div>

 {/* Name & Info */}
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-2 mb-1 min-w-0">
 <h1 className="text-base sm:text-xl font-black text-[var(--text-primary)] tracking-tight capitalize leading-tight truncate">
 {isEditing
 ? `${editData.first_name ||""} ${editData.last_name ||""}`
 : `${mentor.first_name} ${mentor.last_name}`}
 </h1>
 </div>
 <div className="flex flex-wrap items-center gap-2">
 <div
 className="px-2 py-0.5 rounded-full border text-[8px] font-black capitalize tracking-widest bg-[var(--gold-dim)] shadow-inner shrink-0 max-w-[120px] truncate"
 style={{ color: mentorColor, borderColor: `${mentorColor}40` }}
 >
 {isEditing ? (editData.subject ||"Mentor") : (mentor.subject ||"Mentor")}
 </div>
 <p className="text-[8px] text-[var(--text-muted)] font-black capitalize tracking-widest flex items-center gap-1 shrink-0">
 Status: <span className="text-emerald-500">Faol</span>
 <span className="opacity-40">•</span>
 ID: {mentor.id?.toString().padStart(4,'0')}
 </p>
 </div>
 </div>
 </div>

 {/* ACTION BUTTONS */}
 {canEditMentor && !isEditing && (
 <div className="mt-4 flex flex-row gap-2">
 <button
 onClick={() => dispatch({ type:"TOGGLE_TRANSFER_MODAL", payload: true })}
 className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-[var(--bg-panel)] border border-amber-500/30 text-amber-500 font-bold text-[10px] capitalize tracking-wide hover:bg-amber-500/10 active:scale-[0.97] transition-all"
 >
 <ArrowRightLeft size={14} />
 <span className="truncate">Transfer</span>
 </button>
 <button
 onClick={() => dispatch({ type:"START_EDITING" })}
 className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-[var(--bg-panel)] border border-blue-500/30 text-blue-400 font-bold text-[10px] capitalize tracking-wide hover:bg-blue-500/10 active:scale-[0.97] transition-all"
 >
 <Edit3 size={14} />
 <span>Tahrirlash</span>
 </button>
 {isSuperAdmin && (
 <button
 onClick={() => dispatch({ type:'TOGGLE_PERM_MODAL', payload: true })}
 className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-[var(--bg-panel)] border border-[var(--gold)]/30 text-[var(--gold)] font-bold text-[10px] capitalize tracking-wide hover:bg-[var(--gold)]/10 active:scale-[0.97] transition-all"
 >
 <Shield size={14} />
 <span>Ruxsatlar</span>
 </button>
 )}
 <button
 onClick={handleDelete}
 className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-[var(--bg-panel)] border border-red-500/30 text-red-400 font-bold text-[10px] capitalize tracking-wide hover:bg-red-500/10 active:scale-[0.97] transition-all"
 >
 <Trash2 size={14} />
 <span>O'chirish</span>
 </button>
 </div>
 )}

 {isEditing && (
 <div className="mt-4 flex flex-row gap-2">
 <button
 onClick={handleUpdate}
 className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 font-bold text-[10px] capitalize tracking-wide hover:bg-emerald-500/20 active:scale-[0.97] transition-all"
 >
 <Check size={14} />
 <span>Saqlash</span>
 </button>
 <button
 onClick={() => dispatch({ type:"SET_FIELD", field:"isEditing", value: false })}
 className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--text-secondary)] font-bold text-[10px] capitalize tracking-wide hover:bg-white/5 active:scale-[0.97] transition-all"
 >
 <X size={14} />
 <span>Bekor qilish</span>
 </button>
 </div>
 )}
 </div>
 );
};

export default MentorHeader;
