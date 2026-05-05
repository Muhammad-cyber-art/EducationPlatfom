import React from"react";
import { User, Camera, ShieldCheck, Activity, Send, Phone } from"lucide-react";

const StudentProfileHeader = ({
 studentData,
 isEditing,
 editData,
 previewImage,
 primaryPayment,
 student_id,
 dispatch,
 handleImageChange
}) => {
 return (
 <div className="flex flex-col md:flex-row items-center md:items-start gap-6 pb-10 border-b border-[var(--border-glass)] relative">
 <div className="relative group/avatar shrink-0">
 <div
 className="w-24 h-24 sm:w-32 sm:h-32 rounded-[2rem] overflow-hidden bg-[var(--bg-panel)] border border-[var(--border-glass)] p-1.5 shadow-lg relative"
 style={{ boxShadow: window.innerWidth > 1024 ? `0 20px 50px ${primaryPayment?.is_paid ?"#10b98115" :"#ef444415"}` :'none' }}
 >
 <div className="w-full h-full rounded-[1.6rem] overflow-hidden bg-[var(--bg-void)] flex items-center justify-center relative">
 {previewImage ? (
 <img src={previewImage} className="w-full h-full object-cover" alt="" />
 ) : studentData?.image ? (
 <img src={studentData.image} className="w-full h-full object-cover" alt="" />
 ) : (
 <div className="flex flex-col items-center gap-1 opacity-40">
 <User size={32} className="text-[var(--gold)]" />
 <span className="text-[8px] font-black capitalize tracking-widest text-center mt-1">{studentData?.full_name?.[0]}</span>
 </div>
 )}

 {isEditing && (
 <label className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center cursor-pointer opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-300">
 <Camera size={24} className="text-[var(--gold)] mb-2" />
 <span className="text-[8px] font-black text-white capitalize tracking-widest">Rasmni o'zgartirish</span>
 <input type="file" className="hidden" onChange={handleImageChange} />
 </label>
 )}
 </div>
 </div>
 <div
 className={`absolute -bottom-2 -right-2 w-8 h-8 rounded-full border-[6px] border-[var(--bg-void)] shadow-2xl flex items-center justify-center ${primaryPayment?.is_paid ?"bg-emerald-500" :"bg-red-500"}`}
 >
 {primaryPayment?.is_paid ? <ShieldCheck size={12} className="text-white" /> : <Activity size={12} className="text-white" />}
 </div>
 </div>

 <div className="flex-1 text-center md:text-left pt-2">
 <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-3">
 {isEditing ? (
 <div className="relative flex-1 max-w-md">
 <input
 className="text-2xl sm:text-4xl font-black text-[var(--text-primary)] tracking-tighter capitalize bg-[var(--bg-void)]/60 border border-[var(--border-glass)] rounded-xl px-4 py-1 w-full outline-none focus:border-[var(--gold)]/50 transition-all"
 value={editData.full_name ||""}
 onChange={e => dispatch({ type:'UPDATE_EDIT_FIELD', payload: { full_name: e.target.value } })}
 placeholder="F.I.SH"
 />
 <div className="absolute -top-2 -left-2 px-2 py-0.5 bg-[var(--gold)] text-black text-[7px] font-black capitalize tracking-widest rounded-md">Ism-sharif tahrirlash</div>
 </div>
 ) : (
 <h1 className="text-2xl sm:text-4xl font-black text-[var(--text-primary)] tracking-tighter capitalize">
 {studentData?.full_name}
 </h1>
 )}

 <div className="flex flex-wrap items-center gap-2">
 <div className="w-fit px-3 py-1 rounded-full border border-[var(--border-glass)] text-[9px] font-black capitalize tracking-[0.3em] bg-[var(--bg-void)]/60 text-[var(--gold)] shadow-inner">
 Protocol: <span className="opacity-60">#{student_id}</span>
 </div>

 {studentData?.joined_at && (
 <div className="w-fit px-3 py-1 rounded-full border border-emerald-500/20 text-[9px] font-black capitalize tracking-[0.1em] bg-emerald-500/5 text-emerald-500 shadow-inner">
 Tizimga qo'shildi: <span className="opacity-80 font-normal">{new Date(studentData.joined_at).toLocaleDateString()}</span>
 </div>
 )}

 {studentData?.telegram_id && (
 <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0088cc]/10 border border-[#0088cc]/20 text-[#0088cc] shadow-lg animate-pulse" title="Telegram Botga ulangan">
 <Send size={10} className="fill-current" />
 <span className="text-[8px] font-black capitalize tracking-widest">BOT ACTIVE</span>
 </div>
 )}
 </div>
 </div>

 <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
 {!isEditing && studentData?.phone && (
 <div className="flex items-center gap-2 text-[var(--text-secondary)] text-[10px] font-bold capitalize tracking-widest bg-[var(--bg-panel)]/40 px-3 py-1.5 rounded-xl border border-[var(--border-glass)]">
 <Phone size={12} className="text-[var(--gold)] opacity-50" />
 {studentData.phone}
 </div>
 )}
 </div>
 </div>
 </div>
 );
};

export default StudentProfileHeader;
