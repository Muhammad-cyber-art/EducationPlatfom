import React from"react";
import { Mail, Phone, ShieldCheck, Zap, Building2, Activity, ChevronRight } from"lucide-react";
import MentorsGroupCards from"../MentorsGroupCards";

const ProfileItem = React.memo(({ icon, label, value, color }) => (
 <div className="lux-card !p-3 md:!p-4 group hover:border-[var(--gold)]/30 transition-all !rounded-xl md:!rounded-2xl flex flex-col items-center text-center justify-center min-h-[90px]">
 <div className={`${color} opacity-60 group-hover:opacity-100 transition-all transform group-hover:scale-110 mb-2`}>
 {React.cloneElement(icon, { size: 18 })}
 </div>
 <div className="space-y-1 w-full">
 <p className="text-[7px] md:text-[8px] font-black text-[var(--text-muted)] capitalize tracking-widest truncate">{label}</p>
 <div className="text-[9px] md:text-[11px] font-black text-[var(--text-primary)] truncate capitalize tracking-tight">
 {value ||"---"}
 </div>
 </div>
 </div>
));

const MentorDashboard = ({ mentor, mentorsGroup, user_info, staffBranches, navigate }) => {
 return (
 <div className="max-w-6xl mx-auto w-full space-y-10 md:space-y-14 pb-12">
 {/* INFORMATION GRID */}
 <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

 {/* LEFT COLUMN: IDENTIFICATION & GROUPS */}
 <div className="lg:col-span-8 space-y-10">
 <div className="space-y-6">
 <div className="flex items-center gap-3">
 <div className="w-1 h-6 bg-[var(--gold)] rounded-full" />
 <h3 className="text-sm font-black text-[var(--text-primary)] capitalize tracking-widest">Asosiy ma'lumotlar</h3>
 </div>

 <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
 <ProfileItem
 icon={<Mail />}
 label="Username"
 value={`@${mentor.username}`}
 color="text-blue-400"
 />
 <ProfileItem
 icon={<Phone />}
 label="Aloqa"
 value={mentor.phone_number}
 color="text-emerald-400"
 />
 <ProfileItem
 icon={<ShieldCheck />}
 label="Roli"
 value={mentor.role?.replace('_','')?.toUpperCase() ||"MENTOR"}
 color="text-amber-400"
 />
 <ProfileItem
 icon={<Zap />}
 label="Mutaxassislik"
 value={mentor.subject ||"Mentor"}
 color="text-purple-400"
 />
 </div>
 </div>

 {/* ACADEMIC GROUPS */}
 {user_info?.role !=="mentor" && mentorsGroup.length > 0 && (
 <div className="space-y-6">
 <div className="flex items-center gap-3">
 <div className="w-1 h-6 bg-[var(--gold)] rounded-full" />
 <h3 className="text-sm font-black text-[var(--text-primary)] capitalize tracking-widest">Biriktirilgan guruhlar</h3>
 </div>
 <div className="w-full">
 <MentorsGroupCards mentorsGroups={mentorsGroup} navig={navigate} />
 </div>
 </div>
 )}
 </div>

 {/* RIGHT COLUMN: BRANCHES & ACCESS */}
 <div className="lg:col-span-4 space-y-10">
 <div className="space-y-6">
 <div className="flex items-center gap-3">
 <div className="w-1 h-6 bg-[var(--gold)] rounded-full" />
 <h3 className="text-sm font-black text-[var(--text-primary)] capitalize tracking-widest">Asosiy Filial</h3>
 </div>
 <div className="lux-card !p-5 flex flex-col gap-4 border-[var(--gold)]/20 bg-[var(--gold-dim)]/5 shadow-[0_10px_30px_-10px_rgba(184,134,11,0.1)]">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-2xl bg-[var(--gold)] text-black flex items-center justify-center shadow-lg">
 <Building2 size={24} />
 </div>
 <div>
 <h4 className="text-sm font-black text-[var(--text-primary)] capitalize tracking-tight">{mentor.branch?.name ||"Asosiy filial"}</h4>
 <p className="text-[9px] text-[var(--text-muted)] font-bold capitalize tracking-widest mt-1">
 {mentor.branch?.address ||"Manzil ko'rsatilmadi"}
 </p>
 </div>
 </div>
 </div>
 </div>

 {/* ACCESSIBLE BRANCHES */}
 {((mentor.accessible_branches && mentor.accessible_branches.length > 0) || staffBranches.length > 0) && (
 <div className="space-y-6">
 <div className="flex items-center gap-3">
 <div className="w-1 h-6 bg-[var(--gold)] rounded-full" />
 <h3 className="text-sm font-black text-[var(--text-primary)] capitalize tracking-widest">Ruxsat etilganlar</h3>
 </div>
 <div className="grid gap-3">
 {(mentor.accessible_branches || []).map((item) => (
 <div key={item.id} className="lux-card !p-4 flex items-center justify-between group !rounded-2xl border-[var(--gold)]/5 bg-[var(--gold-dim)]/2 hover:bg-[var(--gold-dim)]/5 transition-all">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-xl bg-[var(--bg-void)] text-[var(--gold)] flex items-center justify-center border border-[var(--gold)]/20">
 <Activity size={16} />
 </div>
 <h4 className="text-[10px] font-black text-[var(--text-primary)] capitalize tracking-widest">{item.branch_name}</h4>
 </div>
 <ChevronRight size={14} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
 </div>
 ))}
 {(!mentor.accessible_branches || mentor.accessible_branches.length === 0) && staffBranches.map((item) => (
 <div key={item.id} className="lux-card !p-4 flex items-center justify-between group !rounded-2xl border-[var(--gold)]/5 bg-[var(--gold-dim)]/2 hover:bg-[var(--gold-dim)]/5 transition-all">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-xl bg-[var(--bg-void)] text-[var(--gold)] flex items-center justify-center border border-[var(--gold)]/20">
 <Activity size={16} />
 </div>
 <h4 className="text-[10px] font-black text-[var(--text-primary)] capitalize tracking-widest">{item.branch?.name}</h4>
 </div>
 <ChevronRight size={14} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 );
};

export default MentorDashboard;
