import { get_user_info } from "../Authorized/getRole";
import { useOutletContext } from "react-router-dom";
import {
  Users,
  Calendar,
  Clock,
  ChevronRight,
  Layers,
  Sparkles,
  ArrowUpRight,
  Activity,
  Target
} from "lucide-react";
import { useCurrentBranch } from "../Authorized/useBranchId";

export default function MentorsGroupCards({ mentorsGroups, navig }) {
  const user_info = get_user_info();
  const { branchId } = useOutletContext() || {};
  const realBRanch = useCurrentBranch();

  const getGroupPath = (groupId) => {
    if (user_info.role === "admin") {
      return `/admin/groups/${groupId}/?branch=${realBRanch.currentBranchId}`;
    }
    if (user_info.role === "super_admin") {
      return `/super_admin/branch/${branchId}/groups/${groupId}`;
    }
    if (user_info.role === "mentor") {
      return `groups/${groupId}?branch=${realBRanch.currentBranchId}`;
    }
    return null;
  };

  if (!mentorsGroups || mentorsGroups.length === 0) {
    return (
      <div className="lux-card !py-24 text-center">
        <div className="w-16 h-16 bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner text-[var(--gold)] opacity-20">
          <Layers size={24} />
        </div>
        <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.4em] italic mb-2">No Strategic Units Found</p>
        <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest opacity-40">Operational grid is currently vacant.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-nowrap md:grid md:grid-cols-2 overflow-x-auto md:overflow-visible gap-6 md:gap-8 relative z-10 w-full pb-6 md:pb-0 scroll-smooth lux-scrollbar">
      {mentorsGroups.map((card) => {
        const path = getGroupPath(card.id);
        const groupColor = card.color || "var(--gold)";

        return (
          <div
            key={card.id}
            onClick={() => path && navig(path)}
            className="lux-card group cursor-pointer hover:border-[var(--gold)]/40 transition-all flex flex-col justify-between !p-6 md:!p-8 !rounded-[32px] min-h-[280px] shrink-0 w-[85%] sm:w-[320px] md:w-auto"
          >
            {/* Header section */}
            <div className="flex justify-between items-start gap-4 mb-8">
              <div className="flex items-center gap-4 min-w-0">
                <div
                  className="w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center border border-[var(--border-glass)] shadow-inner group-hover:scale-105 transition-transform duration-500 shrink-0"
                  style={{ color: groupColor, backgroundColor: `${groupColor}10` }}
                >
                  <Target size={24} className="md:w-7 md:h-7" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-base md:text-xl font-black text-[var(--text-primary)] tracking-tight uppercase italic leading-tight group-hover:text-[var(--gold)] transition-colors truncate">
                    {card.name}
                  </h4>
                  <div className="flex flex-col gap-1 mt-2">
                    <div className="flex items-center gap-2">
                      {card.computed_status === 'active' && (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                          <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Faol</span>
                        </>
                      )}
                      {card.computed_status === 'waiting' && (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
                          <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Kutilmoqda</span>
                        </>
                      )}
                      {card.computed_status === 'activating_soon' && (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                          <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Yaqinda faol</span>
                        </>
                      )}
                      {card.computed_status === 'inactive' && (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500/50"></div>
                          <span className="text-[9px] font-black text-red-500/50 uppercase tracking-widest">Nofaol</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-10 h-10 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-muted)] group-hover:text-[var(--gold)] transition-all shrink-0">
                <ArrowUpRight size={18} />
              </div>
            </div>

            {/* Stats matrix */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-[var(--bg-panel)]/40 rounded-2xl border border-[var(--border-glass)] flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-1.5 text-[var(--text-muted)] opacity-60">
                  <Users size={12} />
                  <span className="text-[8px] font-black uppercase tracking-widest">Soni</span>
                </div>
                <p className="text-lg md:text-2xl font-black text-[var(--text-primary)] italic">
                  {card.students_count} <span className="text-[10px] md:text-xs not-italic opacity-30 tracking-widest uppercase ml-1">ta</span>
                </p>
              </div>

              <div className="p-4 bg-[var(--bg-panel)]/40 rounded-2xl border border-[var(--border-glass)] flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-1.5 text-[var(--text-muted)] opacity-60">
                  <Clock size={12} />
                  <span className="text-[8px] font-black uppercase tracking-widest">Vaqti</span>
                </div>
                <p className="text-xs md:text-base font-black text-[var(--text-primary)] italic truncate">{card.dars_vaqti || "---"}</p>
              </div>
            </div>

            {/* Protocol Meta */}
            <div className="p-4 bg-[var(--gold-dim)]/5 rounded-2xl border border-[var(--gold)]/10 flex items-center gap-4 relative overflow-hidden group-hover:bg-[var(--gold-dim)]/10 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--gold)] shrink-0">
                <Calendar size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">Dars Kunlari</span>
                <p className="text-[10px] md:text-xs font-black text-[var(--text-primary)] uppercase italic mt-1 tracking-tight truncate">
                  {card.days || card.dars_kunlari || "Belgilanmagan"}
                </p>
              </div>
              <Activity size={16} className="text-[var(--gold)] opacity-5 shrink-0" />
            </div>
          </div>
        );
      })}
    </div>
  );
}