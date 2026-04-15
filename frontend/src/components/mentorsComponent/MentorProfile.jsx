import { useEffect, useReducer } from "react";
import React from "react";
import toast from "react-hot-toast";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { get_user_info } from "../Authorized/getRole";
import { useNavigate, useParams, useOutletContext } from "react-router-dom";
import api from "../../tokenUpdater/updater";
import GoBackButton from "../sendback";
import StaffTransferModal from "../SuperAdmin/StaffTransferModal";
import MentorsGroupCards from "./MentorsGroupCards";
import ThemeToggle from "../ThemeToggle";
import {
  User, Phone, ShieldCheck,
  LogOut as LogOutIcon, Edit3, Trash2,
  Check, X, Mail, Key,
  Loader2, ArrowRightLeft,
  Building2, Layers, CreditCard, ChevronRight,
  Target, Zap, Activity, Eye, EyeOff, Shield, Save
} from "lucide-react";
import { useCurrentBranch } from "../Authorized/useBranchId";

const initialState = {
  mentor: {},
  mentorsGroup: [],
  isEditing: false,
  editData: {},
  selectedBranch: { name: "", id: null },
  showPassword: false,
  isPermModalOpen: false,
  isTransferModalOpen: false,
  permissions: {},
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "TOGGLE_TRANSFER_MODAL":
      return { ...state, isTransferModalOpen: action.payload };
    case "SET_MENTOR_DATA":
      return {
        ...state,
        mentor: action.payload,
        editData: action.payload,
        mentorsGroup: action.payload.mentor_groups || [],
      };
    case "UPDATE_EDIT_DATA":
      return { ...state, editData: { ...state.editData, ...action.payload } };
    case "START_EDITING":
      return { ...state, isEditing: true, editData: { ...state.mentor } };
    case "TOGGLE_SHOW_PASSWORD":
      return { ...state, showPassword: !state.showPassword };
    case 'TOGGLE_PERM_MODAL':
      return { ...state, isPermModalOpen: action.payload };
    case 'SET_PERMISSIONS':
      return { ...state, permissions: action.payload };
    case 'TOGGLE_PERMISSION_KEY':
      return {
        ...state,
        permissions: { ...state.permissions, [action.key]: !state.permissions[action.key] }
      };
    default:
      return state;
  }
}

const PERMISSION_LABELS = {
  "students": "O'quvchi qo'shish va boshqarish",
  "pay_slip": "Moliya daftarini ko'rish",
};

export default function MentorProfilePage({ viewMode = "all" }) {
  const user_info = get_user_info();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { mentor_id } = useParams();
  const { currentBranchId } = useCurrentBranch();
  const { branchId } = useOutletContext() || {};

  const { data: userData = {} } = useQuery({
    queryKey: ['user-me'],
    queryFn: () => api.get('/user/me/').then(res => res.data),
    staleTime: Infinity,
  });

  const [state, dispatch] = useReducer(reducer, initialState);
  const { mentor, mentorsGroup, isEditing, editData, selectedBranch } = state;

  const realMentorId = user_info?.role === "mentor" ? user_info?.user_id : mentor_id;
  const effectiveBranchId = selectedBranch?.id || currentBranchId || branchId;

  const { data: mentorData, isLoading: isMentorLoading } = useQuery({
    queryKey: ['mentor-details', realMentorId, effectiveBranchId],
    queryFn: async () => {
      if (!realMentorId || !effectiveBranchId) return null;
      const res = await api.get(`/groups/nested_mentors/${realMentorId}/?branch_id=${effectiveBranchId}`);
      return res.data;
    },
    enabled: !!realMentorId && !!effectiveBranchId,
  });

  useEffect(() => {
    if (mentorData) {
      dispatch({ type: "SET_MENTOR_DATA", payload: mentorData });
    }
  }, [mentorData]);

  const { data: staffPermissions } = useQuery({
    queryKey: ['staffPermissions', realMentorId],
    queryFn: async () => {
      if (!realMentorId || user_info.role !== "super_admin") return null;
      try {
        const res = await api.get(`/permissions/staff/${realMentorId}/`);
        return res.data;
      } catch (err) {
        return null;
      }
    },
    enabled: !!realMentorId && user_info.role === "super_admin"
  });

  useEffect(() => {
    const source = staffPermissions?.permissions || staffPermissions || mentorData?.permissions;
    if (source) {
      const backendPerms = {};
      Object.keys(PERMISSION_LABELS).forEach(key => {
        if (typeof source === 'object' && source !== null) {
          backendPerms[key] = !!source[key];
        } else {
          backendPerms[key] = false;
        }
      });
      dispatch({ type: 'SET_PERMISSIONS', payload: backendPerms });
    }
  }, [mentorData, staffPermissions]);

  const handleUpdate = async () => {
    try {
      const payload = {
        first_name: editData.first_name,
        last_name: editData.last_name,
        phone_number: editData.phone_number,
        subject: editData.subject,
        username: editData.username,
        is_active: editData.is_active,
        color: editData.color,
        branch_id: mentor.branch_id ? Number(mentor.branch_id) : Number(currentBranchId),
      };

      if (editData.password) {
        payload.password = editData.password;
      }

      const res = await api.put(`/register/users/${realMentorId}/`, payload);
      dispatch({ type: "SET_FIELD", field: "mentor", value: res.data });
      dispatch({ type: "SET_FIELD", field: "isEditing", value: false });
      queryClient.invalidateQueries(['user-me']);
      toast.success("Profil yangilandi!");
    } catch (err) {
      toast.error("Xatolik yuz berdi!");
    }
  };

  const permMutation = useMutation({
    mutationFn: async (perms) => {
      return await api.put(`/permissions/staff/${realMentorId}/`, perms);
    },
    onSuccess: () => {
      dispatch({ type: 'TOGGLE_PERM_MODAL', payload: false });
      toast.success("Huquqlar yangilandi.");
      queryClient.invalidateQueries(['staffPermissions', realMentorId]);
    }
  });

  const handleDelete = async () => {
    const reason = window.prompt("O'chirish uchun sababni kiriting:");
    if (reason !== null) {
      try {
        await api.delete(`/register/users/${realMentorId}/?reason=${encodeURIComponent(reason || "Sabab ko'rsatilmadi")}`);
        toast.success("Muvaffaqiyatli o'chirildi.");
        navigate(-1);
      } catch (err) {
        toast.error("Xatolik yuz berdi");
      }
    }
  };

  function LogOut() {
    if (confirm("Tizimdan chiqmoqchimisiz?")) {
      localStorage.clear();
      navigate("/");
    }
  }

  const { data: staffBranches = [] } = useQuery({
    queryKey: ['staff-branches', realMentorId],
    queryFn: async () => {
      if (!realMentorId || user_info?.role !== 'super_admin') return [];
      try {
        const res = await api.get(`/register/branch-access/?user_id=${realMentorId}`);
        return res.data || [];
      } catch (err) {
        return [];
      }
    },
    enabled: !!realMentorId && user_info?.role === 'super_admin',
  });

  const userRole = (userData.role || user_info?.role || "").toLowerCase();
  const perms = userData.permissions || {};
  const isSuperAdmin = userRole === "super_admin";
  const isAdmin = userRole === "admin";
  const canEditMentor = (isSuperAdmin || isAdmin || perms.teachers === true) && userRole !== "mentor";

  if (isMentorLoading || !mentor.id) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 size={32} className="text-[var(--gold)] animate-spin" />
      </div>
    );
  }

  const mentorColor = mentor.color || '#b8860b';

  return (
    <div className="p-3 sm:p-6 space-y-4 md:space-y-6 overflow-hidden">

      {/* TOP BAR: Back tugmasi + ThemeToggle + Logout */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {user_info.role !== "mentor" && <GoBackButton />}
        </div>
        {(userRole !== "super_admin" && userRole !== "admin") && (
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={LogOut}
              className="p-2.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] hover:border-red-500/50 text-red-500 hover:text-red-400 transition-all group"
              title="Tizimdan chiqish"
            >
              <LogOutIcon size={18} className="group-hover:-translate-x-0.5 transition-transform" />
            </button>
          </div>
        )}
      </div>

      {/* HEADER SECTION */}
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
              <h1 className="text-base sm:text-xl font-black text-[var(--text-primary)] tracking-tight uppercase leading-tight truncate">
                {isEditing
                  ? `${editData.first_name || ""} ${editData.last_name || ""}`
                  : `${mentor.first_name} ${mentor.last_name}`}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="px-2 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-widest bg-[var(--gold-dim)] shadow-inner shrink-0 max-w-[120px] truncate"
                style={{ color: mentorColor, borderColor: `${mentorColor}40` }}
              >
                {isEditing ? (editData.subject || "Mentor") : (mentor.subject || "Mentor")}
              </div>
              <p className="text-[8px] text-[var(--text-muted)] font-black uppercase tracking-widest flex items-center gap-1 shrink-0">
                Status: <span className="text-emerald-500">Faol</span>
                <span className="opacity-40">•</span>
                ID: {mentor.id?.toString().padStart(4, '0')}
              </p>
            </div>
          </div>
        </div>

        {/* ACTION BUTTONS - yonma-yon, ixcham */}
        {canEditMentor && !isEditing && (
          <div className="mt-4 flex flex-row gap-2">
            <button
              onClick={() => dispatch({ type: "TOGGLE_TRANSFER_MODAL", payload: true })}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-[var(--bg-panel)] border border-amber-500/30 text-amber-500 font-bold text-[10px] uppercase tracking-wide hover:bg-amber-500/10 active:scale-[0.97] transition-all"
              title="Boshqa filialga o'tkazish"
            >
              <ArrowRightLeft size={14} />
              <span className="truncate">Transfer</span>
            </button>
            <button
              onClick={() => dispatch({ type: "START_EDITING" })}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-[var(--bg-panel)] border border-blue-500/30 text-blue-400 font-bold text-[10px] uppercase tracking-wide hover:bg-blue-500/10 active:scale-[0.97] transition-all"
            >
              <Edit3 size={14} />
              <span>Tahrirlash</span>
            </button>
            {isSuperAdmin && (
              <button
                onClick={() => dispatch({ type: 'TOGGLE_PERM_MODAL', payload: true })}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-[var(--bg-panel)] border border-[var(--gold)]/30 text-[var(--gold)] font-bold text-[10px] uppercase tracking-wide hover:bg-[var(--gold)]/10 active:scale-[0.97] transition-all"
              >
                <Shield size={14} />
                <span>Ruxsatlar</span>
              </button>
            )}
            <button
              onClick={handleDelete}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-[var(--bg-panel)] border border-red-500/30 text-red-400 font-bold text-[10px] uppercase tracking-wide hover:bg-red-500/10 active:scale-[0.97] transition-all"
            >
              <Trash2 size={14} />
              <span>O'chirish</span>
            </button>
          </div>
        )}

        {/* Editing save/cancel - yonma-yon */}
        {isEditing && (
          <div className="mt-4 flex flex-row gap-2">
            <button
              onClick={handleUpdate}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 font-bold text-[10px] uppercase tracking-wide hover:bg-emerald-500/20 active:scale-[0.97] transition-all"
            >
              <Check size={14} />
              <span>Saqlash</span>
            </button>
            <button
              onClick={() => dispatch({ type: "SET_FIELD", field: "isEditing", value: false })}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--text-secondary)] font-bold text-[10px] uppercase tracking-wide hover:bg-white/5 active:scale-[0.97] transition-all"
            >
              <X size={14} />
              <span>Bekor qilish</span>
            </button>
          </div>
        )}
      </div>

      {/* --- DASHBOARD LOGIC: VIEWMODE TOGGLE --- */}
      {viewMode === "groups" ? (
        <div className="space-y-10">
          <div className="flex items-center justify-between px-2">
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] uppercase tracking-tight italic">Guruhlar</h2>
              <p className="text-[10px] text-[var(--gold)] font-black uppercase tracking-[0.3em] mt-1">Ishchi maydoni taqsimoti</p>
            </div>
            <div className="flex items-center gap-6 px-6 py-3 bg-[var(--gold-dim)] rounded-2xl border border-[var(--gold)]/10 shadow-inner">
              <div className="text-center">
                <p className="text-sm font-black text-[var(--text-primary)]">{mentorsGroup.length}</p>
                <p className="text-[7px] font-black text-[var(--gold)] uppercase tracking-widest">Faol guruhlar</p>
              </div>
              <div className="w-px h-6 bg-[var(--gold)]/20"></div>
              <div className="text-center">
                <p className="text-sm font-black text-[var(--text-primary)]">
                  {mentorsGroup.reduce((acc, g) => acc + (g.students_count || 0), 0)}
                </p>
                <p className="text-[7px] font-black text-[var(--gold)] uppercase tracking-widest">O'quvchilar</p>
              </div>
            </div>
          </div>

          <MentorsGroupCards mentorsGroups={mentorsGroup} navig={navigate} />
        </div>
      ) : (
        <div className="max-w-6xl mx-auto w-full space-y-10 md:space-y-14 pb-12">

          {/* MAIN CONTENT SECTION */}
          {isEditing ? (
            <div className="space-y-10 pb-10">
              <div className="flex flex-col items-center gap-2 mb-8">
                <span className="text-[10px] sm:text-[11px] font-black text-[var(--gold)] uppercase tracking-[0.5em]">Tahrirlash rejimi</span>
                <h3 className="text-base sm:text-lg font-black text-[var(--text-primary)] uppercase tracking-widest italic">Profil ma'lumotlarini o'zgartirish</h3>
                <div className="w-16 h-0.5 bg-[var(--gold)]/40 rounded-full mt-2" />
              </div>

              <div className="lux-card !p-6 sm:!p-10 border-[var(--gold)]/20 shadow-[0_20px_60px_-15px_rgba(184,134,11,0.1)]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                  {/* Personal Info Group */}
                  <div className="space-y-6">
                    <h4 className="text-[11px] font-black text-[var(--gold)] uppercase tracking-[0.3em] pb-3 border-b border-[var(--border-glass)] flex items-center gap-2">
                      <User size={14} /> Shaxsiy ma'lumotlar
                    </h4>
                    <div className="grid grid-cols-1 gap-5">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Ism</label>
                        <input
                          className="lux-input !bg-[var(--bg-void)]/50 !py-3.5 !px-5 w-full"
                          value={editData.first_name || ""}
                          onChange={(e) => dispatch({ type: "UPDATE_EDIT_DATA", payload: { first_name: e.target.value } })}
                          placeholder="Ismni kiriting"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Familiya</label>
                        <input
                          className="lux-input !bg-[var(--bg-void)]/50 !py-3.5 !px-5 w-full"
                          value={editData.last_name || ""}
                          onChange={(e) => dispatch({ type: "UPDATE_EDIT_DATA", payload: { last_name: e.target.value } })}
                          placeholder="Familiyani kiriting"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Fan / Mutaxassislik</label>
                      <input
                        className="lux-input !bg-[var(--bg-void)]/50 !py-3.5 !px-5 w-full"
                        value={editData.subject || ""}
                        onChange={(e) => dispatch({ type: "UPDATE_EDIT_DATA", payload: { subject: e.target.value } })}
                        placeholder="Masalan: Matematika"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Rang kodi (HEX)</label>
                      <div className="flex gap-3">
                        <input
                          className="lux-input !bg-[var(--bg-void)]/50 !py-3.5 !px-5 flex-1"
                          value={editData.color || ""}
                          onChange={(e) => dispatch({ type: "UPDATE_EDIT_DATA", payload: { color: e.target.value } })}
                          placeholder="#000000"
                        />
                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl border border-[var(--border-glass)] shrink-0" style={{ background: editData.color || '#000' }} />
                      </div>
                    </div>
                  </div>

                  {/* Account Info Group */}
                  <div className="space-y-6">
                    <h4 className="text-[11px] font-black text-[var(--gold)] uppercase tracking-[0.3em] pb-3 border-b border-[var(--border-glass)] flex items-center gap-2">
                      <ShieldCheck size={14} /> Hisob va Aloqa
                    </h4>
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Username</label>
                        <input
                          className="lux-input !bg-[var(--bg-void)]/50 !py-3.5 !px-5 w-full"
                          value={editData.username || ""}
                          onChange={(e) => dispatch({ type: "UPDATE_EDIT_DATA", payload: { username: e.target.value } })}
                          placeholder="Username"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Telefon</label>
                        <div className="relative">
                          <input
                            className="lux-input !bg-[var(--bg-void)]/50 !py-3.5 !pl-12 !pr-5 w-full"
                            value={editData.phone_number || ""}
                            onChange={(e) => dispatch({ type: "UPDATE_EDIT_DATA", payload: { phone_number: e.target.value } })}
                            placeholder="Telefon raqami"
                          />
                          <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Yangi Parol (ixtiyoriy)</label>
                        <div className="relative">
                          <input
                            type={state.showPassword ? "text" : "password"}
                            className="lux-input !bg-[var(--bg-void)]/50 !py-3.5 !pl-5 !pr-12 w-full"
                            value={editData.password || ""}
                            onChange={(e) => dispatch({ type: "UPDATE_EDIT_DATA", payload: { password: e.target.value } })}
                            placeholder="••••••••"
                          />
                          <button
                            type="button"
                            onClick={() => dispatch({ type: 'TOGGLE_SHOW_PASSWORD' })}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--gold)] transition-colors"
                          >
                            {state.showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-12 pt-8 border-t border-[var(--border-glass)] flex flex-wrap items-end justify-between gap-6">
                  <div className="flex flex-wrap items-center gap-6">
                    <div className="flex flex-col">
                      <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1 mb-2">Mentor holati</label>
                      <select
                        className="lux-input !py-2.5 !px-5 !w-44 !text-xs !bg-[var(--bg-void)]/50"
                        value={editData.is_active === false ? "false" : "true"}
                        onChange={(e) => dispatch({ type: "UPDATE_EDIT_DATA", payload: { is_active: e.target.value === "true" } })}
                      >
                        <option value="true">Faol</option>
                        <option value="false">Faol emas</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => dispatch({ type: "SET_FIELD", field: "isEditing", value: false })}
                      className="px-8 py-3 rounded-xl border border-[var(--border-glass)] text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all text-[var(--text-secondary)]"
                    >
                      Bekor qilish
                    </button>
                    <button
                      onClick={handleUpdate}
                      className="lux-btn-primary px-10 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-[0_10px_30px_rgba(184,134,11,0.3)] hover:scale-105 active:scale-95 transition-all"
                    >
                      Saqlash
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* INFORMATION GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                {/* LEFT COLUMN: IDENTIFICATION & GROUPS */}
                <div className="lg:col-span-8 space-y-10">
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-6 bg-[var(--gold)] rounded-full" />
                      <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest italic">Asosiy ma'lumotlar</h3>
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
                        value={mentor.role?.replace('_', ' ')?.toUpperCase() || "MENTOR"}
                        color="text-amber-400"
                      />
                      <ProfileItem
                        icon={<Zap />}
                        label="Mutaxassislik"
                        value={mentor.subject || "Mentor"}
                        color="text-purple-400"
                      />
                    </div>
                  </div>

                  {/* ACADEMIC GROUPS */}
                  {user_info?.role !== "mentor" && mentorsGroup.length > 0 && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="w-1 h-6 bg-[var(--gold)] rounded-full" />
                        <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest italic">Biriktirilgan guruhlar</h3>
                      </div>
                      <div className="w-full">
                        <MentorsGroupCards mentorsGroups={mentorsGroup} navig={navigate} />
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT COLUMN: BRANCHES & ACCESS */}
                <div className="lg:col-span-4 space-y-10">
                  {/* PRIMARY BRANCH */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-6 bg-[var(--gold)] rounded-full" />
                      <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest italic">Asosiy Filial</h3>
                    </div>
                    <div className="lux-card !p-5 flex flex-col gap-4 border-[var(--gold)]/20 bg-[var(--gold-dim)]/5 shadow-[0_10px_30px_-10px_rgba(184,134,11,0.1)]">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-[var(--gold)] text-black flex items-center justify-center shadow-lg">
                          <Building2 size={24} />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight italic">{mentor.branch?.name || "Asosiy filial"}</h4>
                          <p className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-widest mt-1">
                            {mentor.branch?.address || "Manzil ko'rsatilmadi"}
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
                        <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest italic">Ruxsat etilganlar</h3>
                      </div>
                      <div className="grid gap-3">
                        {(mentor.accessible_branches || []).map((item) => (
                          <div key={item.id} className="lux-card !p-4 flex items-center justify-between group !rounded-2xl border-[var(--gold)]/5 bg-[var(--gold-dim)]/2 hover:bg-[var(--gold-dim)]/5 transition-all">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-[var(--bg-void)] text-[var(--gold)] flex items-center justify-center border border-[var(--gold)]/20">
                                <Activity size={16} />
                              </div>
                              <h4 className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-widest">{item.branch_name}</h4>
                            </div>
                            <ChevronRight size={14} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        ))}
                        {/* Fallback to staffBranches if super_admin viewing and accessible_branches empty */}
                        {(!mentor.accessible_branches || mentor.accessible_branches.length === 0) && staffBranches.map((item) => (
                          <div key={item.id} className="lux-card !p-4 flex items-center justify-between group !rounded-2xl border-[var(--gold)]/5 bg-[var(--gold-dim)]/2 hover:bg-[var(--gold-dim)]/5 transition-all">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-[var(--bg-void)] text-[var(--gold)] flex items-center justify-center border border-[var(--gold)]/20">
                                <Activity size={16} />
                              </div>
                              <h4 className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-widest">{item.branch?.name}</h4>
                            </div>
                            <ChevronRight size={14} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

        </div>
      )}

      {state.isTransferModalOpen && (
        <StaffTransferModal
          isOpen={state.isTransferModalOpen}
          onClose={() => dispatch({ type: "TOGGLE_TRANSFER_MODAL", payload: false })}
          staffMember={mentor}
          onTransferSuccess={() => {
            queryClient.invalidateQueries(['mentor-details']);
            toast.success("Muvaffaqiyatli o'chirildi.");
          }}
        />
      )}

      {/* PERMISSIONS MODAL */}
      {state.isPermModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-3xl animate-in fade-in duration-300">
          <div className="w-full max-w-[340px] lux-card !bg-[var(--bg-panel)]/95 shadow-2xl !p-6 md:!p-8 border border-[var(--border-glass)]">
            <div className="flex justify-between items-center mb-6 md:mb-8 border-b border-[var(--border-glass)] pb-4">
              <h3 className="text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">USTOZ HUQUQLARI</h3>
              <button onClick={() => dispatch({ type: 'TOGGLE_PERM_MODAL', payload: false })} className="text-[var(--text-muted)] hover:text-white transition-all p-1 hover:bg-white/10 rounded-lg"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              {Object.keys(PERMISSION_LABELS).map((key) => (
                <div key={key} className="flex justify-between items-center p-3 rounded-xl bg-[var(--bg-void)]/40 border border-[var(--border-glass)] hover:bg-[var(--bg-void)]/80 transition-colors">
                  <span className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-widest">{PERMISSION_LABELS[key]}</span>
                  <button
                    onClick={() => dispatch({ type: 'TOGGLE_PERMISSION_KEY', key })}
                    className={`w-10 h-5 rounded-full relative flex items-center transition-all duration-300 ${state.permissions[key] ? 'bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'bg-white/10'}`}
                  >
                    <div className={`absolute w-3.5 h-3.5 bg-white rounded-full transition-all duration-300 ${state.permissions[key] ? 'left-5.5' : 'left-1'}`} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => permMutation.mutate(state.permissions)}
                disabled={permMutation.isPending}
                className="w-full mt-6 py-3 bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-black font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(184,134,11,0.3)] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {permMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} SAQLASH
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ProfileItem = React.memo(({ icon, label, value, color }) => (
  <div className="lux-card !p-3 md:!p-4 group hover:border-[var(--gold)]/30 transition-all !rounded-xl md:!rounded-2xl flex flex-col items-center text-center justify-center min-h-[90px]">
    <div className={`${color} opacity-60 group-hover:opacity-100 transition-all transform group-hover:scale-110 mb-2`}>
      {React.cloneElement(icon, { size: 18 })}
    </div>
    <div className="space-y-1 w-full">
      <p className="text-[7px] md:text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest truncate">{label}</p>
      <div className="text-[9px] md:text-[11px] font-black text-[var(--text-primary)] truncate uppercase tracking-tight">
        {value || "---"}
      </div>
    </div>
  </div>
));
