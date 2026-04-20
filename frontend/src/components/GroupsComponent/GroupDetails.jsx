import {
  useEffect, useRef, useReducer, useMemo, useState,
  useCallback
} from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../tokenUpdater/updater";
import toast from "react-hot-toast";
import { get_user_info } from "../Authorized/getRole";
import GroupsStudent from "./GrupsStudent";
import GoBackButton from "../sendback";
import HomeworkModal from "../homework/AddHomeworkModal";
import AddMockTestModal from "../mockTests/AddMockTestModal";
import AddMentorModal from "./assextramentor";
import SendMessageModal from "../Common/SendMessageModal";
import HomeworkStorageModal from "../homework/HomeworkStorageModal";
import {
  Edit3, Trash2, Check, X, Users, Calendar, Clock,
  BookOpen, UserCheck, Sparkles, MoreVertical, UserPlus,
  UserRoundPlus, UserMinus, RotateCw, Lock, DollarSign, AlignLeft, Send,
  ChevronRight, Layers, Target, Activity, Archive, Search, MessageSquare, Heart, ShieldCheck as BotIcon, DownloadCloud
} from "lucide-react";
import { useCurrentBranch } from "../Authorized/useBranchId";

const initialUIState = {
  error: "",
  isHomeworkModalOpen: false,
  isMockTestModalOpen: false,
  isAddMentorModalOpen: false,
  isMessageModalOpen: false,
  isStorageOpen: false,
  isEditing: false,
  editData: {},
  showMenu: false,
  isViewAllModalOpen: false,
  activeAddMentor: null,
  selectedDate: new Date().toISOString().split('T')[0],
  availableDates: [],
  markedStudents: JSON.parse(localStorage.getItem('marked_students') || '{}'),
};

function uiReducer(state, action) {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "START_EDITING":
      return { ...state, isEditing: true, editData: action.payload, showMenu: false };
    case "UPDATE_EDIT_DATA":
      return { ...state, editData: { ...state.editData, ...action.payload } };
    case "TOGGLE_MARK":
      const newMarked = { ...state.markedStudents };
      if (newMarked[action.payload]) {
        delete newMarked[action.payload];
      } else {
        newMarked[action.payload] = true;
      }
      localStorage.setItem('marked_students', JSON.stringify(newMarked));
      return { ...state, markedStudents: newMarked };
    default:
      return state;
  }
}

export default function GroupDetailPage() {
  const user_info = get_user_info();
  const { group_id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const branchID = useCurrentBranch();
  const menuRef = useRef(null);
  const addMentorRef = useRef(null);

  const todayStr = new Date().toLocaleDateString('sv-SE');
  const [localAttendanceByDate, setLocalAttendanceByDate] = useState({});

  const [uiState, uiDispatch] = useReducer(uiReducer, {
    ...initialUIState,
    selectedDate: todayStr
  });

  const {
    error, isHomeworkModalOpen, isMockTestModalOpen, isAddMentorModalOpen, isViewAllModalOpen, isStorageOpen, isEditing,
    editData, showMenu, activeAddMentor, selectedDate, availableDates, studentSearch
  } = uiState;

  const { data: userData = {} } = useQuery({
    queryKey: ['user-me'],
    queryFn: () => api.get('/user/me/').then(res => res.data),
    staleTime: Infinity,
  });

  const perms = userData.permissions || {};
  const isSuperAdmin = user_info?.role === "super_admin" || userData?.role === "super_admin";
  const isMentor = user_info?.role === "mentor" || userData?.role === "mentor";
  const isAdmin = user_info?.role === "admin" || userData?.role === "admin";

  const { data: groupinfo = {}, isError: isGroupError } = useQuery({
    queryKey: ['group-detail', group_id],
    queryFn: () => api.get(`/groups/groups/${group_id}/?exclude_students=true`).then(res => res.data),
    staleTime: 1000 * 60 * 10,
    enabled: !!group_id,
  });

  const { data: groupStudents = [] } = useQuery({
    queryKey: ['group-students', group_id],
    queryFn: () => api.get(`/groups/groups/${group_id}/students/`).then(res => res.data),
    staleTime: 1000 * 60 * 10,
    enabled: !!group_id,
  });

  const { data: botStats } = useQuery({
    queryKey: ['bot-stats-group', group_id],
    queryFn: () => api.get(`/bot/statistics/?group_id=${group_id}`).then(res => res.data),
    enabled: !!group_id && !!groupinfo.id,
    staleTime: 1000 * 60 * 10,
  });

  const isGroupMentor = useMemo(() => {
    if (isSuperAdmin) return true;
    if (!groupinfo.id) return false;
    const currentUserId = userData.id || user_info?.user_id;
    const isPrimary = Number(groupinfo.mentor?.id) === Number(currentUserId);
    const isAdditional = (groupinfo.additional_mentors || []).some(m => Number(m.mentor) === Number(currentUserId));
    return isPrimary || isAdditional;
  }, [isSuperAdmin, groupinfo, userData, user_info]);

  const canAddStudent = isSuperAdmin || isAdmin || perms.students === true;
  const canEditGroup = (isSuperAdmin || isAdmin || perms.groups === true) && !isMentor;
  const canDeleteGroup = (isSuperAdmin || isAdmin || perms.groups === true) && !isMentor;
  const canAddMentor = (isSuperAdmin || isAdmin || perms.groups === true) && !isMentor;
  const canSendMessage = isAdmin || isSuperAdmin || isMentor;
  const canTakeAttendance = isAdmin || isSuperAdmin || isGroupMentor;
  const canSeeHomework = isAdmin || isSuperAdmin || isGroupMentor;

  // User talabi: Sana kelmaguncha faollashmasligi kerak
  const isGroupLogicActive = groupinfo.computed_status === 'active';
  const canEditAttendanceToday = canTakeAttendance && selectedDate === todayStr && isGroupLogicActive;

  const { data: mentors = [] } = useQuery({
    queryKey: ['mentors-list-simple'],
    queryFn: () => api.get(`/groups/mentors/`).then(res => res.data),
    staleTime: 1000 * 60 * 10,
    enabled: true,
  });

  const { data: homework = [] } = useQuery({
    queryKey: ['homeworks', group_id],
    queryFn: () => api.get(`/homework_attends/homeworks/?group_id=${group_id}`).then(res => res.data),
    enabled: !!group_id && !!userData.id && canSeeHomework,
    staleTime: 1000 * 60 * 10,
  });

  const { data: mockTests = [] } = useQuery({
    queryKey: ['mock-tests', group_id],
    queryFn: () => api.get(`/homework_attends/mock-tests/?group_id=${group_id}`).then(res => res.data),
    enabled: !!group_id && !!userData.id && canSeeHomework,
    staleTime: 1000 * 60 * 10,
  });

  const { data: attendanceData = [], refetch: refetchAttends } = useQuery({
    queryKey: ['attendance', group_id, selectedDate],
    queryFn: () => api.get(`/homework_attends/attendances/?group_id=${group_id}&date=${selectedDate}`).then(res => res.data),
    enabled: !!group_id && !!selectedDate && !!userData.id,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toLocaleDateString('sv-SE'));
    }
    uiDispatch({ type: "SET_FIELD", field: "availableDates", value: dates });

    // Agar mentor bo'lsa va bugun tanlanmagan bo'lsa, bugunni tanlab qo'yamiz (ixtiyoriy, lekin qulay)
    const today = new Date().toLocaleDateString('sv-SE');
    if (isMentor && selectedDate !== today) {
      // uiDispatch({ type: "SET_FIELD", field: "selectedDate", value: today });
    }
  }, [isMentor]);

  const handleUpdate = async () => {
    try {
      const mentor_id = editData.mentor_id || editData.mentor?.id;
      const branch_id = groupinfo.branch?.id || groupinfo.branch_id;

      const payload = {
        name: editData.name,
        days: editData.days,
        dars_kunlari: editData.dars_kunlari,
        dars_vaqti: editData.dars_vaqti,
        subject: editData.subject || groupinfo.subject_name || "",
        mentor_id: mentor_id ? Number(mentor_id) : null,
        color: editData.color,
        start_date: editData.start_date,
        monthly_price: editData.monthly_price,
        description: editData.description,
        branch_id: branch_id ? Number(branch_id) : null,
      };

      await api.put(`/groups/groups/${group_id}/`, payload);
      queryClient.invalidateQueries(['group-detail', group_id]);
      uiDispatch({ type: "SET_FIELD", field: "isEditing", value: false });
      toast.success("Muvaffaqiyatli saqlandi.");
    } catch (err) {
      toast.error("Xatolik yuz berdi.");
    }
  };

  const handleRemoveMentor = async (mentorId) => {
    try {
      if (!confirm("Ushbu yordamchi mentorni guruhdan olib tashlamoqchimisiz?")) return;
      await api.post(`/groups/groups/${group_id}/remove-additional-mentor/`, { mentor_id: mentorId });
      queryClient.invalidateQueries(['group-detail', group_id]);
      toast.success("Yordamchi mentor olib tashlandi.");
    } catch (err) {
      toast.error("Olib tashlashda xato yuz berdi.");
    }
  };

  const handleLocalAttendanceChange = useCallback((studentId, is_present) => {
    setLocalAttendanceByDate((prev) => ({
      ...prev,
      [selectedDate]: {
        ...(prev[selectedDate] || {}),
        [studentId]: is_present,
      },
    }));
  }, [selectedDate]);

  const mergedAttendanceForDate = useMemo(() => {
    return localAttendanceByDate[selectedDate] || {};
  }, [localAttendanceByDate, selectedDate]);

  const isAttendanceConfirmed = useMemo(() => {
    return attendanceData.some(a => a.marked_by !== null);
  }, [attendanceData]);

  const handleConfirmAttendance = async () => {
    const students = groupStudents || [];
    const attendances = students.map((s) => {
      const is_present = mergedAttendanceForDate[s.id] !== undefined
        ? mergedAttendanceForDate[s.id]
        : (attendanceData.find((a) => Number(a.student_id) === Number(s.id))?.is_present ?? true);
      return { student_id: s.id, is_present };
    });
    try {
      await api.post("/homework_attends/attendances/confirm/", {
        group_id: Number(group_id),
        date: selectedDate,
        attendances,
      });
      toast.success("Davomat muvaffaqiyatli saqlandi.");
      setLocalAttendanceByDate((prev) => {
        const next = { ...prev };
        delete next[selectedDate];
        return next;
      });
      refetchAttends();
    } catch (err) {
      toast.error("Guruh ma'lumotlarini yuklashda xatolik!");
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/groups/groups/${group_id}/`);
      toast.success("Guruh muvaffaqiyatli arxivlandi.");
      navigate(-1);
    } catch (err) {
      toast.error("Guruhni o'chirishda xatolik yuz berdi.");
    }
  };

  const handleDownloadMonthlyReport = async () => {
    try {
      toast.loading("Hisobot tayyorlanmoqda...", { id: 'downloading' });
      const response = await api.get(`homework_attends/attendances/monthly-report/?group_id=${group_id}&export=excel`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `davomat_${groupinfo.name}_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Oylik hisobot yuklab olindi", { id: 'downloading' });
    } catch (err) {
      toast.error("Hisobotni yuklashda xatolik yuz berdi", { id: 'downloading' });
    }
  };

  const filteredStudents = useMemo(() => {
    const students = groupStudents || [];
    const searchLower = (studentSearch || "").trim().toLowerCase();

    const sortedStudents = [...students].sort((a, b) => {
      const nameA = a.full_name || "";
      const nameB = b.full_name || "";
      return nameA.localeCompare(nameB);
    });

    if (!searchLower) return sortedStudents;

    return sortedStudents.filter(s => {
      const fullName = (s.full_name || "").toLowerCase();
      const phone = s.phone || "";
      return fullName.includes(searchLower) || phone.includes(studentSearch);
    });
  }, [groupStudents, studentSearch]);

  const primaryColor = groupinfo.color || '#b8860b';

  return (
    <div className="w-full p-3 sm:p-6 space-y-6 animate-lux-fade pb-20">
      {/* Atmosphere Background Removed */}

      {/* HEADER SECTION */}
      <div className="flex flex-row items-center justify-between gap-4 pb-6 border-b border-[var(--border-glass)]">
        <div className="flex items-center gap-4">
          <GoBackButton />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-[var(--text-primary)] tracking-tight uppercase line-clamp-1">
                {isEditing ? (editData.name || "Yangi Guruh") : groupinfo.name}
              </h1>

            </div>
            <p className="text-[8px] text-[var(--text-muted)] font-black uppercase tracking-[0.3em] mt-0.5 flex items-center gap-2">
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
          {!isEditing ? (
            <>
              {canAddStudent && (
                <button
                  onClick={() => navigate(`add_student/?branch=${branchID.currentBranchId}`)}
                  className="flex items-center gap-2 h-10 px-3 sm:px-6 bg-[var(--gold)] text-black rounded-xl font-bold text-[10px] uppercase tracking-wider transition-opacity hover:opacity-90 active:scale-95 disabled:opacity-50"
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
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => uiDispatch({ type: "SET_FIELD", field: "showMenu", value: !showMenu })}
                    className="p-3.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--text-secondary)] hover:text-[var(--gold)] transition-all shadow-lg outline-none flex items-center justify-center focus:ring-1 focus:ring-[var(--gold)]/20"
                  >
                    < MoreVertical size={18} />
                  </button>
                  {showMenu && (
                    <div className="absolute right-0 top-full mt-2 w-56 lux-card !bg-[var(--bg-panel)]/95 !shadow-2xl !p-2 z-[100] border border-[var(--border-glass)] animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                      {canEditGroup && (
                        <button onClick={() => uiDispatch({ type: "START_EDITING", payload: { ...groupinfo, mentor_id: groupinfo.mentor?.id } })} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--gold-dim)] text-[var(--text-primary)] text-[10px] font-black uppercase tracking-widest rounded-xl transition-all">
                          <Edit3 size={14} className="text-[var(--gold)]" /> Guruhni tahrirlash
                        </button>
                      )}
                      {canAddMentor && (
                        <button onClick={() => { uiDispatch({ type: "SET_FIELD", field: "isAddMentorModalOpen", value: true }); uiDispatch({ type: "SET_FIELD", field: "showMenu", value: false }); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--gold-dim)] text-[var(--text-primary)] text-[10px] font-black uppercase tracking-widest rounded-xl transition-all">
                          <UserRoundPlus size={14} className="text-[var(--gold)]" /> Yordamchi biriktirish
                        </button>
                      )}
                      {canSeeHomework && (
                        <>
                          <button
                            disabled={!isGroupLogicActive}
                            onClick={() => { uiDispatch({ type: "SET_FIELD", field: "isHomeworkModalOpen", value: true }); uiDispatch({ type: "SET_FIELD", field: "showMenu", value: false }); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${!isGroupLogicActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <Activity size={14} /> Vazifa qo'shish
                          </button>
                          <button
                            disabled={!isGroupLogicActive}
                            onClick={() => { uiDispatch({ type: "SET_FIELD", field: "isMockTestModalOpen", value: true }); uiDispatch({ type: "SET_FIELD", field: "showMenu", value: false }); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-rose-500/10 text-rose-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${!isGroupLogicActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <Target size={14} /> Mock qo'shish
                          </button>
                        </>
                      )}
                      <div className="h-[1px] bg-[var(--border-glass)] my-1 mx-2"></div>
                      {canDeleteGroup && (
                        <button onClick={() => { if (confirm("Guruhni arxivlamoqchimisiz?")) handleDelete(); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all">
                          <Trash2 size={14} /> Guruhni arxivlash
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>

      {isEditing ? (
        <div className="w-full space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col items-center gap-2 mb-4">
            <span className="text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.5em]">Tahrirlash rejimi</span>
            <h3 className="text-base sm:text-lg font-black text-[var(--text-primary)] uppercase tracking-widest">Guruh parametrlarini sozlash</h3>
            <div className="w-16 h-0.5 bg-[var(--gold)]/40 rounded-full mt-2" />
          </div>

          <div className="lux-card !p-5 sm:!p-10 border-[var(--gold)]/10 shadow-[0_30px_60px_-15px_rgba(184,134,11,0.08)]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-10">

              {/* General Info Group */}
              <div className="space-y-6">
                <h4 className="text-[11px] font-black text-[var(--gold)] uppercase tracking-[0.3em] pb-3 border-b border-[var(--border-glass)] flex items-center gap-2">
                  <AlignLeft size={14} /> Umumiy ma'lumotlar
                </h4>
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Guruh nomi</label>
                    <input
                      className="lux-input !bg-[var(--bg-void)]/50 !py-4 !px-5 w-full"
                      value={editData.name || ""}
                      onChange={(e) => uiDispatch({ type: "UPDATE_EDIT_DATA", payload: { name: e.target.value } })}
                      placeholder="Masalan: IELTS Group #1"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Fan / Kurs nomi</label>
                    <input
                      className="lux-input !bg-[var(--bg-void)]/50 !py-4 !px-5 w-full"
                      value={editData.subject || ""}
                      onChange={(e) => uiDispatch({ type: "UPDATE_EDIT_DATA", payload: { subject: e.target.value } })}
                      placeholder="Masalan: General English"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-5">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Oylik to'lov (UZS)</label>
                      <div className="relative">
                        <input
                          type="number"
                          className="lux-input !bg-[var(--bg-void)]/50 !py-4 !pl-12 !pr-5 w-full"
                          value={editData.monthly_price || ""}
                          onChange={(e) => uiDispatch({ type: "UPDATE_EDIT_DATA", payload: { monthly_price: e.target.value } })}
                          placeholder="0.00"
                        />
                        <DollarSign size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--gold)]" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Guruh rangi (HEX)</label>
                      <div className="flex gap-3">
                        <input
                          className="lux-input !bg-[var(--bg-void)]/50 !py-4 !px-5 flex-1"
                          value={editData.color || ""}
                          onChange={(e) => uiDispatch({ type: "UPDATE_EDIT_DATA", payload: { color: e.target.value } })}
                          placeholder="#b8860b"
                        />
                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl border border-[var(--border-glass)] shrink-0 shadow-lg" style={{ background: editData.color || '#b8860b' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Logistics & Schedule */}
              <div className="space-y-6">
                <h4 className="text-[11px] font-black text-[var(--gold)] uppercase tracking-[0.3em] pb-3 border-b border-[var(--border-glass)] flex items-center gap-2">
                  <Calendar size={14} /> Logistika va Jadval
                </h4>
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Mas'ul O'qituvchi</label>
                    <div className="relative">
                      <select
                        className="lux-input !bg-[var(--bg-void)]/50 !py-4 !pl-12 !pr-8 w-full appearance-none"
                        value={editData.mentor_id || ""}
                        onChange={(e) => uiDispatch({ type: "UPDATE_EDIT_DATA", payload: { mentor_id: e.target.value } })}
                      >
                        <option value="">O'qituvchini tanlang</option>
                        {Array.isArray(mentors) && mentors.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.full_name || `${m.first_name || ""} ${m.last_name || ""}`.trim() || m.username || `ID: ${m.id}`}
                          </option>
                        ))}
                      </select>
                      <UserCheck size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                      <ChevronRight size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] rotate-90" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-5">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Kunlar turi</label>
                      <div className="relative">
                        <select
                          className="lux-input !bg-[var(--bg-void)]/50 !py-4 !px-5 w-full appearance-none"
                          value={editData.days || ""}
                          onChange={(e) => uiDispatch({ type: "UPDATE_EDIT_DATA", payload: { days: e.target.value } })}
                        >
                          <option value="even">Juft kunlar</option>
                          <option value="odd">Toq kunlar</option>
                          <option value="everyday">Har kuni</option>
                        </select>
                        <ChevronRight size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] rotate-90 pointer-events-none" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Boshlanish sanasi</label>
                      <input
                        type="date"
                        className="lux-input !bg-[var(--bg-void)]/50 !py-4 !px-5 w-full"
                        value={editData.start_date || ""}
                        onChange={(e) => uiDispatch({ type: "UPDATE_EDIT_DATA", payload: { start_date: e.target.value } })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-5">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Dars kunlari (matn)</label>
                      <input
                        className="lux-input !bg-[var(--bg-void)]/50 !py-4 !px-5 w-full"
                        value={editData.dars_kunlari || ""}
                        onChange={(e) => uiDispatch({ type: "UPDATE_EDIT_DATA", payload: { dars_kunlari: e.target.value } })}
                        placeholder="Du-Chor-Jum"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Dars vaqti (matn)</label>
                      <input
                        className="lux-input !bg-[var(--bg-void)]/50 !py-4 !px-5 w-full"
                        value={editData.dars_vaqti || ""}
                        onChange={(e) => uiDispatch({ type: "UPDATE_EDIT_DATA", payload: { dars_vaqti: e.target.value } })}
                        placeholder="14:00 - 16:00"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-10 space-y-2">
              <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Guruh tavsifi (Description)</label>
              <textarea
                className="lux-input !bg-[var(--bg-void)]/50 !py-4 !px-6 w-full min-h-[120px] resize-none"
                value={editData.description || ""}
                onChange={(e) => uiDispatch({ type: "UPDATE_EDIT_DATA", payload: { description: e.target.value } })}
                placeholder="Guruh haqida batafsil ma'lumot..."
              />
            </div>

            <div className="mt-12 pt-8 border-t border-[var(--border-glass)] flex items-center justify-end gap-4">
              <button
                onClick={() => uiDispatch({ type: "SET_FIELD", field: "isEditing", value: false })}
                className="px-8 py-3.5 rounded-xl border border-[var(--border-glass)] text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all text-[var(--text-secondary)]"
              >
                Bekor qilish
              </button>
              <button
                onClick={handleUpdate}
                className="px-12 py-3.5 bg-[var(--gold)] text-black rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-opacity hover:opacity-90 active:scale-95"
              >
                Saqlash
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-10">

          {/* LEFT COLUMN: INTEL & ASSIGNMENTS */}
          <div className="xl:col-span-2 space-y-4">

            {/* PRIMARY MENTOR */}
            <div className="lux-card-static group">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center bg-[var(--bg-void)] border border-[var(--border-glass)] text-[var(--gold)]"
                  style={{ color: primaryColor }}
                >
                  <UserCheck size={16} />
                </div>
                <div>
                  <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase tracking-widest leading-none">Mentor</p>
                </div>
              </div>

              <p className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-tight transition-colors">
                {groupinfo?.mentor?.first_name} {groupinfo?.mentor?.last_name || ""}
              </p>

              {groupinfo.additional_mentors?.length > 0 && (
                <div className="space-y-4 pt-6 mt-6 border-t border-[var(--border-glass)]">
                  <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em]">Yordamchi o'qituvchilar</p>
                  <div className="flex flex-wrap gap-3">
                    {groupinfo.additional_mentors.map((am) => (
                      <div key={am.id} className="relative group/delegate">
                        <div className="px-3 py-1.5 rounded-xl bg-[var(--bg-void)]/80 border border-[var(--border-glass)] text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest flex items-center gap-2 hover:border-[var(--gold)]/30 transition-all cursor-default">
                          <div className="w-1 h-1 rounded-full bg-[var(--gold)]/50" />
                          {am.mentor_name}
                        </div>

                        {/* Hover Popup */}
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-xl py-1.5 px-2 shadow-2xl opacity-0 invisible group-hover/delegate:opacity-100 group-hover/delegate:visible group-hover/delegate:-top-14 transition-all duration-300 z-50 flex items-center gap-2 min-w-[100px] whitespace-nowrap">
                          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[var(--bg-panel)] border-b border-r border-[var(--border-glass)] rotate-45" />
                          <span className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-tighter px-1">Olib tashlash?</span>
                          <button
                            onClick={() => handleRemoveMentor(am.mentor)}
                            className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-lg"
                            title="Olib tashlash"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* SCHEDULE PROTOCOL */}
            <div className="lux-card-static !p-4 border-[var(--border-glass)]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--gold)]">
                  <Target size={16} />
                </div>
                <p className="text-[8px] font-black text-[var(--text-primary)] uppercase tracking-widest">Jadval</p>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase tracking-widest opacity-50">Vaqt</p>
                  <p className="text-xs font-bold text-[var(--text-primary)]">{groupinfo.dars_vaqti || "---"}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase tracking-widest opacity-50">Kunlar</p>
                  <p className="text-xs font-bold">
                    {groupinfo.days === 'even' ? (
                      <span className="text-[var(--gold)]">Juft</span>
                    ) : groupinfo.days === 'everyday' ? (
                      <span className="text-emerald-500">Har kuni</span>
                    ) : (
                      <span className="text-blue-400">Toq</span>
                    )}
                  </p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase tracking-widest opacity-50">Narx</p>
                  <p className="text-xs font-bold text-[var(--gold)]">
                    {Number(groupinfo.monthly_price || 0).toLocaleString()} UZS
                  </p>
                </div>
              </div>
            </div>

            {/* BOT STATISTICS */}
            <div className="lux-card-static !p-4 border-[var(--gold)]/20 shadow-[0_0_20px_rgba(184,134,11,0.05)]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[var(--gold-dim)] border border-[var(--gold)]/20 flex items-center justify-center text-[var(--gold)]">
                  <MessageSquare size={14} />
                </div>
                <p className="text-[8px] font-black text-[var(--text-primary)] uppercase tracking-widest">Bot Stats</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-lg bg-[var(--bg-void)]/40 border border-[var(--border-glass)]">
                  <p className="text-[6px] font-bold text-[var(--text-muted)] uppercase mb-1">O'quvchi</p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{botStats?.students_bot_count || 0}</p>
                </div>
                <div className="p-2 rounded-lg bg-[var(--bg-void)]/40 border border-[var(--border-glass)]">
                  <p className="text-[6px] font-bold text-[var(--text-muted)] uppercase mb-1">Ota-ona</p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{botStats?.parents_bot_count || 0}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {canSeeHomework && (
                <>
                  <button
                    disabled={!isGroupLogicActive}
                    onClick={() => uiDispatch({ type: "SET_FIELD", field: "isHomeworkModalOpen", value: true })}
                    className={`flex flex-col sm:flex-row items-center justify-center gap-2 p-2.5 rounded-xl border transition-all ${isGroupLogicActive ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-400 hover:bg-indigo-600 hover:text-white' : 'opacity-50 cursor-not-allowed'}`}
                  >
                    <Activity size={16} />
                    <span className="text-[8px] font-black uppercase tracking-widest text-center">Vazifa</span>
                  </button>
                  <button
                    disabled={!isGroupLogicActive}
                    onClick={() => uiDispatch({ type: "SET_FIELD", field: "isMockTestModalOpen", value: true })}
                    className={`flex flex-col sm:flex-row items-center justify-center gap-2 p-2.5 rounded-xl border transition-all ${isGroupLogicActive ? 'bg-rose-600/20 border-rose-500/30 text-rose-400 hover:bg-rose-600 hover:text-white' : 'opacity-50 cursor-not-allowed'}`}
                  >
                    <Target size={16} />
                    <span className="text-[8px] font-black uppercase tracking-widest text-center">Mock</span>
                  </button>
                </>
              )}
              <button
                onClick={() => uiDispatch({ type: "SET_FIELD", field: "isViewAllModalOpen", value: true })}
                className="flex flex-col sm:flex-row items-center justify-center gap-2 p-2.5 rounded-xl border border-[var(--gold)]/30 bg-[var(--gold)]/10 text-[var(--gold)] hover:bg-[var(--gold)] hover:text-black transition-all"
              >
                <BookOpen size={16} />
                <span className="text-[8px] font-black uppercase tracking-widest text-center">Tarix</span>
              </button>
              <button
                onClick={() => uiDispatch({ type: "SET_FIELD", field: "isStorageOpen", value: true })}
                className="flex flex-col sm:flex-row items-center justify-center gap-2 p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all"
              >
                <Archive size={16} />
                <span className="text-[8px] font-black uppercase tracking-widest text-center">Arxiv</span>
              </button>
              {(isAdmin || isSuperAdmin || isMentor) && (
                <button
                  onClick={handleDownloadMonthlyReport}
                  className="flex flex-col sm:flex-row items-center justify-center gap-2 p-2.5 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-400 hover:bg-sky-500 hover:text-white transition-all"
                  title="Oylik hisobotni ko'rish / yuklab olish"
                >
                  <DownloadCloud size={16} />
                  <span className="text-[8px] font-black uppercase tracking-widest text-center">Oylik</span>
                </button>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: MEMBERSHIP & ANALYTICS */}
          <div className="xl:col-span-10 space-y-6">

            {/* MEMBERSHIP DIRECTORY (Davomat) - Moved below history */}
            <div className="lux-card-static !p-0 overflow-hidden pb-10 shadow-xl border-[var(--border-glass)]">
              <div className="p-4 sm:p-8 flex items-center justify-between gap-4 border-b border-[var(--border-glass)]">
                <div className="flex items-center gap-3 sm:gap-5">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--gold)] shadow-inner">
                    <Users size={18} className="sm:size-[22px]" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-xl font-bold text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
                      Davomat
                      {isAttendanceConfirmed && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[8px] font-black tracking-widest flex items-center gap-1 mt-0.5 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                          <Check size={10} strokeWidth={3} /> TAYYOR
                        </span>
                      )}
                    </h3>
                    <p className="text-[8px] sm:text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.3em] font-sans mt-0.5">
                      Sana: <span className="text-[var(--gold)]">{selectedDate}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {canEditAttendanceToday && (
                    <button
                      onClick={handleConfirmAttendance}
                      className="flex items-center justify-center w-10 sm:w-auto sm:px-6 h-10 bg-[var(--gold)] text-black rounded-xl font-bold text-[10px] uppercase tracking-wider transition-opacity hover:opacity-90 active:scale-95"
                      title="Tayyor"
                    >
                      <Check size={18} /> <span className="hidden sm:inline ml-2">Tayyor</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      queryClient.refetchQueries(['group-detail', group_id]);
                      queryClient.refetchQueries(['group-students', group_id]);
                      refetchAttends();
                      queryClient.refetchQueries(['homeworks', group_id]);
                      queryClient.refetchQueries(['mock-tests', group_id]);
                      toast.success("Ma'lumotlar yangilandi");
                    }}
                    className="p-2 sm:p-3.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--text-secondary)] hover:text-[var(--gold)] hover:border-[var(--gold)]/30 transition-all shadow-md"
                    title="Yangilash"
                  >
                    <RotateCw size={18} />
                  </button>
                </div>
              </div>

              {/* SEARCH PROTOCOL - Compact below header */}
              <div className="px-4 sm:px-8 py-3 border-b border-[var(--border-glass)]/10 bg-[var(--bg-void)]/20 shadow-inner">
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--gold)] transition-colors">
                    <Search size={14} />
                  </div>
                  <input
                    type="text"
                    placeholder="O'quvchi qidirish..."
                    className="lux-input !py-2.5 !pl-10 !pr-4 !bg-[var(--bg-void)]/30 !border-[var(--border-glass)] !text-[10px] w-full"
                    value={studentSearch}
                    onChange={(e) => uiDispatch({ type: "SET_FIELD", field: "studentSearch", value: e.target.value })}
                  />
                </div>
              </div>

              {!isGroupLogicActive && !isEditing && (
                <div className="mx-8 mb-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-500">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500">
                    <Lock size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Guruh kutilmoqda</p>
                    <p className="text-[9px] text-amber-500/70 font-bold uppercase tracking-wider mt-0.5">
                      Guruh boshlanish sanasi ({groupinfo.start_date || '---'}) yetib kelmaguncha davomat va boshqa logikalar cheklangan.
                    </p>
                  </div>
                </div>
              )}

              {/* DATE PROTOCOLS */}
              <div className="px-8 py-5 border-b border-[var(--border-glass)] flex gap-3 overflow-x-auto scrollbar-hide">
                {availableDates.map((date) => (
                  <button
                    key={date}
                    onClick={() => uiDispatch({ type: "SET_FIELD", field: "selectedDate", value: date })}
                    className={`flex flex-col items-center justify-center px-6 py-3 rounded-xl transition-all border whitespace-nowrap min-w-[100px]
                      ${selectedDate === date
                        ? "bg-[var(--gold)] text-black border-transparent shadow-[var(--gold-glow)] scale-105"
                        : "bg-[var(--bg-void)]/40 text-[var(--text-secondary)] border-[var(--border-glass)] hover:border-[var(--gold)]/20"}`}
                  >
                    <span className="text-[8px] font-black uppercase tracking-[0.2em] mb-1 opacity-60">Sana {date.split('-')[2]}</span>
                    <span className="text-xs font-bold tracking-tight">{new Date(date).toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()}</span>
                  </button>
                ))}
              </div>

              {/* DIRECTORY LIST - RESPONSIVE (Cards on mobile, Table on desktop) */}
              <div className="md:hidden p-4 space-y-4">
                <GroupsStudent
                  students={filteredStudents}
                  canEdit={canEditAttendanceToday}
                  attendanceData={attendanceData}
                  onAttendanceChange={refetchAttends}
                  onLocalAttendanceChange={canEditAttendanceToday ? handleLocalAttendanceChange : undefined}
                  localOverrides={mergedAttendanceForDate}
                  groupId={group_id}
                  selectedDate={selectedDate}
                  mode="card"
                  currentBranchId={branchID.currentBranchId}
                  markedStudents={uiState.markedStudents}
                  onToggleMark={(id) => uiDispatch({ type: "TOGGLE_MARK", payload: id })}
                />
              </div>

              <div className="hidden md:block overflow-x-auto text-[var(--text-primary)]">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[var(--border-glass)] text-[var(--text-muted)] text-[9px] font-black uppercase tracking-[0.4em]">
                      <th className="px-8 py-6 w-16 text-center">#</th>
                      <th className="px-8 py-6">O'quvchi</th>
                      <th className="px-8 py-6 text-center">To'lov holati</th>
                      <th className="px-8 py-6 text-center">Imtiyoz</th>
                      <th className="px-8 py-6">Telefon</th>
                      <th className="px-8 py-6 text-center">Davomat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-glass)]">
                    <GroupsStudent
                      students={filteredStudents}
                      canEdit={canEditAttendanceToday}
                      attendanceData={attendanceData}
                      onAttendanceChange={refetchAttends}
                      onLocalAttendanceChange={canEditAttendanceToday ? handleLocalAttendanceChange : undefined}
                      localOverrides={mergedAttendanceForDate}
                      groupId={group_id}
                      selectedDate={selectedDate}
                      mode="table"
                      currentBranchId={branchID.currentBranchId}
                      markedStudents={uiState.markedStudents}
                      onToggleMark={(id) => uiDispatch({ type: "TOGGLE_MARK", payload: id })}
                    />
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )
      }

      {/* MODALS */}
      {
        uiState.isMessageModalOpen && !isEditing && (
          <SendMessageModal
            isOpen={uiState.isMessageModalOpen}
            onClose={() => uiDispatch({ type: "SET_FIELD", field: "isMessageModalOpen", value: false })}
            groupId={group_id}
          />
        )
      }
      {isHomeworkModalOpen && <HomeworkModal isOpen={isHomeworkModalOpen} onClose={() => uiDispatch({ type: "SET_FIELD", field: "isHomeworkModalOpen", value: false })} groupId={group_id} />}
      {isMockTestModalOpen && <AddMockTestModal isOpen={isMockTestModalOpen} onClose={() => uiDispatch({ type: "SET_FIELD", field: "isMockTestModalOpen", value: false })} groupId={group_id} />}
      {isAddMentorModalOpen && <AddMentorModal isOpen={isAddMentorModalOpen} onClose={() => uiDispatch({ type: "SET_FIELD", field: "isAddMentorModalOpen", value: false })} groupId={group_id} currentMentors={groupinfo.additional_mentors || []} />}
      {isStorageOpen && <HomeworkStorageModal isOpen={isStorageOpen} onClose={() => uiDispatch({ type: "SET_FIELD", field: "isStorageOpen", value: false })} groupId={group_id} />}

      {/* VIEW ALL HOMEWORKS & MOCK TESTS MODAL */}
      {isViewAllModalOpen && createPortal(
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => uiDispatch({ type: "SET_FIELD", field: "isViewAllModalOpen", value: false })}
          />
          <div className="relative bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-[24px] md:rounded-[32px] shadow-[0_40px_100px_-15px_rgba(0,0,0,0.3)] w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
            {/* Modal Header */}
            <div className="px-6 md:px-10 py-6 md:py-8 border-b border-[var(--border-glass)] flex justify-between items-center bg-[var(--bg-panel)] shrink-0">
              <div className="flex items-center gap-4 md:gap-5">
                <div className="p-3 md:p-4 bg-[var(--gold)] rounded-2xl text-black shadow-lg shadow-[var(--gold-glow)]">
                  <Layers size={20} className="md:size-[24px]" strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg md:text-2xl font-black text-[var(--text-primary)] tracking-tight leading-none uppercase truncate">Guruh Resurslari</h3>
                  <p className="text-[9px] md:text-[10px] font-black text-[var(--gold)] mt-2 uppercase tracking-[0.2em] md:tracking-[0.3em]">Barcha vazifalar va imtihonlar</p>
                </div>
              </div>
              <button
                onClick={() => uiDispatch({ type: "SET_FIELD", field: "isViewAllModalOpen", value: false })}
                className="p-2 md:p-3 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5 rounded-full transition-all active:scale-90"
              >
                <X size={24} className="md:size-[28px]" />
              </button>
            </div>

            {/* Modal Content - Scrollable Area */}
            <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
                {/* Homeworks List */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-[var(--border-glass)] sticky top-0 bg-[var(--bg-panel)] z-10">
                    <Activity size={18} className="text-[var(--gold)]" />
                    <h4 className="text-[12px] font-black text-[var(--text-primary)] uppercase tracking-[0.2em]">Uy Vazifalari</h4>
                    <span className="ml-auto px-2 py-0.5 rounded-md bg-[var(--text-primary)]/5 text-[10px] font-black text-[var(--text-muted)]">{homework.length}</span>
                  </div>
                  <div className="space-y-3">
                    {homework.length === 0 ? (
                      <div className="py-12 flex flex-col items-center justify-center gap-3 opacity-40">
                        <Activity size={32} />
                        <p className="text-[10px] font-black uppercase tracking-widest">Hozircha vazifalar yo'q</p>
                      </div>
                    ) : (
                      [...homework].reverse().map((hw) => (
                        <div
                          key={hw.id}
                          onClick={() => {
                            uiDispatch({ type: "SET_FIELD", field: "isViewAllModalOpen", value: false });
                            navigate(`homeworks/${hw.id}?branch=${branchID.currentBranchId}`);
                          }}
                          className="lux-card !p-4 sm:!p-6 group cursor-pointer hover:border-[var(--gold)]/30 transition-all relative bg-[var(--bg-void)]/30"
                        >
                          <div className="min-w-0 pr-4">
                            <p className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--gold)] transition-colors truncate">{hw.title}</p>
                            <p className="text-[8px] font-medium text-[var(--text-muted)] uppercase mt-1 tracking-wider">ID: #{hw.id} • {new Date(hw.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-tighter">{new Date(hw.created_at).toLocaleDateString()}</p>
                            <ChevronRight size={14} className="text-[var(--gold)] translate-x-1 opacity-0 group-hover:opacity-100 transition-all" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Mock Tests List */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-[var(--border-glass)] sticky top-0 bg-[var(--bg-panel)] z-10">
                    <Target size={18} className="text-[var(--gold)]" />
                    <h4 className="text-[12px] font-black text-[var(--text-primary)] uppercase tracking-[0.2em]">Mock Testlar</h4>
                    <span className="ml-auto px-2 py-0.5 rounded-md bg-[var(--text-primary)]/5 text-[10px] font-black text-[var(--text-muted)]">{mockTests.length}</span>
                  </div>
                  <div className="space-y-3">
                    {mockTests.length === 0 ? (
                      <div className="py-12 flex flex-col items-center justify-center gap-3 opacity-40">
                        <Target size={32} />
                        <p className="text-[10px] font-black uppercase tracking-widest">Hozircha testlar yo'q</p>
                      </div>
                    ) : (
                      [...mockTests].reverse().map((test) => (
                        <div
                          key={test.id}
                          onClick={() => {
                            uiDispatch({ type: "SET_FIELD", field: "isViewAllModalOpen", value: false });
                            navigate(`mock-tests/${test.id}?branch=${branchID.currentBranchId}`);
                          }}
                          className="lux-card !p-5 flex items-center justify-between group cursor-pointer hover:border-[var(--gold)]/40 hover:bg-[var(--gold)]/5 transition-all bg-[var(--bg-void)]/30"
                        >
                          <div className="min-w-0 pr-4">
                            <p className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--gold)] transition-colors truncate">{test.subject}</p>
                            <p className="text-[8px] font-medium text-[var(--text-muted)] uppercase mt-1 tracking-wider">ID: #{test.id} • {new Date(test.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-tighter">{new Date(test.created_at).toLocaleDateString()}</p>
                            <ChevronRight size={14} className="text-[var(--gold)] translate-x-1 opacity-0 group-hover:opacity-100 transition-all" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 md:px-10 py-6 border-t border-[var(--border-glass)] bg-[var(--bg-panel)] flex justify-end shrink-0">
              <button
                onClick={() => uiDispatch({ type: "SET_FIELD", field: "isViewAllModalOpen", value: false })}
                className="w-full md:w-auto px-10 py-3 rounded-xl border border-[var(--border-glass)] text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5 transition-all"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div >
  );
}
