import React, { useReducer, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get_user_info } from "../Authorized/getRole";
import api from "../../tokenUpdater/updater";
import GoBackButton from "../sendback";
import {
  User, Phone, ShieldCheck, LogOut as LogOutIcon,
  Edit3, Trash2, Calendar, MapPin, Hash, Activity,
  X, Save, Loader2, ArrowRightLeft, Shield, Mail, Key,
  Building2, XCircle, ChevronRight, CreditCard, Eye, EyeOff
} from "lucide-react";
import StaffTransferModal from "../SuperAdmin/StaffTransferModal";
import toast from "react-hot-toast";

const initialState = {
  isPermModalOpen: false,
  isEditModalOpen: false, // This will now toggle the full-page edit mode
  isTransferModalOpen: false,
  editForm: { first_name: "", last_name: "", phone_number: "", username: "", password: "", is_active: true },
  permissions: {},
  showPassword: false,
};

function reducer(state, action) {
  switch (action.type) {
    case 'TOGGLE_PERM_MODAL':
      return { ...state, isPermModalOpen: action.payload };
    case 'TOGGLE_EDIT_MODAL':
      return { ...state, isEditModalOpen: action.payload };
    case 'TOGGLE_TRANSFER_MODAL':
      return { ...state, isTransferModalOpen: action.payload };
    case 'SET_EDIT_FORM':
      return { ...state, editForm: action.payload };
    case 'UPDATE_EDIT_FIELD':
      return { ...state, editForm: { ...state.editForm, ...action.payload } };
    case 'SET_PERMISSIONS':
      return { ...state, permissions: action.payload };
    case 'TOGGLE_PERMISSION_KEY':
      return {
        ...state,
        permissions: { ...state.permissions, [action.key]: !state.permissions[action.key] }
      };
    case 'TOGGLE_SHOW_PASSWORD':
      return { ...state, showPassword: !state.showPassword };
    default:
      return state;
  }
}

const PERMISSION_LABELS = {
  "finance": "Moliya",
  "groups": "Guruhlar",
  "students": "O'quvchilar",
  "teachers": "Mentorlar",
  "branches": "Filiallar",
  "reports": "Hisobotlar"
};

const AdminProfile = () => {
  const navigate = useNavigate();
  const { admin_id } = useParams();
  const queryClient = useQueryClient();
  const user_info = get_user_info();

  const [state, dispatch] = useReducer(reducer, initialState);

  const { data: admin, isLoading: loading, error } = useQuery({
    queryKey: ['admin', admin_id || 'me', user_info.role],
    queryFn: async () => {
      let res;
      if (!admin_id) {
        res = await api.get("/user/me/");
      } else {
        res = await api.get(`/groups/admins/${admin_id}/`);
      }
      return res?.data;
    }
  });

  const { data: staffPermissions } = useQuery({
    queryKey: ['staffPermissions', admin_id],
    queryFn: async () => {
      if (!admin_id || user_info.role !== "super_admin") return null;
      try {
        const res = await api.get(`/permissions/staff/${admin_id}/`);
        return res.data;
      } catch (err) {
        return null;
      }
    },
    enabled: !!admin_id && user_info.role === "super_admin"
  });

  useEffect(() => {
    const source = staffPermissions || admin?.permissions;
    if (source) {
      const backendPerms = {};
      Object.keys(PERMISSION_LABELS).forEach(key => {
        if (Array.isArray(source)) {
          const exists = source.some(p => {
            if (typeof p === 'string') return p === key;
            if (typeof p === 'object' && p !== null) return p.codename === key || p.name === key || p[key] === true;
            return false;
          });
          backendPerms[key] = exists;
        } else if (typeof source === 'object' && source !== null) {
          backendPerms[key] = !!source[key];
        } else {
          backendPerms[key] = false;
        }
      });
      dispatch({ type: 'SET_PERMISSIONS', payload: backendPerms });
    }
  }, [admin, staffPermissions]);

  const archiveMutation = useMutation({
    mutationFn: async (reason) => {
      return await api.delete(`/register/users/${admin?.id}/`, { params: { reason } });
    },
    onSuccess: () => {
      toast.success("Muvaffaqiyatli o'chirildi.");
      navigate(-1);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      return await api.patch(`/register/users/${admin?.id}/`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin']);
      dispatch({ type: 'TOGGLE_EDIT_MODAL', payload: false });
      toast.success("Profil yangilandi.");
    }
  });

  const permMutation = useMutation({
    mutationFn: async (perms) => {
      return await api.put(`/permissions/staff/${admin_id}/`, perms);
    },
    onSuccess: () => {
      dispatch({ type: 'TOGGLE_PERM_MODAL', payload: false });
      toast.success("Huquqlar yangilandi.");
    }
  });

  const { data: staffBranches = [], refetch: refetchBranches } = useQuery({
    queryKey: ['staff-branches', admin_id],
    queryFn: async () => {
      if (!admin_id || user_info.role !== 'super_admin') return [];
      const res = await api.get(`/register/branch-access/?user_id=${admin_id}`);
      return res.data || [];
    },
    enabled: !!admin_id && user_info.role === 'super_admin',
  });

  const removeBranchMutation = useMutation({
    mutationFn: async (branchAccessId) => {
      return await api.delete(`/register/branch-access/${branchAccessId}/`);
    },
    onSuccess: () => {
      toast.success("Filialga ruxsat olib tashlandi.");
      refetchBranches();
      queryClient.invalidateQueries(['admin']);
    }
  });

  const handleEditOpen = () => {
    if (admin) {
      dispatch({
        type: 'SET_EDIT_FORM',
        payload: {
          first_name: admin.first_name,
          last_name: admin.last_name,
          phone_number: admin.phone_number,
          username: admin.username,
          is_active: admin.is_active,
        }
      });
      dispatch({ type: 'TOGGLE_EDIT_MODAL', payload: true });
    }
  };

  const LogOut = () => {
    if (confirm("Tizimdan chiqmoqchimisiz?")) {
      localStorage.clear();
      navigate("/");
    }
  };

  useEffect(() => {
    if (error) {
      toast.error("Ruxsat rad etildi.");
      navigate(-1);
    }
  }, [error, navigate]);

  if (loading || !admin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 size={32} className="text-[var(--gold)] animate-spin" />
      </div>
    );
  }

  const adminColor = admin.color || '#b8860b';

  return (
    <div className="w-full min-h-screen relative pb-20 animate-lux-fade font-sans selection:bg-[var(--gold)]/20 text-[var(--text-primary)]">

      {/* Atmosphere & Background */}
      <div className="fixed inset-0 pointer-events-none -z-10 bg-[var(--bg-void)]">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[var(--gold)]/5 rounded-full blur-[100px] opacity-60" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] opacity-40" />
      </div>

      {/* Navigation & Header */}
      <div className="sticky top-0 z-40 bg-[var(--bg-void)]/80 backdrop-blur-xl border-b border-[var(--border-glass)] px-4 py-3 md:px-8 transition-all">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <GoBackButton />
            <span className="hidden md:block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em]">Xodim Profili</span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {!admin_id ? (
              <button onClick={LogOut} className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-red-500/10 active:scale-95">
                Chiqish <LogOutIcon size={14} className="inline ml-1" />
              </button>
            ) : user_info.role === "super_admin" ? (
              <>
                {!state.isEditModalOpen && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => dispatch({ type: 'TOGGLE_TRANSFER_MODAL', payload: true })} className="p-2.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--text-muted)] hover:text-amber-500 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all active:scale-95 group" title="Ko'chirish">
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
                {state.isEditModalOpen && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateMutation.mutate(state.editForm)} className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all active:scale-95 flex items-center gap-2" title="Saqlash">
                      <Save size={18} /> <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Saqlash</span>
                    </button>
                    <button onClick={() => dispatch({ type: 'TOGGLE_EDIT_MODAL', payload: false })} className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-95 flex items-center gap-2" title="Bekor qilish">
                      <X size={18} /> <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Bekor qilish</span>
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-8 pt-6 md:pt-10 space-y-6 md:space-y-8">

        {state.isEditModalOpen ? (
          <div className="space-y-10 animate-in fade-in zoom-in-95 duration-500 pb-10">
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
                        value={state.editForm.first_name || ""}
                        onChange={(e) => dispatch({ type: "UPDATE_EDIT_FIELD", payload: { first_name: e.target.value } })}
                        placeholder="Ismni kiriting"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Familiya</label>
                      <input
                        className="lux-input !bg-[var(--bg-void)]/50 !py-3.5 !px-5 w-full"
                        value={state.editForm.last_name || ""}
                        onChange={(e) => dispatch({ type: "UPDATE_EDIT_FIELD", payload: { last_name: e.target.value } })}
                        placeholder="Familiyani kiriting"
                      />
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
                        value={state.editForm.username || ""}
                        onChange={(e) => dispatch({ type: "UPDATE_EDIT_FIELD", payload: { username: e.target.value } })}
                        placeholder="Username"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Telefon</label>
                      <div className="relative">
                        <input
                          className="lux-input !bg-[var(--bg-void)]/50 !py-3.5 !pl-12 !pr-5 w-full"
                          value={state.editForm.phone_number || ""}
                          onChange={(e) => dispatch({ type: "UPDATE_EDIT_FIELD", payload: { phone_number: e.target.value } })}
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
                          value={state.editForm.password || ""}
                          onChange={(e) => dispatch({ type: "UPDATE_EDIT_FIELD", payload: { password: e.target.value } })}
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
                <div className="flex flex-col">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1 mb-2">Admin holati</label>
                  <select
                    className="lux-input !py-2.5 !px-5 !w-44 !text-xs !bg-[var(--bg-void)]/50"
                    value={state.editForm.is_active === false ? "false" : "true"}
                    onChange={(e) => dispatch({ type: "UPDATE_EDIT_FIELD", payload: { is_active: e.target.value === "true" } })}
                  >
                    <option value="true">Faol</option>
                    <option value="false">Faol emas</option>
                  </select>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={() => dispatch({ type: 'TOGGLE_EDIT_MODAL', payload: false })}
                    className="px-8 py-3 rounded-xl border border-[var(--border-glass)] text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all text-[var(--text-secondary)]"
                  >
                    Bekor qilish
                  </button>
                  <button
                    onClick={() => updateMutation.mutate(state.editForm)}
                    disabled={updateMutation.isPending}
                    className="lux-btn-primary px-10 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-[0_10px_30px_rgba(184,134,11,0.3)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                  >
                    {updateMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : "Saqlash"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Hero Section: Avatar & Identity */}
            <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10 p-6 md:p-8 rounded-3xl bg-[var(--bg-panel)] border border-[var(--border-glass)] shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--gold)]/0 via-[var(--gold)]/50 to-[var(--gold)]/0 opacity-50 group-hover:opacity-100 transition-opacity duration-700" />

              {/* Avatar Box */}
              <div className="relative shrink-0">
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-[var(--bg-void)] border border-[var(--border-glass)] p-1.5 shadow-[0_0_30px_rgba(184,134,11,0.1)] group-hover:shadow-[0_0_40px_rgba(184,134,11,0.2)] transition-shadow duration-500">
                  <div className="w-full h-full rounded-xl overflow-hidden bg-[var(--bg-panel)] flex items-center justify-center">
                    {admin.image ? (
                      <img src={admin.image} className="w-full h-full object-cover" alt="Avatar" />
                    ) : (
                      <div className="flex flex-col items-center">
                        <span className="text-2xl md:text-3xl font-black text-[var(--gold)]">{admin.first_name?.[0]}{admin.last_name?.[0]}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="absolute -bottom-2 -right-2 px-3 py-1 bg-[var(--gold)] text-black text-[8px] md:text-[9px] font-black uppercase tracking-widest rounded-lg shadow-lg border border-white/20 z-10">
                  {admin.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                </div>
              </div>

              {/* Info Text */}
              <div className="flex-1 text-center md:text-left space-y-3">
                <div>
                  <h1 className="text-2xl md:text-4xl font-black text-[var(--text-primary)] tracking-tighter uppercase leading-none mb-1">{admin.first_name} {admin.last_name}</h1>
                  <p className="text-[11px] font-bold text-[var(--gold)] uppercase tracking-[0.3em] opacity-80 pl-0.5">@{admin.username}</p>
                </div>

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-1">
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] font-black uppercase tracking-widest">
                    <Activity size={12} /> Faol Status
                  </span>
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-void)] text-[var(--text-muted)] border border-[var(--border-glass)] text-[9px] font-black uppercase tracking-widest">
                    <Hash size={12} /> ID: {admin.id}
                  </span>
                </div>
              </div>
            </div>

            {/* Permissions Compact Button (If Super Admin) */}
            {user_info.role === "super_admin" && (
              <button
                onClick={() => dispatch({ type: 'TOGGLE_PERM_MODAL', payload: true })}
                className="w-full group relative overflow-hidden p-1 rounded-2xl transition-all active:scale-[0.99] focus:outline-none"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 opacity-10 group-hover:opacity-20 transition-opacity duration-500" />
                <div className="relative bg-[var(--bg-panel)]/80 backdrop-blur-md border border-indigo-500/30 group-hover:border-indigo-500/60 rounded-xl px-4 py-3 md:px-6 md:py-4 flex items-center justify-between transition-all shadow-lg shadow-indigo-500/5">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl group-hover:bg-indigo-500 group-hover:text-white transition-colors duration-300">
                      <ShieldCheck size={20} />
                    </div>
                    <div className="text-left">
                      <h3 className="text-[10px] md:text-xs font-black text-[var(--text-primary)] uppercase tracking-widest group-hover:text-indigo-300 transition-colors">Ruxsatlar Tizimi</h3>
                      <p className="text-[8px] md:text-[9px] text-[var(--text-muted)] uppercase tracking-wider hidden sm:block">Xodimning tizimdagi huquqlarini boshqarish</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-indigo-400/60 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all">
                    <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline-block">Tahrirlash</span>
                    <ChevronRight size={16} />
                  </div>
                </div>
              </button>
            )}

            {/* Details Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ProfileItem icon={<Phone />} label="Telefon Raqam" value={admin.phone_number || "---"} color="text-emerald-400" />
              <ProfileItem icon={<Calendar />} label="Qabul Sanasi" value={admin.date_joined ? new Date(admin.date_joined).toLocaleDateString() : '---'} color="text-blue-400" />
              <ProfileItem icon={<Building2 />} label="Asosiy Filial" value={admin.branch?.name || "Markaz"} color="text-amber-400" />
              <ProfileItem icon={<Shield />} label="Ruxsat Darajasi" value={admin.role} color="text-purple-400" />
            </div>

            {/* MOLIYA DAFTARI LINK (Only for self profile or appropriate role) */}
            {!admin_id && user_info?.role === "admin" && (
              <div className="pt-2">
                <button
                  onClick={() => navigate('/admin/finance')}
                  className="w-full lux-card hover:transform-none! p-5 flex items-center justify-between group border-[var(--gold)]/20 shadow-xl bg-[var(--gold)]/5 active:scale-95 transition-all"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--gold)] text-black flex items-center justify-center shadow-[0_0_20px_rgba(184,134,11,0.3)] group-hover:scale-110 transition-transform">
                      <CreditCard size={22} />
                    </div>
                    <div className="text-left">
                      <h4 className="text-xs font-black text-[var(--gold)] uppercase tracking-[0.2em]">Moliya Daftari</h4>
                      <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-[0.2em] mt-1">Oylik hisob-kitoblar va to'lovlar tarixi</p>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-white/10 group-hover:border-[var(--gold)] group-hover:text-[var(--gold)] transition-all">
                    <ChevronRight size={18} />
                  </div>
                </button>
              </div>
            )}

            {/* Branches Section */}
            {user_info.role === "super_admin" && staffBranches.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-[var(--border-glass)]">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-[10px] md:text-[11px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] flex items-center gap-2">
                    <MapPin size={14} className="text-[var(--gold)]" /> Qo'shimcha Filiallar
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {staffBranches.filter(b => b.branch).map(branchAccess => {
                    const isMain = admin.branch?.id === branchAccess.branch.id;
                    return (
                      <div key={branchAccess.id} className={`flex items-center justify-between p-3.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] group hover:border-[var(--gold)]/30 transition-all ${isMain ? 'bg-[var(--gold)]/5 border-[var(--gold)]/20' : ''}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isMain ? 'bg-[var(--gold)]/20 text-[var(--gold)]' : 'bg-[var(--bg-void)] text-[var(--text-secondary)]'}`}>
                            <Building2 size={16} />
                          </div>
                          <div>
                            <h4 className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-wide">{branchAccess.branch.name}</h4>
                            <p className="text-[8px] text-[var(--text-muted)] uppercase tracking-wider font-bold">{branchAccess.access_level || 'Kirish'}</p>
                          </div>
                        </div>
                        {!isMain && (
                          <button onClick={() => removeBranchMutation.mutate(branchAccess.id)} className="p-2 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all" title="O'chirish">
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

      </div>

      <StaffTransferModal
        isOpen={state.isTransferModalOpen}
        onClose={() => dispatch({ type: 'TOGGLE_TRANSFER_MODAL', payload: false })}
        staffMember={admin || {}}
        onTransferSuccess={() => {
          queryClient.invalidateQueries(['admin']);
          toast.success("Ko'chirish tasdiqlandi.");
        }}
      />

      {/* PERMISSIONS MODAL */}
      {state.isPermModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-3xl animate-in fade-in duration-300">
          <div className="w-full max-w-[340px] lux-card !bg-[var(--bg-panel)]/95 shadow-2xl !p-6 md:!p-8 border border-[var(--border-glass)]">
            <div className="flex justify-between items-center mb-6 md:mb-8 border-b border-[var(--border-glass)] pb-4">
              <h3 className="text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">HUQUQLARNI BOSHQARISH</h3>
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

      {/* OLD EDIT MODAL REMOVED - replaced with inline edit mode */}
    </div>
  );
};

const ProfileItem = ({ icon, label, value, color }) => (
  <div className="p-4 md:p-5 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-glass)] flex flex-col items-center justify-center text-center gap-2 md:gap-3 hover:border-[var(--gold)]/30 hover:bg-[var(--bg-panel)]/80 transition-all hover:-translate-y-1 duration-300 group shadow-lg min-h-[110px]">
    <div className={`p-2.5 rounded-xl bg-[var(--bg-void)] ${color} group-hover:scale-110 transition-transform`}>
      {React.cloneElement(icon, { size: 18 })}
    </div>
    <div className="w-full">
      <p className="text-[11px] md:text-sm font-black text-[var(--text-primary)] uppercase tracking-tight truncate">{value}</p>
      <p className="text-[8px] md:text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-0.5 truncate">{label}</p>
    </div>
  </div>
);

export default AdminProfile;