import React from"react";
import { UserCheck, Trash2, Phone, Info } from"lucide-react";

const WaitingStudentCard = ({ student, onDelete, onAssignClick }) => {
 return (
 <div className="lux-card group hover:translate-y-[-4px] transition-all duration-500 overflow-hidden">
 {/* Card Header Background */}
 <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
 <UserCheck size={80} className="text-[var(--gold)]" />
 </div>

 <div className="p-6 relative">
 <div className="flex justify-between items-start mb-6">
 <div className="flex items-center gap-4">
 <div className="w-14 h-14 rounded-2xl bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-xl font-black text-[var(--gold)] shadow-[var(--gold-glow)] capitalize">
 {student.full_name.charAt(0)}
 </div>
 <div>
 <h4 className="text-lg font-bold text-[var(--text-primary)] leading-tight">{student.full_name}</h4>
 <p className="text-[10px] font-black capitalize tracking-wider text-[var(--gold)] mt-1 opacity-80">{student.subject ||"Umumiy yo'nalish"}</p>
 </div>
 </div>
 <div className="flex gap-2">
 <button
 onClick={() => onAssignClick(student)}
 className="w-10 h-10 rounded-xl bg-[var(--gold-dim)] text-[var(--gold)] flex items-center justify-center hover:bg-[var(--gold)] hover:text-black transition-all border border-[var(--gold)]/20"
 title="Guruhga biriktirish"
 >
 <UserCheck size={18} />
 </button>
 <button
 onClick={() => onDelete(student.id)}
 className="w-10 h-10 rounded-xl bg-red-500/5 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all border border-red-500/10"
 title="O'chirish"
 >
 <Trash2 size={18} />
 </button>
 </div>
 </div>

 <div className="space-y-4 mb-6">
 <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-void)]/50 border border-[var(--border-glass)]">
 <Phone size={14} className="text-[var(--text-muted)]" />
 <span className="text-xs font-bold text-[var(--text-primary)]">{student.phone}</span>
 </div>
 {student.notes && (
 <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--bg-void)]/30">
 <Info size={14} className="text-[var(--text-muted)] mt-0.5 shrink-0" />
 <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
"{student.notes}"
 </p>
 </div>
 )}
 </div>

 <div className="flex items-center justify-between pt-4 border-t border-[var(--border-glass)]">
 <div className="flex items-center gap-2">
 <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
 <span className="text-[9px] font-black capitalize tracking-widest text-[var(--text-muted)]">
 Qo'shilgan: {new Date(student.created_at).toLocaleDateString()}
 </span>
 </div>
 </div>
 </div>
 </div>
 );
};

export default WaitingStudentCard;
