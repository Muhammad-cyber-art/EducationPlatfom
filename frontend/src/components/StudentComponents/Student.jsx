import { useParams, useNavigate } from "react-router-dom";
import api from "../../tokenUpdater/updater";
import { useEffect, useReducer, useCallback, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import GoBackButton from "../sendback";
import {
  CreditCard, User, Phone, CheckCircle2, Edit3, Trash2,
  Settings2, Save, X, MapPin, FileText, MoreVertical,
  LogOut, LogIn, CalendarDays, History, Loader2, XCircle,
  Camera, Briefcase, GraduationCap, ChevronRight, Activity, ShieldCheck, ArrowUpRight, ArrowDownRight, Send, Layers
} from 'lucide-react';
import React from "react";
import PaymentModal from "./PaymentModal";
import toast from "react-hot-toast";
import { get_user_info } from "../Authorized/getRole";
import TransferStudentModal from "./TransferStudentModal";
import MergeStudentModal from "./MergeStudentModal";
import { useCurrentBranch } from "../Authorized/useBranchId";
import AmountInput from "../Common/AmountInput";
import { createPortal } from "react-dom";
const initialState = {
  isModalOpen: false,
  isTransferModalOpen: false,
  showGroupMenu: false,
  isEditing: false,
  editData: {
    full_name: "", phone: "", parent_name: "", parent_phone: "",
    address: "", notes: "", group: null, image: null,
    status: "", custom_fee: "", telegram_id: "", parent_telegram_id: ""
  },
  previewImage: null,
  isEditPaymentModalOpen: false,
  isCustomPaymentModalOpen: false,
  isMergeModalOpen: false,
  selectedPayment: null
};

function reducer(state, action) {
  switch (action.type) {
    case 'TOGGLE_MODAL': return { ...state, isModalOpen: action.payload };
    case 'TOGGLE_TRANSFER_MODAL': return { ...state, isTransferModalOpen: action.payload };
    case 'TOGGLE_MENU': return { ...state, showGroupMenu: action.payload ?? !state.showGroupMenu };
    case 'SET_EDITING': return { ...state, isEditing: action.payload, previewImage: null };
    case 'SET_EDIT_DATA': return { ...state, editData: action.payload };
    case 'UPDATE_EDIT_FIELD': return { ...state, editData: { ...state.editData, ...action.payload } };
    case 'SET_PREVIEW': return { ...state, previewImage: action.payload };
    case 'TOGGLE_EDIT_PAYMENT': return { ...state, isEditPaymentModalOpen: action.payload, selectedPayment: action.payment };
    case 'TOGGLE_CUSTOM_PAYMENT': return { ...state, isCustomPaymentModalOpen: action.payload };
    case 'TOGGLE_MERGE_MODAL': return { ...state, isMergeModalOpen: action.payload };
    default: return state;
  }
}

const PaymentCheckout = ({ payment, onConfirm }) => {
  const [ignoreRefund, setIgnoreRefund] = useState(false);
  const refundAmount = payment?.refund_amount;

  if (!refundAmount || refundAmount <= 0) {
    return (
      <button
        onClick={() => onConfirm(payment.id)}
        className="p-3 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-black rounded-xl font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95"
        title="To'lash"
      >
        <CreditCard size={18} />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-[var(--bg-void)]/40 border border-[var(--border-glass)] py-1.5 px-2.5 rounded-2xl shadow-lg animate-in fade-in zoom-in-95">
      <label className="flex items-center gap-2.5 cursor-pointer pl-1 pr-2 select-none group" title={!ignoreRefund ? "Chegirmani qo'llash" : "Chegirmani bekor qilish"}>
        <div className="relative inline-flex items-center">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={!ignoreRefund}
            onChange={() => setIgnoreRefund(!ignoreRefund)}
          />
          <div className="w-8 h-4 bg-[var(--text-muted)]/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500 group-hover:after:scale-95 shadow-inner"></div>
        </div>
        <div className="flex flex-col justify-center">
          <span className="text-[7px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] leading-none mb-0.5">
            Chegirma
          </span>
          <span className={`text-[10px] font-black uppercase tracking-widest leading-none transition-all ${!ignoreRefund ? "text-emerald-500" : "text-gray-500 line-through opacity-50"}`}>
            -{Math.floor(refundAmount).toLocaleString()}
          </span>
        </div>
      </label>

      <div className="w-px h-6 bg-[var(--border-glass)]"></div>

      <button
        onClick={() => onConfirm(payment.id, null, ignoreRefund)}
        className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-black transition-all shadow-md active:scale-90 flex items-center justify-center cursor-pointer relative z-10"
        title="To'lovni tasdiqlash"
      >
        <CreditCard size={16} />
      </button>
    </div>
  );
};

export default function StudentProfilePage() {
  const { student_id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const branchID = useCurrentBranch();
  const [state, dispatch] = useReducer(reducer, initialState);
  const user_info = get_user_info();

  const { data: userData = {} } = useQuery({
    queryKey: ['user-me'],
    queryFn: () => api.get('/user/me/').then(res => res.data),
    staleTime: Infinity,
  });

  const perms = userData.permissions || {};
  const userRole = (userData.role || user_info?.role || "").toLowerCase();
  const canEditStudent = userRole === "admin" || userRole === "super_admin" || (userRole === "mentor" && perms.students === true);
  const canConfirmPayment = userRole === "admin" || userRole === "super_admin";

  const { data: studentData = {}, isLoading: studentLoading } = useQuery({
    queryKey: ['student', student_id],
    enabled: !!student_id && !!userData.id,
    queryFn: async () => {
      const res = await api.get(`groups/nested_students/${student_id}`);
      dispatch({
        type: 'SET_EDIT_DATA',
        payload: {
          full_name: res.data.full_name || "", phone: res.data.phone || "",
          parent_name: res.data.parent_name || "", parent_phone: res.data.parent_phone || "",
          address: res.data.address || "", notes: res.data.notes || "",
          birth_date: res.data.birth_date || "",
          group: res.data.group?.id, image: null,
          status: res.data.status || "regular",
          custom_fee: res.data.custom_fee || "",
          telegram_id: res.data.telegram_id || "",
          parent_telegram_id: res.data.parent_telegram_id || ""
        }
      });
      return res.data;
    }
  });

  const { data: paymentsAllGroups = [], isLoading: paymentLoading } = useQuery({
    queryKey: ['payments-all', student_id],
    queryFn: async () => {
      const payRes = await api.get(`/finance/student-payments/?student=${student_id}`);
      return payRes.data;
    },
    enabled: !!student_id && !!userData.id
  });

  const { data: branchGroups = [] } = useQuery({
    queryKey: ['groups-list', branchID],
    queryFn: () => api.get(`/groups/nested_groups/?branch_id=${branchID}`).then(res => res.data),
    enabled: !!userData.id && !!branchID,
  });

  const { data: transfers = [] } = useQuery({
    queryKey: ['student-transfers', student_id],
    queryFn: () => api.get(`/groups/students/${student_id}/transfers/`).then(res => res.data),
    enabled: !!student_id && !!userData.id,
  });

  const editMutation = useMutation({
    mutationFn: async (data) => {
      const formData = new FormData();
      Object.keys(data).forEach(key => {
        if (key === 'image') {
          if (data[key] instanceof File) formData.append('image', data[key]);
        } else if (data[key] !== null && data[key] !== undefined && data[key] !== "") {
          formData.append(key, data[key]);
        }
      });
      return await api.patch(`groups/students/${student_id}/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['student']);
      dispatch({ type: 'SET_EDITING', payload: false });
      toast.success("Profil tahrirlandi.");
    }
  });

  const paymentMutation = useMutation({
    mutationFn: async ({ id, amount, ignore_refund }) => {
      const payload = amount ? { amount } : {};
      if (ignore_refund !== undefined) payload.ignore_refund = ignore_refund;
      return await api.post(`/finance/student-payments/${id}/confirm/`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['payments']);
      dispatch({ type: 'TOGGLE_MODAL', payload: false });
      toast.success("To'lov tasdiqlandi.");
    }
  });

  const editPaymentMutation = useMutation({
    mutationFn: async ({ id, amount, month }) => {
      return await api.patch(`/finance/student-payments/${id}/`, { amount, month });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['payments']);
      dispatch({ type: 'TOGGLE_EDIT_PAYMENT', payload: false });
      toast.success("To'lov tahrirlandi.");
    }
  });

  const customPaymentMutation = useMutation({
    mutationFn: async (data) => {
      return await api.post(`/finance/student-payments/custom-payment/`, {
        student: student_id,
        group: studentData?.group?.id,
        ...data
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['payments']);
      dispatch({ type: 'TOGGLE_CUSTOM_PAYMENT', payload: false });
      toast.success("To'lov qabul qilindi.");
    }
  });

  const unenrollMutation = useMutation({
    mutationFn: async (groupId) => await api.post(`groups/groups/${groupId}/unenroll-student/`, { student_id }),
    onSuccess: () => {
      queryClient.invalidateQueries(['student']);
      toast.success("O'quvchi guruhdan chiqarildi.");
    }
  });

  const archiveMutation = useMutation({
    mutationFn: async (reason) => await api.delete(`groups/students/${student_id}/`, { data: { reason } }),
    onSuccess: () => {
      toast.success("O'quvchi tizimdan butkul o'chirildi.");
      navigate(-1);
    }
  });

  const mergeMutation = useMutation({
    mutationFn: async (duplicateId) => await api.post(`groups/students/${student_id}/merge/`, { duplicate_id: duplicateId }),
    onSuccess: (res) => {
      queryClient.invalidateQueries(['student']);
      queryClient.invalidateQueries(['payments-all']);
      dispatch({ type: 'TOGGLE_MERGE_MODAL', payload: false });
      toast.success(res.data.message || "Muvaffaqiyatli birlashtirildi.");
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || "Birlashtirishda xatolik yuz berdi");
    }
  });

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      dispatch({ type: 'UPDATE_EDIT_FIELD', payload: { image: file } });
      dispatch({ type: 'SET_PREVIEW', payload: URL.createObjectURL(file) });
    }
  };

  const handleSaveEdit = () => editMutation.mutate(state.editData);

  const handlePaymentConfirm = (paymentId, amount = null, ignore_refund = false) => {
    const idToConfirm = paymentId || primaryPayment?.id;
    if (idToConfirm) {
      paymentMutation.mutate({ id: idToConfirm, amount, ignore_refund });
    } else {
      toast.error("Joriy oy uchun to'lov ma'lumoti topilmadi.");
    }
  };

  // Optimallashtirilgan loading: faqat birinchi marta ma'lumot yuklanayotganda ko'rsatamiz
  if (studentLoading && !studentData.full_name) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-[var(--gold)]" size={40} />
      </div>
    );
  }
  const { isEditing, editData, isModalOpen, isTransferModalOpen, showGroupMenu, previewImage, isEditPaymentModalOpen, isCustomPaymentModalOpen, selectedPayment } = state;
  const groups = studentData?.groups || [];
  const primaryGroup = groups[0] || {};
  const primaryPayment = paymentsAllGroups.find(p => p.group === primaryGroup.id) || {};

  // Barcha guruhlardagi asosiy to'lov va uning tarixini yig'ish
  const payments = paymentsAllGroups.flatMap(gp => {
    const groupInfo = groups.find(g => g.id === gp.group);
    const history = gp.payment_history || [];
    // Asosiy recordni va tarixini bitta listga yig'amiz
    return [
      { ...gp, group_name: groupInfo?.name || "Eski guruh" },
      ...history.map(h => ({ ...h, group_name: groupInfo?.name || "Eski guruh" }))
    ];
  }).sort((a, b) => new Date(b.month) - new Date(a.month));

  const extraTransactions = paymentsAllGroups.flatMap(gp => {
    const groupInfo = groups.find(g => g.id === gp.group);
    return (gp.extra_transactions || []).map(t => ({ ...t, group_name: groupInfo?.name || "Eski guruh" }));
  });

  return (
    <div className="p-3 sm:p-6 space-y-6 sm:space-y-10">
      {/* Atmosphere Background Removed */}

      {/* TOP NAVIGATION */}
      <div className="flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-[100] bg-[var(--bg-void)] py-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:static sm:bg-transparent">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <GoBackButton />
          <div className="h-6 w-px bg-[var(--border-glass)] hidden sm:block"></div>
          <h1 className="text-base sm:text-lg font-bold text-[var(--text-primary)] truncate uppercase tracking-tight italic">
            {studentData?.full_name}
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Action Buttons */}
          {canEditStudent && (
            <div className="flex gap-1 bg-[var(--bg-panel)] p-0.5 sm:p-1 rounded-xl border border-[var(--border-glass)] shadow-xl">
              {isEditing ? (
                <>
                  <button onClick={handleSaveEdit} className="p-2 sm:p-2.5 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-all" title="Saqlash">
                    <Save size={18} />
                  </button>
                  <button onClick={() => dispatch({ type: 'SET_EDITING', payload: false })} className="p-2 sm:p-2.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-all" title="Bekor qilish">
                    <X size={18} />
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => dispatch({ type: 'SET_EDITING', payload: true })} className="p-2 sm:p-2.5 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all" title="Tahrirlash">
                    <Edit3 size={18} />
                  </button>
                  {userRole === 'admin' || userRole === 'super_admin' ? (
                    <button onClick={() => dispatch({ type: 'TOGGLE_MERGE_MODAL', payload: true })} className="p-2 sm:p-2.5 text-amber-500 hover:bg-amber-500/10 rounded-lg transition-all" title="Birlashtirish">
                      <Layers size={18} />
                    </button>
                  ) : null}
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

      {/* PROFILE HEADER */}
      <div className="flex flex-col md:flex-row items-center md:items-start gap-6 pb-10 border-b border-[var(--border-glass)] relative">
        <div className="relative group/avatar shrink-0">
          <div
            className="w-24 h-24 sm:w-32 sm:h-32 rounded-[2rem] overflow-hidden bg-[var(--bg-panel)] border border-[var(--border-glass)] p-1.5 shadow-lg relative"
            style={{ boxShadow: window.innerWidth > 1024 ? `0 20px 50px ${primaryPayment?.is_paid ? "#10b98115" : "#ef444415"}` : 'none' }}
          >
            <div className="w-full h-full rounded-[1.6rem] overflow-hidden bg-[var(--bg-void)] flex items-center justify-center relative">
              {previewImage ? (
                <img src={previewImage} className="w-full h-full object-cover" alt="" />
              ) : studentData?.image ? (
                <img src={studentData.image} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="flex flex-col items-center gap-1 opacity-40">
                  <User size={32} className="text-[var(--gold)]" />
                  <span className="text-[8px] font-black uppercase tracking-widest text-center mt-1">{studentData?.full_name?.[0]}</span>
                </div>
              )}

              {isEditing && (
                <label className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center cursor-pointer opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-300">
                  <Camera size={24} className="text-[var(--gold)] mb-2" />
                  <span className="text-[8px] font-black text-white uppercase tracking-widest">Rasmni o'zgartirish</span>
                  <input type="file" className="hidden" onChange={handleImageChange} />
                </label>
              )}
            </div>
          </div>
          <div
            className={`absolute -bottom-2 -right-2 w-8 h-8 rounded-full border-[6px] border-[var(--bg-void)] shadow-2xl flex items-center justify-center ${primaryPayment?.is_paid ? "bg-emerald-500" : "bg-red-500"}`}
          >
            {primaryPayment?.is_paid ? <ShieldCheck size={12} className="text-white" /> : <Activity size={12} className="text-white" />}
          </div>
        </div>

        <div className="flex-1 text-center md:text-left pt-2">
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-3">
            {isEditing ? (
              <div className="relative flex-1 max-w-md">
                <input
                  className="text-2xl sm:text-4xl font-black text-[var(--text-primary)] tracking-tighter uppercase italic bg-[var(--bg-void)]/60 border border-[var(--border-glass)] rounded-xl px-4 py-1 w-full outline-none focus:border-[var(--gold)]/50 transition-all"
                  value={editData.full_name || ""}
                  onChange={e => dispatch({ type: 'UPDATE_EDIT_FIELD', payload: { full_name: e.target.value } })}
                  placeholder="F.I.SH"
                />
                <div className="absolute -top-2 -left-2 px-2 py-0.5 bg-[var(--gold)] text-black text-[7px] font-black uppercase tracking-widest rounded-md">Ism-sharif tahrirlash</div>
              </div>
            ) : (
              <h1 className="text-2xl sm:text-4xl font-black text-[var(--text-primary)] tracking-tighter uppercase italic">
                {studentData?.full_name}
              </h1>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <div className="w-fit px-3 py-1 rounded-full border border-[var(--border-glass)] text-[9px] font-black uppercase tracking-[0.3em] bg-[var(--bg-void)]/60 text-[var(--gold)] shadow-inner">
                Protocol: <span className="opacity-60">#{student_id}</span>
              </div>

              {studentData?.joined_at && (
                <div className="w-fit px-3 py-1 rounded-full border border-emerald-500/20 text-[9px] font-black uppercase tracking-[0.1em] bg-emerald-500/5 text-emerald-500 shadow-inner">
                  Tizimga qo'shildi: <span className="opacity-80 font-normal">{new Date(studentData.joined_at).toLocaleDateString()}</span>
                </div>
              )}

              {studentData?.telegram_id && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0088cc]/10 border border-[#0088cc]/20 text-[#0088cc] shadow-lg animate-pulse" title="Telegram Botga ulangan">
                  <Send size={10} className="fill-current" />
                  <span className="text-[8px] font-black uppercase tracking-widest">BOT ACTIVE</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">

            {!isEditing && studentData?.phone && (
              <div className="flex items-center gap-2 text-[var(--text-secondary)] text-[10px] font-bold uppercase tracking-widest bg-[var(--bg-panel)]/40 px-3 py-1.5 rounded-xl border border-[var(--border-glass)]">
                <Phone size={12} className="text-[var(--gold)] opacity-50" />
                {studentData.phone}
              </div>
            )}

            {/* Status if and when needed */}
          </div>
        </div>
      </div>
      {/* PROFILE CONTENT GRID */}
      {isEditing ? (
        <div className="max-w-4xl mx-auto space-y-6 sm:space-y-10 px-3 sm:px-0">
          <div className="flex flex-col items-center gap-2 text-center mb-6">
            <div className="w-12 h-0.5 bg-[var(--gold)]/40 rounded-full mb-2" />
            <span className="text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.5em]">Tahrirlash rejimi</span>
            <h3 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-widest italic">Ma'lumotlarni yangilash</h3>
          </div>

          <div className="lux-card hover:!transform-none !p-5 sm:!p-10 border-[var(--gold)]/20 shadow-[0_30px_60px_-15px_rgba(184,134,11,0.1)]">
            <div className="flex flex-col space-y-10 sm:space-y-12">

              {/* Personal Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 pb-3 border-b border-[var(--border-glass)]">
                  <div className="p-2 rounded-lg bg-[var(--gold)]/10">
                    <User size={18} className="text-[var(--gold)]" />
                  </div>
                  <h4 className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-[0.3em]">Shaxsiy ma'lumotlar</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">To'liq ism-sharifi</label>
                    <input
                      className="lux-input !bg-[var(--bg-void)]/50 !py-4"
                      value={editData.full_name}
                      onChange={e => dispatch({ type: 'UPDATE_EDIT_FIELD', payload: { full_name: e.target.value } })}
                      placeholder="Masalan: Muhammad Komilov"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Telefon raqami</label>
                    <div className="relative">
                      <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--gold)]/50" />
                      <input
                        className="lux-input !bg-[var(--bg-void)]/50 !py-4 !pl-12"
                        value={editData.phone || ""}
                        onChange={e => dispatch({ type: 'UPDATE_EDIT_FIELD', payload: { phone: e.target.value } })}
                        placeholder="+998 90 123 45 67"
                      />
                    </div>
                  </div>



                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Yashash manzili</label>
                    <div className="relative">
                      <MapPin size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--gold)]/50" />
                      <input
                        className="lux-input !bg-[var(--bg-void)]/50 !py-4 !pl-12"
                        value={editData.address || ""}
                        onChange={e => dispatch({ type: 'UPDATE_EDIT_FIELD', payload: { address: e.target.value } })}
                        placeholder="Masalan: Toshkent sh., Chilonzor tumani"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Guruhni tanlang</label>
                    <div className="relative">
                      <GraduationCap size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--gold)]/50" />
                      <select
                        className="lux-input !bg-[var(--bg-void)]/50 !py-4 !pl-12 appearance-none cursor-pointer"
                        value={editData.group || ""}
                        onChange={e => dispatch({ type: 'UPDATE_EDIT_FIELD', payload: { group: e.target.value } })}
                      >
                        <option value="">Guruhga biriktirilmagan</option>
                        {branchGroups.map(g => (
                          <option key={g.id} value={g.id} className="bg-[var(--bg-panel)]">{g.name} — {g.subject}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Guardian Section */}
              <div className="space-y-6 pt-4">
                <div className="flex items-center gap-3 pb-3 border-b border-[var(--border-glass)]">
                  <div className="p-2 rounded-lg bg-[var(--gold)]/10">
                    <ShieldCheck size={18} className="text-[var(--gold)]" />
                  </div>
                  <h4 className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-[0.3em]">Vasiy ma'lumotlari</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">


                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Vasiy telefoni</label>
                    <div className="relative">
                      <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--gold)]/50" />
                      <input
                        className="lux-input !bg-[var(--bg-void)]/50 !py-4 !pl-12"
                        value={editData.parent_phone || ""}
                        onChange={e => dispatch({ type: 'UPDATE_EDIT_FIELD', payload: { parent_phone: e.target.value } })}
                        placeholder="+998 90 987 65 43"
                      />
                    </div>
                  </div>



                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Qo'shimcha eslatmalar</label>
                    <textarea
                      className="lux-input !bg-[var(--bg-void)]/50 !py-4 !h-[120px] !resize-none !leading-relaxed"
                      value={editData.notes}
                      onChange={e => dispatch({ type: 'UPDATE_EDIT_FIELD', payload: { notes: e.target.value } })}
                      placeholder="O'quvchi haqida muhim qaydlar..."
                    />
                  </div>
                </div>
              </div>

              {/* Financial Section */}
              <div className="space-y-6 pt-4">
                <div className="flex items-center gap-3 pb-3 border-b border-[var(--border-glass)]">
                  <div className="p-2 rounded-lg bg-[var(--gold)]/10">
                    <CreditCard size={18} className="text-[var(--gold)]" />
                  </div>
                  <h4 className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-[0.3em]">Moliyaviy status</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">O'quvchi holati</label>
                    <select
                      className="lux-input !bg-[var(--bg-void)]/50 !py-4"
                      value={editData.status || "regular"}
                      onChange={e => dispatch({ type: 'UPDATE_EDIT_FIELD', payload: { status: e.target.value } })}
                    >
                      <option value="regular">ODDIY</option>
                      <option value="discount">IMTIYOZLI</option>
                      <option value="low_income">KAM TA'MINLANGAN</option>
                      <option value="negotiated">KELISHILGAN NARX</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Individual to'lov narxi</label>
                    <AmountInput
                      className="lux-input !bg-[var(--bg-void)]/50 !py-4 pr-12"
                      value={editData.custom_fee || ""}
                      onChange={e => dispatch({ type: 'UPDATE_EDIT_FIELD', payload: { custom_fee: e.target.value } })}
                      placeholder="Guruh narxidan farqli bo'lsa"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-10 pt-8 border-t border-[var(--border-glass)] flex flex-col-reverse sm:flex-row items-center justify-end gap-3 sm:gap-5">
                <button
                  onClick={() => dispatch({ type: 'SET_EDITING', payload: false })}
                  className="w-full sm:w-auto px-10 py-4 rounded-2xl border border-[var(--border-glass)] text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all text-[var(--text-secondary)] hover:text-white"
                >
                  Bekor qilish
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={editMutation.isPending}
                  className="w-full sm:w-auto lux-btn-primary px-16 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-[0_15px_40px_rgba(184,134,11,0.25)] active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  {editMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Saqlash
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 sm:gap-10">

          {/* LEFT COLUMN: Dossier Details */}
          <div className="xl:col-span-4 space-y-8">

            {/* IDENTIFICATION DOSSIER */}
            <div className="lux-card space-y-6">
              <div className="flex items-center gap-3 px-1">
                <span className="text-[10px] font-bold text-[var(--gold)] uppercase tracking-[0.3em]">Shaxsiy ma'lumotlar</span>
              </div>
              <div className="space-y-4">
                <ProfileAttribute icon={<Phone size={14} />} label="Telefon" value={studentData?.phone} colorClass="text-blue-400 bg-blue-400/10 border border-blue-400/20" />
                <ProfileAttribute icon={<FileText size={14} />} label="Eslatmalar" value={studentData?.notes || "Qo'shimcha eslatmalar yo'q"} />
                {studentData?.telegram_id && (
                  <ProfileAttribute icon={<Send size={14} className="text-[#0088cc]" />} label="Telegram" value={"ULANGAN"} colorClass="text-[#0088cc] bg-[#0088cc]/10 border border-[#0088cc]/20" />
                )}
              </div>
            </div>

            {/* GUARDIAN DOSSIER */}
            <div className="lux-card space-y-6">
              <div className="flex items-center gap-3 px-1">
                <span className="text-[10px] font-bold text-[var(--gold)] uppercase tracking-[0.3em]">Vasiy ma'lumotlari</span>
              </div>
              <div className="space-y-4">
                <ProfileAttribute icon={<User size={14} />} label="F.I.SH" value={studentData?.parent_name || "N/A"} />
                <ProfileAttribute icon={<Phone size={14} />} label="Telefon" value={studentData?.parent_phone || "N/A"} colorClass="text-[var(--gold)] bg-[var(--gold)]/10 border border-[var(--gold)]/20" />
                {studentData?.parent_telegram_id ? (
                  <ProfileAttribute icon={<Send size={14} className="text-[#0088cc]" />} label="Telegram" value={"ULANGAN"} colorClass="text-[#0088cc] bg-[#0088cc]/10 border border-[#0088cc]/20" />
                ) : (
                  <ProfileAttribute icon={<Send size={14} className="opacity-20" />} label="Telegram" value={"ULANMAGAN"} />
                )}
              </div>
            </div>

            {/* FINANCIAL DOSSIER */}
            <div className="lux-card space-y-6">
              <div className="flex items-center gap-3 px-1">
                <span className="text-[10px] font-bold text-[var(--gold)] uppercase tracking-[0.3em]">Moliyaviy status</span>
              </div>
              <div className="space-y-4">
                <ProfileAttribute
                  icon={<ShieldCheck size={14} />}
                  label="Holati"
                  value={
                    studentData?.status === 'low_income' ? 'Kam ta\'minlangan' :
                      studentData?.status === 'discount' ? 'Imtiyozli' :
                        studentData?.status === 'negotiated' ? 'Kelishilgan narx' : 'Oddiy'
                  }
                />
                <ProfileAttribute
                  icon={<CreditCard size={14} />}
                  label="Individual narx"
                  value={studentData?.custom_fee ? `${Number(studentData.custom_fee).toLocaleString()} UZS` : "Belgilanmagan"}
                />
              </div>

              {canConfirmPayment && (
                <button
                  onClick={() => dispatch({ type: 'TOGGLE_CUSTOM_PAYMENT', payload: true })}
                  className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--gold)] text-black text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg"
                >
                  <Save size={14} /> Qo'shimcha summa kiritish
                </button>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: STRATEGIC ALIGNMENT & TREASURY */}
          <div className="xl:col-span-8 space-y-6">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {studentData.groups?.map(group => {
                const groupPayment = paymentsAllGroups.find(p => p.group === group.id);
                return (
                  <div key={group.id} className="space-y-4">
                    {/* GROUP ALIGNMENT */}
                    <div className="lux-card !p-4 sm:!p-6 group cursor-pointer hover:border-[var(--gold)]/30 transition-all relative" onClick={() => navigate(`/admin/groups/${group.id}`)}>
                      <div className="flex justify-between items-start mb-4 sm:mb-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--gold)]">
                            <GraduationCap size={24} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[7px] sm:text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest leading-none mb-1 sm:mb-1.5 italic">Guruh</p>
                            <h3 className="text-sm sm:text-lg font-bold text-[var(--text-primary)] uppercase tracking-tight group-hover:text-[var(--gold)] transition-colors truncate">{group.name}</h3>
                            {group.days && (
                              <p className="text-[8px] font-black uppercase tracking-[0.2em] mt-1.5">
                                {group.days === 'even' ? (
                                  <span className="text-[var(--gold)] bg-[var(--gold)]/10 px-2 py-0.5 rounded-full border border-[var(--gold)]/20">Juft kunlar</span>
                                ) : group.days === 'everyday' ? (
                                  <span className="text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Har kuni</span>
                                ) : (
                                  <span className="text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full border border-blue-400/20">Toq kunlar</span>
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="relative">
                          <button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_MENU', payload: group.id }); }} className="p-2 text-[var(--text-muted)] hover:text-white transition-all"><MoreVertical size={18} /></button>

                          {showGroupMenu === group.id && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-xl shadow-2xl z-50 overflow-hidden animate-in zoom-in-95 duration-100 origin-top-right">
                              <button
                                onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_TRANSFER_MODAL', payload: true }); dispatch({ type: 'TOGGLE_MENU', payload: false }); }}
                                className="w-full flex items-center gap-2.5 px-4 py-3 text-[10px] font-bold text-[var(--text-primary)] uppercase tracking-wider hover:bg-[var(--gold)] hover:text-black transition-colors"
                              >
                                <LogIn size={14} /> Guruhni ko'chirish
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); if (window.confirm("Guruhdan chiqarishni tasdiqlaysizmi?")) unenrollMutation.mutate(group.id); dispatch({ type: 'TOGGLE_MENU', payload: false }); }}
                                className="w-full flex items-center gap-2.5 px-4 py-3 text-[10px] font-bold text-red-500 uppercase tracking-wider hover:bg-red-500 hover:text-white transition-colors"
                              >
                                <LogOut size={14} /> Guruhdan chiqarish
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-bold text-[var(--text-secondary)]">
                        <div className="flex items-center gap-2"><User size={12} className="opacity-40" /> {group.mentor?.first_name || "Ustoz"}</div>
                        <div className="flex items-center gap-2"><CreditCard size={12} className="opacity-40" /> {group.monthly_price?.toLocaleString()} UZS</div>
                      </div>
                    </div>

                    {/* TREASURY STATUS FOR THIS GROUP */}
                    <div className="lux-card !p-4 flex flex-col justify-between">
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border border-[var(--border-glass)] ${groupPayment?.is_paid ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                            {groupPayment?.is_paid ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase tracking-widest leading-none mb-1 italic">To'lov holati ({group.name})</p>
                            <h3 className={`text-sm font-bold uppercase tracking-tight ${groupPayment?.is_paid ? 'text-emerald-500' : 'text-red-500'}`}>
                              {groupPayment?.is_paid ? "To'langan" : "Qarzdorlik bor"}
                            </h3>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {groupPayment && !groupPayment.is_paid && canConfirmPayment && (
                            <>
                              <PaymentCheckout payment={groupPayment} onConfirm={handlePaymentConfirm} />
                              <button
                                onClick={() => dispatch({ type: 'TOGGLE_EDIT_PAYMENT', payload: true, payment: groupPayment })}
                                className="p-3 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-black rounded-xl transition-all"
                                title="To'lovni tahrirlash"
                              >
                                <Edit3 size={18} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="h-1 w-full bg-[var(--bg-void)] rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-1000 ${groupPayment?.is_paid ? 'bg-emerald-500 w-full' : 'bg-red-500 w-1/12'}`}></div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {studentData.groups?.length === 0 && (
                <div className="lux-card flex flex-col items-center justify-center py-12 opacity-40 grayscale">
                  <GraduationCap size={48} className="mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-[0.3em]">Guruhga biriktirilmagan</p>
                </div>
              )}
            </div>

            {/* TREASURY HISTORIA */}
            <div className="lux-card !p-0 overflow-hidden">
              <div className="p-6 border-b border-[var(--border-glass)] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  < History size={18} className="text-[var(--gold)]" />
                  <span className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-[0.3em]">To'lovlar tarixi</span>
                </div>
              </div>
              <div className="divide-y divide-[var(--border-glass)]">
                {payments.length > 0 ? (
                  <div className="divide-y divide-[var(--border-glass)]">
                    {payments.map((p) => (
                      <div key={p.id} className="p-6 flex items-center justify-between group hover:bg-[var(--gold-dim)] transition-colors">
                        <div className="flex items-center gap-5">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-[10px] border border-[var(--border-glass)] ${p.is_paid ? 'bg-emerald-500 shadow-[0_0_15px_#10b98120] text-black' : 'bg-red-500 shadow-[0_0_15px_#ef444420] text-white'}`}>
                            {new Date(p.month).toLocaleDateString('uz-UZ', { month: 'short' }).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
                              {new Date(p.month).toLocaleDateString('uz-UZ', { month: 'long', year: 'numeric' })}
                              {p.group_name && (
                                <span className="text-[7px] bg-[var(--gold)]/10 text-[var(--gold)] px-2 py-0.5 rounded-full border border-[var(--gold)]/20 tracking-widest leading-none">
                                  {p.group_name}
                                </span>
                              )}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                              <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">To'lov #{p.id}</p>
                              <p className="text-[9px] font-bold text-[var(--gold)] uppercase tracking-widest">📅 {p.lessons_count} dars</p>
                              <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">💰 {Math.floor(p.daily_price || 0).toLocaleString()} UZS/kun</p>
                              {p.absences_count > 0 && (
                                <p className="text-[9px] font-bold text-red-400 uppercase tracking-widest">⚠️ {p.absences_count} qoldirgan</p>
                              )}
                              {p.refund_amount > 0 && !p.refund_ignored && (
                                <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">🔄 Refund: {Math.floor(p.refund_amount).toLocaleString()} UZS</p>
                              )}
                              {p.refund_amount > 0 && p.refund_ignored && (
                                <p className="text-[9px] font-bold text-red-400 uppercase tracking-widest">🚫 Refund bekor qilingan</p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-8">
                          <p className="text-sm font-black text-[var(--text-primary)]">{p.amount?.toLocaleString()} UZS</p>
                          <div className="flex items-center gap-2">
                            {p.is_paid ? (
                              <CheckCircle2 size={20} className="text-emerald-500" />
                            ) : canConfirmPayment ? (
                              <PaymentCheckout payment={p} onConfirm={handlePaymentConfirm} />
                            ) : <XCircle size={20} className="text-red-500 opacity-30" />}

                            {canConfirmPayment && !p.is_paid && (
                              <button
                                onClick={() => dispatch({ type: 'TOGGLE_EDIT_PAYMENT', payload: true, payment: p })}
                                className="p-3 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-black rounded-xl transition-all"
                                title="Summani tahrirlash"
                              >
                                <Edit3 size={18} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {extraTransactions?.length > 0 && (
                  <div className={`${payments.length > 0 ? 'border-t-4 border-[var(--border-glass)]' : ''} bg-[var(--bg-void)]/30`}>
                    <div className="px-6 py-4 bg-[var(--bg-panel)]/50 border-b border-[var(--border-glass)]">
                      <h4 className="text-[9px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">Qo'shimcha tushumlar (Portal orqali)</h4>
                    </div>
                    <div className="space-y-4">
                      {extraTransactions?.map((tx, idx) => (
                        <div key={idx} className="flex items-center justify-between p-5 bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-2xl group/item hover:border-[var(--gold)]/30 transition-all">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${tx.transaction_type === 'income' ? 'bg-[var(--gold)]/10 text-[var(--gold)]' : 'bg-red-500/10 text-red-500'}`}>
                              {tx.transaction_type === 'income' ? <ArrowUpRight size={22} /> : <ArrowDownRight size={22} />}
                            </div>
                            <div>
                              <p className="text-[11px] font-black text-white uppercase tracking-widest">{tx.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase">{tx.date}</p>
                                <span className="w-1 h-1 rounded-full bg-[var(--border-glass)]"></span>
                                <p className="text-[9px] font-bold text-[var(--gold)]/60 uppercase">{tx.marked_by_name}</p>
                              </div>
                              {tx.description && <p className="text-[10px] text-[var(--text-muted)] mt-2 italic opacity-80">{tx.description}</p>}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-black tracking-tighter ${tx.transaction_type === 'income' ? 'text-[var(--gold)]' : 'text-red-500'}`}>
                              {tx.transaction_type === 'income' ? '+' : '-'}{Number(tx.amount).toLocaleString()} UZS
                            </p>
                            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest mt-1 opacity-40">PORTAL</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {payments.length === 0 && extraTransactions.length === 0 && (
                  <div className="py-20 text-center opacity-30 italic">
                    <History size={48} className="mx-auto mb-4" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">To'lovlar tarixi bo'sh</p>
                  </div>
                )}
              </div>
            </div>

            {/* TRANSFER HISTORIA */}
            {transfers.length > 0 && (
              <div className="lux-card hover:!transform-none !p-0 overflow-hidden border-l-4 border-l-[var(--gold)]/30 mt-6 sm:mt-10">
                <div className="p-6 border-b border-[var(--border-glass)] flex items-center justify-between bg-[var(--gold-dim)]">
                  <div className="flex items-center gap-4">
                    <History size={18} className="text-[var(--gold)]" />
                    <span className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-[0.3em]">Guruhlar tarixi (Transferlar)</span>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  {transfers.map((tr) => (
                    <div key={tr.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-2xl group/item hover:border-[var(--gold)]/30 transition-all gap-4 shadow-lg hover:shadow-[var(--gold)]/5">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-[var(--gold)]/10 flex items-center justify-center text-[var(--gold)]">
                          <LogIn size={22} />
                        </div>
                        <div>
                          <p className="text-[11px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                            {tr.from_group_name} <ChevronRight size={10} className="text-[var(--gold)]" /> {tr.to_group_name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{tr.transfer_date}</p>
                            <span className="w-1 h-1 rounded-full bg-[var(--border-glass)]"></span>
                            <p className="text-[9px] font-bold text-[var(--gold)]/60 uppercase tracking-widest">{tr.marked_by_name}</p>
                          </div>
                          {tr.reason && <p className="text-[10px] text-[var(--text-muted)] mt-2 italic opacity-80 leading-relaxed">{tr.reason}</p>}
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase">Eski guruh:</p>
                          <p className="text-[10px] font-black text-white">{Number(tr.old_group_fee).toLocaleString()} UZS</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase">Yangi guruh:</p>
                          <p className="text-[10px] font-black text-[var(--gold)]">{Number(tr.new_group_fee).toLocaleString()} UZS</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )
      }

      <PaymentModal
        isOpen={isModalOpen}
        onClose={() => dispatch({ type: 'TOGGLE_MODAL', payload: false })}
        onConfirm={(amount) => handlePaymentConfirm(null, amount)}
        amount={studentData?.custom_fee || primaryGroup?.monthly_price}
        loading={paymentMutation.isPending}
      />

      {/* Edit Payment Modal (Small Modal) */}
      <SmallFormModal
        isOpen={isEditPaymentModalOpen}
        onClose={() => dispatch({ type: 'TOGGLE_EDIT_PAYMENT', payload: false })}
        onSave={(val) => editPaymentMutation.mutate({ id: selectedPayment?.id, amount: val })}
        title="To'lov summasini tahrirlash"
        initialValue={selectedPayment?.amount}
        label="Yangi summa (UZS)"
      />

      {/* Custom Extra Payment Modal */}
      <ExtraPaymentModal
        isOpen={isCustomPaymentModalOpen}
        onClose={() => dispatch({ type: 'TOGGLE_CUSTOM_PAYMENT', payload: false })}
        onSave={(data) => customPaymentMutation.mutate(data)}
        loading={customPaymentMutation.isPending}
        studentName={studentData?.full_name}
        adminName={userData?.first_name ? `${userData.first_name} ${userData.last_name || ''}` : userData?.username}
      />

      <TransferStudentModal isOpen={isTransferModalOpen} onClose={() => dispatch({ type: 'TOGGLE_TRANSFER_MODAL', payload: false })} student={studentData} currentBranchId={studentData?.branch_id} api={api} onSuccess={() => { queryClient.invalidateQueries(['student']); queryClient.invalidateQueries(['payments']); }} />

      <MergeStudentModal
        isOpen={state.isMergeModalOpen}
        onClose={() => dispatch({ type: 'TOGGLE_MERGE_MODAL', payload: false })}
        masterStudent={studentData}
        onMerge={(dupId) => mergeMutation.mutate(dupId)}
      />
    </div>
  );
}

// ============== SMALL MODALS COMPONENTS ==============

const SmallFormModal = ({ isOpen, onClose, onSave, title, initialValue, label }) => {
  const [val, setVal] = useState(initialValue || "");
  useEffect(() => { if (isOpen) setVal(initialValue || ""); }, [isOpen, initialValue]);

  if (!isOpen) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[var(--bg-panel)] border border-[var(--border-glass)] w-full max-w-sm rounded-[2rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
        <h3 className="text-lg font-black text-white uppercase tracking-widest mb-6 italic">{title}</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">{label}</label>
            <input
              type="number"
              className="lux-input !bg-[var(--bg-void)]"
              value={val}
              onChange={e => setVal(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex gap-4 pt-4">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-[var(--border-glass)] text-[9px] font-black uppercase tracking-widest hover:bg-white/5 transition-all">Bekor qilish</button>
            <button onClick={() => onSave(val)} className="flex-1 py-3 rounded-xl bg-[var(--gold)] text-black text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all">Saqlash</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

const ExtraPaymentModal = ({ isOpen, onClose, onSave, loading, studentName, adminName }) => {
  const [data, setData] = useState({
    amount: "",
    payer_name: studentName || "",
    description: "",
    transaction_type: "income"
  });

  useEffect(() => {
    if (isOpen) setData({
      amount: "",
      payer_name: studentName || "",
      description: "",
      transaction_type: "income"
    });
  }, [isOpen, studentName]);

  if (!isOpen) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[var(--bg-panel)] border border-[var(--border-glass)] w-full max-w-md rounded-[2.5rem] p-10 shadow-3xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[var(--gold)]/10 flex items-center justify-center text-[var(--gold)]">
            <CreditCard size={20} />
          </div>
          <h3 className="text-xl font-black text-white uppercase tracking-widest italic">Portal Mas'uli</h3>
        </div>

        <div className="mb-6 flex flex-col gap-1">
          <p className="text-[10px] text-[var(--white)] font-bold uppercase tracking-widest opacity-60">O'quvchi: {studentName}</p>
          <p className="text-[10px] text-[var(--gold)] font-bold uppercase tracking-widest flex items-center gap-1.5 leading-none">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] shadow-[0_0_8px_var(--gold)]"></span>
            Mas'ul: {adminName}
          </p>
        </div>

        <div className="flex p-1 bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-2xl mb-6">
          <button
            onClick={() => setData({ ...data, transaction_type: 'income' })}
            className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${data.transaction_type === 'income' ? 'bg-[var(--gold)] text-black shadow-lg' : 'text-[var(--text-muted)] hover:text-white'}`}
          >
            Kirim
          </button>
          <button
            onClick={() => setData({ ...data, transaction_type: 'expense' })}
            className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${data.transaction_type === 'expense' ? 'bg-red-500 text-white shadow-lg' : 'text-[var(--text-muted)] hover:text-white'}`}
          >
            Chiqim
          </button>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Summa (UZS)</label>
            <input type="number" className="lux-input !bg-[var(--bg-void)] !py-4" value={data.amount} onChange={e => setData({ ...data, amount: e.target.value })} placeholder="Masalan: 50000" autoFocus />
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">{data.transaction_type === 'income' ? 'Kim to\'ladi?' : 'Kimga berildi?'}</label>
            <input className="lux-input !bg-[var(--bg-void)] !py-4" value={data.payer_name} onChange={e => setData({ ...data, payer_name: e.target.value })} placeholder="Ism-sharif" />
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Izohlar</label>
            <textarea className="lux-input !bg-[var(--bg-void)] !py-4 !h-24 resize-none" value={data.description} onChange={e => setData({ ...data, description: e.target.value })} placeholder="Dars uchun, kitob uchun yoki boshqa..." />
          </div>

          <div className="flex gap-4 pt-6">
            <button onClick={onClose} className="flex-1 py-4 rounded-2xl border border-[var(--border-glass)] text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all">Yopish</button>
            <button disabled={loading} onClick={() => onSave(data)} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 ${data.transaction_type === 'income' ? 'bg-[var(--gold)] text-black shadow-[0_0_20px_#b8860b30]' : 'bg-red-500 text-white shadow-[0_0_20px_#ef444430]'}`}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Saqlash
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

const ProfileAttribute = React.memo(({ icon, label, value, colorClass }) => (
  <div className="flex justify-between items-start gap-4">
    <div className="flex items-center gap-3">
      <div className="text-[var(--gold)] opacity-60">{icon}</div>
      <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
        {label}
      </p>
    </div>
    <div className="text-right flex-1 min-w-0">
      <div className={`text-[11px] font-bold uppercase tracking-tight ${colorClass ? `${colorClass} px-2 py-0.5 rounded-full inline-block shadow-sm mt-[-2px]` : 'text-[var(--text-primary)]'} ${label === "Eslatmalar" ? "whitespace-pre-wrap break-words leading-relaxed" : "truncate"}`}>
        {value}
      </div>
    </div>
  </div>
));
