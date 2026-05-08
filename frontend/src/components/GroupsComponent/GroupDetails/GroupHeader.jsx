import React from "react";
import { UserPlus, Send, MoreVertical, Edit3, UserRoundPlus, Activity, Target, Trash2, Check } from "lucide-react";
import GoBackButton from "../../sendback";

const GroupHeader = ({
  isEditing,
  editData,
  groupinfo,
  canAddStudent,
  canSendMessage,
  canEditGroup,
  canDeleteGroup,
  canAddMentor,
  canSeeHomework,
  showMenu,
  isGroupLogicActive,
  branchID,
  navigate,
  uiDispatch,
  handleDelete
}) => {
  return (
    <div className="flex flex-row items-center justify-between gap-4 pb-6 border-b border-[var(--border-glass)]">
      <div className="flex items-center gap-4">
        <GoBackButton />
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-black text-[var(--text-primary)] tracking-tight capitalize line-clamp-1">
              {isEditing ? (editData.name || "Yangi Guruh") : groupinfo.name}
            </h1>
            {!isEditing && (
              <span className={`px-2 py-0.5 rounded-full border text-[7px] font-black uppercase tracking-widest shrink-0 ${
                groupinfo.group_type === 'advanced' 
                ? 'bg-[var(--gold)]/10 border-[var(--gold)]/30 text-[var(--gold)] shadow-[0_0_10px_rgba(184,134,11,0.2)]' 
                : 'bg-white/5 border-white/10 text-white/40'
              }`}>
                {groupinfo.group_type === 'advanced' ? 'ADVANCED' : 'STANDART'}
              </span>
            )}
          </div>
          <p className="text-[8px] text-[var(--text-muted)] font-black capitalize tracking-[0.3em] mt-0.5 flex items-center gap-2">
            Protocol: <span className="text-[var(--gold)]">{isEditing ? "Tahrirlash" : "Operatsion markaz"}</span>
            {!isEditing && groupinfo.computed_status && (
              <span className={`px-2 py-0.5 rounded-md border text-[7px] ${groupinfo.computed_status === 'active' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' :
                groupinfo.computed_status === 'waiting' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' :
                  groupinfo.computed_status === 'activating_soon' ? 'bg-blue-500/10 border-blue-500/30 text-blue-500' :
                    'bg-red-500/10 border-red-500/30 text-red-500'
                }`}>
                {groupinfo.computed_status === 'active' ? 'FAOL' :
                  groupinfo.computed_status === 'waiting' ? 'KUTILMOQDA' :
                    groupinfo.computed_status === 'activating_soon' ? 'YAQINDA FAOL' : 'FAOL EMAS'}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {!isEditing && (
          <>
            {canAddStudent && (
              <button
                onClick={() => navigate(`add_student/?branch=${branchID}`)}
                className="flex items-center gap-2 h-10 px-3 sm:px-6 bg-[var(--gold)] text-black rounded-xl font-bold text-[10px] capitalize tracking-wider transition-opacity hover:opacity-90 active:scale-95 disabled:opacity-50"
                title="O'quvchi qo'shish"
              >
                <UserPlus size={16} />
                <span className="hidden sm:inline">O'quvchi qo'shish</span>
              </button>
            )}
            {canSendMessage && (
              <button
                onClick={() => uiDispatch({ type: "SET_FIELD", field: "isMessageModalOpen", value: true })}
                className="p-3.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--gold)] hover:border-[var(--gold)]/40 transition-all shadow-lg flex items-center justify-center"
                title="Xabar yuborish"
              >
                <Send size={18} />
              </button>
            )}
            {(canEditGroup || canDeleteGroup || canAddMentor) && (
              <div className="relative">
                <button
                  onClick={() => uiDispatch({ type: "SET_FIELD", field: "showMenu", value: !showMenu })}
                  className="p-3.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--text-secondary)] hover:text-[var(--gold)] transition-all shadow-lg outline-none flex items-center justify-center focus:ring-1 focus:ring-[var(--gold)]/20"
                >
                  <MoreVertical size={18} />
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-full mt-2 w-56 lux-card !bg-[var(--bg-panel)]/95 !shadow-2xl !p-2 z-[100] border border-[var(--border-glass)] animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                    {canEditGroup && (
                      <button onClick={() => uiDispatch({ type: "START_EDITING", payload: { ...groupinfo, mentor_id: groupinfo.mentor?.id } })} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--gold-dim)] text-[var(--text-primary)] text-[10px] font-black capitalize tracking-widest rounded-xl transition-all">
                        <Edit3 size={14} className="text-[var(--gold)]" /> Guruhni tahrirlash
                      </button>
                    )}
                    {canAddMentor && (
                      <button onClick={() => { uiDispatch({ type: "SET_FIELD", field: "isAddMentorModalOpen", value: true }); uiDispatch({ type: "SET_FIELD", field: "showMenu", value: false }); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--gold-dim)] text-[var(--text-primary)] text-[10px] font-black capitalize tracking-widest rounded-xl transition-all">
                        <UserRoundPlus size={14} className="text-[var(--gold)]" /> Yordamchi biriktirish
                      </button>
                    )}
                    {canSeeHomework && (
                      <>
                        <button
                          disabled={!isGroupLogicActive}
                          onClick={() => { uiDispatch({ type: "SET_FIELD", field: "isHomeworkModalOpen", value: true }); uiDispatch({ type: "SET_FIELD", field: "showMenu", value: false }); }}
                          className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-500/10 text-indigo-400 text-[10px] font-black capitalize tracking-widest rounded-xl transition-all ${!isGroupLogicActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <Activity size={14} /> Vazifa qo'shish
                        </button>
                        <button
                          disabled={!isGroupLogicActive}
                          onClick={() => { uiDispatch({ type: "SET_FIELD", field: "isMockTestModalOpen", value: true }); uiDispatch({ type: "SET_FIELD", field: "showMenu", value: false }); }}
                          className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-rose-500/10 text-rose-400 text-[10px] font-black capitalize tracking-widest rounded-xl transition-all ${!isGroupLogicActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <Target size={14} /> Mock qo'shish
                        </button>
                      </>
                    )}
                    <div className="h-[1px] bg-[var(--border-glass)] my-1 mx-2"></div>
                    {canDeleteGroup && (
                      <button onClick={() => { if (confirm("Guruhni arxivlamoqchimisiz?")) handleDelete(); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 text-red-500 text-[10px] font-black capitalize tracking-widest rounded-xl transition-all">
                        <Trash2 size={14} /> Guruhni arxivlash
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default GroupHeader;
