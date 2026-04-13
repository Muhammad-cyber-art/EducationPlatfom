import React, { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft, Wallet, DollarSign, User, Bookmark, MapPin,
  CheckCircle, CheckCircle2, XCircle, ShieldCheck, Phone, Hash, Calendar,
  CreditCard, Edit3, Trash2, Settings, Save, X, Loader2,
  Percent, CalendarDays, Users, Calculator, RefreshCw, History, ExternalLink
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useSelector, useDispatch } from 'react-redux';
import {
  setData,
  setSelfData,
  setLoading,
  setRecalculating,
  setPayModal,
  setSelectedHistoryItem,
  setEditModal,
  setEditLoading,
  setEditForm,
  updateEditForm,
  resetFinanceState
} from '../../../store/slices/financeSlice';
import api from "../../../tokenUpdater/updater";
import StaffPaymentModal from "./StaffPaymentModal";
import AmountInput from "../../Common/AmountInput";
import toast from "react-hot-toast";
import ThemeToggle from "../../ThemeToggle";
import { get_user_info } from "../../Authorized/getRole";

const StaffPaymentDetails = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { staff_id } = useParams();
  const user_info = get_user_info();
  const isSuperAdmin = user_info?.role === "super_admin";

  const {
    data,
    selfData,
    loading,
    recalculating,
    payModal,
    selectedHistoryItem,
    editModal,
    editLoading,
    editForm
  } = useSelector((state) => state.finance);

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return "0 UZS";
    return new Intl.NumberFormat('uz-UZ').format(amount) + " UZS";
  };

  const formatPercentage = (value) => {
    if (!value && value !== 0) return "0%";
    return `${value}%`;
  };

  const fetchAllData = useCallback(async () => {
    try {
      dispatch(setLoading(true));
      const res = await api.get(`/finance/employee-payments/${staff_id}/`);
      const paymentInfo = res.data;
      dispatch(setData(paymentInfo));

      dispatch(setEditForm({
        fixed_salary: paymentInfo.fixed_salary || "0.00",
        commission_percentage: paymentInfo.commission_percentage || "0.00",
        salary_type: paymentInfo.salary_type || "fixed",
        karta: paymentInfo.karta || ""
      }));

      if (paymentInfo.employee_id) {
        let userUrl = paymentInfo.employee_role === 'admin'
          ? `/groups/admins/${paymentInfo.employee_id}/`
          : `/register/users/${paymentInfo.employee_id}/`;

        try {
          const userRes = await api.get(userUrl);
          dispatch(setSelfData(userRes.data));
        } catch (userError) {
          console.warn("User ma'lumotlari olinmadi");
        }
      }

    } catch (error) {
      console.error("Ma'lumotlarni yuklashda xato:", error);
    } finally {
      dispatch(setLoading(false));
    }
  }, [staff_id, dispatch]);

  useEffect(() => {
    fetchAllData();
    window.scrollTo(0, 0);

    return () => {
      dispatch(resetFinanceState());
    };
  }, [fetchAllData, staff_id, dispatch]);

  const handleRecalculate = async () => {
    if (!data || data.is_paid) return;
    try {
      dispatch(setRecalculating(true));
      await api.post(`/finance/employee-payments/${staff_id}/recalculate/`, {});
      toast.success("Maosh qayta hisoblandi.");
      await fetchAllData();
    } catch (error) {
      console.error("Recalculate error:", error);
      toast.error(error.response?.data?.error || "Qayta hisoblashda xatolik");
    } finally {
      dispatch(setRecalculating(false));
    }
  };

  const handleUpdate = async () => {
    if (!data || !data.employee_id) return;
    try {
      dispatch(setEditLoading(true));
      await api.patch(`/finance/staff-profiles/${data.employee_id}/`, editForm);
      dispatch(setEditModal(false));
      toast.success("Profil yangilandi");
      await fetchAllData();
    } catch (error) {
      console.error("Update error:", error);
      toast.error("Tahrirlashda xatolik");
    } finally {
      dispatch(setEditLoading(false));
    }
  };

  const handleDelete = async () => {
    if (!data || !data.employee_id) return;
    if (!window.confirm("Rostdan ham o'chirmoqchimisiz?")) return;
    try {
      await api.delete(`/finance/staff-profiles/${data.employee_id}/`);
      toast.success(`O'chirildi!`);
      navigate(-1);
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Xatolik yuz berdi");
    }
  };

  const handleHistoryPayment = (item) => {
    if (item.is_paid) return;
    dispatch(setSelectedHistoryItem(item));
    dispatch(setPayModal(true));
  };

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-[var(--bg-void)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[var(--gold)]"></div>
      </div>
    );
  }

  const isPercentageType = data.salary_type === 'percentage';

  return (
    <div className="min-h-screen bg-[var(--bg-void)] text-[var(--text-secondary)] font-sans selection:bg-[var(--gold)]/30 overflow-x-hidden">

      <StaffPaymentModal
        isOpen={payModal}
        onClose={() => { dispatch(setPayModal(false)); dispatch(setSelectedHistoryItem(null)); }}
        info={selectedHistoryItem || data}
        amount={
          selectedHistoryItem
            ? (selectedHistoryItem.salary_type === 'percentage' && !selectedHistoryItem.is_paid
              ? (selectedHistoryItem.calculated_commission || 0)
              : selectedHistoryItem.salary_base)
            : (isPercentageType && !data.is_paid
              ? (data.calculated_commission || 0)
              : (data.total_amount || data.salary_base))
        }
        onConfirm={async (bonus, deduction) => {
          const targetId = selectedHistoryItem ? selectedHistoryItem.id : staff_id;
          try {
            const response = await api.post(`/finance/employee-payments/${targetId}/confirm/`, {
              bonus: bonus,
              deductions: deduction
            });
            toast.success("To'lov muvaffaqiyatli tasdiqlandi!");
            dispatch(setPayModal(false));
            dispatch(setSelectedHistoryItem(null));
            await fetchAllData();
          } catch (error) {
            console.error("To'lovni tasdiqlashda xatolik:", error);
            console.error("Error response:", error.response?.data);
            const errorMessage = error.response?.data?.detail || error.response?.data?.error || "To'lovni tasdiqlashda xatolik yuz berdi";
            toast.error(errorMessage);
          }
        }}
      />

      {editModal && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-[2.5rem] w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[var(--gold)]/20 animate-in zoom-in-95 duration-200">

            <div className="sticky top-0 z-10 h-1 w-full bg-gradient-to-r from-[var(--gold)]/50 via-[var(--gold)] to-[var(--gold)]/50"></div>
            <div className="p-5">
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-base font-black text-[var(--text-primary)] uppercase tracking-tight">Tahrirlash</h2>
                <button onClick={() => dispatch(setEditModal(false))} className="text-[var(--text-muted)] hover:text-[var(--gold)] transition-colors p-1.5 hover:bg-[var(--gold)]/10 rounded-xl"><X size={18} /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1 mb-1.5 block">Maosh turi</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => dispatch(updateEditForm({ salary_type: 'fixed' }))}
                      className={`py-2.5 px-3 rounded-xl transition-all ${editForm.salary_type === 'fixed' ? 'bg-[var(--gold)] text-black shadow-[0_0_15px_rgba(184,134,11,0.3)]' : 'bg-[var(--bg-panel)] text-[var(--text-muted)] border border-[var(--border-glass)]'}`}
                    >
                      <span className="text-[10px] font-black uppercase">Belgilangan</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => dispatch(updateEditForm({ salary_type: 'percentage' }))}
                      className={`py-2.5 px-3 rounded-xl transition-all ${editForm.salary_type === 'percentage' ? 'bg-[var(--gold)] text-black shadow-[0_0_15px_rgba(184,134,11,0.3)]' : 'bg-[var(--bg-panel)] text-[var(--text-muted)] border border-[var(--border-glass)]'}`}
                    >
                      <span className="text-[10px] font-black uppercase">Foiz</span>
                    </button>
                  </div>
                </div>

                {editForm.salary_type === 'fixed' ? (
                  <div>
                    <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1 mb-1.5 block">Maosh (UZS)</label>
                    <AmountInput
                      value={editForm.fixed_salary}
                      onChange={(e) => dispatch(updateEditForm({ fixed_salary: e.target.value }))}
                      placeholder="0"
                      className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-xl py-2.5 px-4 text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)]/50 transition-all font-black text-sm shadow-inner italic"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1 mb-1.5 block">Foiz (%)</label>
                    <input
                      type="number"
                      value={editForm.commission_percentage}
                      onChange={(e) => dispatch(updateEditForm({ commission_percentage: e.target.value }))}
                      className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-xl py-2.5 px-4 text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)]/50 transition-all font-bold text-sm shadow-inner"
                    />
                  </div>
                )}

                <div>
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1 mb-1.5 block">Karta</label>
                  <input
                    type="text"
                    value={editForm.karta}
                    onChange={(e) => dispatch(updateEditForm({ karta: e.target.value }))}
                    className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-xl py-2.5 px-4 text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)]/50 transition-all font-bold text-sm font-mono tracking-widest shadow-inner"
                  />
                </div>

                <button
                  onClick={handleUpdate}
                  disabled={editLoading}
                  className="w-full bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-black font-black py-3 rounded-xl transition-all flex items-center justify-center gap-2 mt-2 text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(184,134,11,0.3)] active:scale-[0.98] disabled:opacity-50"
                >
                  {editLoading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  Saqlash
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="relative z-10 p-3 md:p-5 max-w-[1400px] mx-auto">

        <div className="flex flex-col gap-3 mb-5">
          <button onClick={() => navigate(-1)} className="group flex items-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--gold)] transition-all w-fit">
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-[9px] font-black uppercase tracking-[0.2em]">Orqaga</span>
          </button>

          <div className="w-full flex flex-col sm:flex-row items-center justify-between p-3 px-6 bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-2xl backdrop-blur-xl gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[var(--gold)]/10 rounded-lg text-[var(--gold)]">
                <Settings size={16} />
              </div>
              <div>
                <h3 className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-widest leading-none mb-1">Xodim Sozlamalari</h3>
                <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-tighter">
                  {isPercentageType ? "Foiz asosida" : "Belgilangan maosh"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <ThemeToggle />

              {isPercentageType && !data.is_paid && (
                <button
                  onClick={handleRecalculate}
                  disabled={recalculating}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white border border-emerald-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                >
                  {recalculating ? <Loader2 className="animate-spin" size={12} /> : <Calculator size={12} />}
                  Yangilash
                </button>
              )}

              <button onClick={() => isSuperAdmin ? dispatch(setEditModal(true)) : toast.error("Ruxsat yo'q")} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-[var(--bg-panel)] hover:bg-[var(--gold)]/10 border border-[var(--border-glass)] hover:border-[var(--gold)]/50 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all text-[var(--text-secondary)] hover:text-[var(--gold)]">
                <Edit3 size={12} /> Tahrirlash
              </button>

              {isSuperAdmin && (
                <button onClick={handleDelete} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">
                  <Trash2 size={12} /> O'chirish
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          <div className="lg:col-span-4 space-y-4">
            <div className="bg-[var(--bg-panel)] border border-[var(--border-glass)] p-6 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-0.5 bg-[var(--gold)]/50" />
              <div className="w-16 h-16 bg-gradient-to-br from-[var(--bg-void)] to-[var(--bg-panel)] border border-[var(--border-glass)] rounded-xl mx-auto mb-4 flex items-center justify-center text-[var(--gold)]">
                <User size={32} />
              </div>

              <h2 className="text-lg font-black text-[var(--text-primary)] text-center mb-1">
                {data.employee_first_name} {data.employee_last_name}
              </h2>

              <div className="flex justify-center mb-6">
                <span className="px-2.5 py-0.5 bg-[var(--gold)]/10 text-[var(--gold)] rounded-full text-[8px] font-black uppercase tracking-widest border border-[var(--gold)]/20">
                  {data.employee_role} • {data.salary_type}
                </span>
              </div>

              <div className="space-y-3 pt-4 border-t border-[var(--border-glass)]">
                <InfoItem icon={<Hash size={12} />} label="ID" value={`#${data.employee_id}`} />
                <InfoItem icon={<MapPin size={12} />} label="Filial" value={`${data.employee_branch}-filial`} />
                <InfoItem icon={<Phone size={12} />} label="Tel" value={selfData?.phone_number || "Yo'q"} />
                <InfoItem icon={<CreditCard size={12} />} label="Karta" value={data.karta || "Yo'q"} color={data.karta ? "text-[var(--gold)]" : ""} />
              </div>
            </div>

            <div className={`p-4 rounded-xl border ${data.is_paid ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[8px] font-black text-[var(--text-muted)] uppercase mb-0.5">Holat</p>
                  <p className={`text-[13px] font-black uppercase ${data.is_paid ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {data.is_paid ? "To'langan" : "Kutilmoqda"}
                  </p>
                </div>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${data.is_paid ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                  {data.is_paid ? <CheckCircle size={20} /> : <XCircle size={20} />}
                </div>
              </div>
            </div>

            <div className={`p-4 rounded-xl border ${isPercentageType ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-[var(--gold)]/20 bg-[var(--gold)]/5'}`}>
              <p className="text-[8px] font-black text-[var(--text-muted)] uppercase mb-1">Maosh Turi</p>
              <div className="flex items-baseline gap-2">
                <p className="text-xl font-black text-[var(--text-primary)] tabular-nums">
                  {isPercentageType ? formatPercentage(data.commission_percentage) : formatCurrency(data.salary_base)}
                </p>
                <span className="text-[9px] font-black text-[var(--text-muted)] uppercase">{isPercentageType ? "KPI" : "Belgilangan"}</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-4">
            <div className={`grid gap-4 ${isPercentageType ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2'}`}>

              {/* 1. ASOSIY MAOSH KARTASI */}
              {isPercentageType ? (
                // AGAR FOIZ BO'LSA: Asosiy karta = Hisoblangan Ulush
                <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-emerald-500/20 shadow-lg shadow-emerald-900/10">
                  <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">
                    Asosiy (KPI {data.commission_percentage}%)
                  </p>
                  <h3 className="text-lg font-black text-[var(--text-primary)] tabular-nums">
                    {formatCurrency(data.calculated_commission || 0)}
                  </h3>
                </div>
              ) : (
                // AGAR FIXED BO'LSA: Asosiy karta = Fixed Maosh
                <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)]">
                  <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">
                    Asosiy Maosh
                  </p>
                  <h3 className="text-lg font-black text-[var(--text-primary)] tabular-nums">
                    {formatCurrency(data.salary_base)}
                  </h3>
                </div>
              )}

              {/* 2. QO'SHIMCHA KARTALAR (Faqat Percentage uchun) */}
              {isPercentageType && (
                <>
                  <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)]">
                    <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">
                      Guruhlardan Tushum
                    </p>
                    <h3 className="text-lg font-black text-[var(--text-primary)] tabular-nums">
                      {formatCurrency(data.groups_income || 0)}
                    </h3>
                  </div>

                  <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] opacity-80">
                    <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">
                      Fix Qismi
                    </p>
                    <h3 className="text-lg font-black text-[var(--text-primary)] tabular-nums">
                      {formatCurrency(data.salary_base || 0)}
                    </h3>
                  </div>
                </>
              )}

              {/* 3. JAMI TO'LOV */}
              <div className="p-4 rounded-xl bg-[var(--gold)]/10 border border-[var(--gold)]/20">
                <p className="text-[9px] font-black text-[var(--gold)] uppercase tracking-widest mb-1">
                  Jami To'lov
                </p>
                <h3 className="text-lg font-black text-[var(--text-primary)] tabular-nums">
                  {formatCurrency(data.total_amount)}
                </h3>
              </div>
            </div>

            <div className="bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--border-glass)] flex items-center justify-between bg-[var(--bg-void)]/50">
                <div className="flex items-center gap-2">
                  <Bookmark size={14} className="text-[var(--gold)]" />
                  <span className="text-[11px] font-black text-[var(--text-primary)] uppercase">Tafsilotlar</span>
                </div>
                <span className="text-[9px] font-black text-[var(--text-muted)]">
                  <Calendar size={10} className="inline mr-1" /> {data.month}
                </span>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-3 mb-5">
                  <DetailRow label="Sana" value={data.month} />
                  <DetailRow label="To'langan" value={data.paid_at ? new Date(data.paid_at).toLocaleDateString() : "Hali yo'q"} />
                  <DetailRow label="Xodim ID" value={data.employee_id} />
                  <DetailRow label="Turi" value={data.salary_type} />
                </div>

                {!data.is_paid && (
                  <button onClick={() => dispatch(setPayModal(true))} className="w-full py-3 rounded-lg bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-black font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(184,134,11,0.3)] transition-all active:scale-[0.98]">
                    To'lovni tasdiqlash
                  </button>
                )}
              </div>
            </div>

            {/* KPI TAFSILOTLARI (Faqat foizli mentorlar uchun) */}
            {isPercentageType && data.mentor_groups && data.mentor_groups.length > 0 && (
              <div className="bg-[var(--bg-panel)] border border-emerald-500/20 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-[var(--border-glass)] flex items-center justify-between bg-emerald-500/5">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Users size={14} />
                    <span className="text-[11px] font-black uppercase tracking-widest">Guruhlar Tafsiloti</span>
                  </div>
                  <span className="text-[9px] font-black text-emerald-500/60 uppercase">
                    Jami Real Tushum: {formatCurrency(data.groups_income)}
                  </span>
                </div>
                <div className="p-3 overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[var(--border-glass)]">
                        <th className="px-3 py-2 text-[8px] font-black text-[var(--text-muted)] uppercase">Guruh</th>
                        <th className="px-3 py-2 text-[8px] font-black text-[var(--text-muted)] uppercase text-center">O'quvchi</th>
                        <th className="px-3 py-2 text-[8px] font-black text-[var(--text-muted)] uppercase text-right">Tushum</th>
                        <th className="px-3 py-2 text-[8px] font-black text-[var(--text-muted)] uppercase text-right text-rose-400">Refund</th>
                        <th className="px-3 py-2 text-[8px] font-black text-[var(--text-muted)] uppercase text-right text-emerald-400">Real Tushum</th>
                        <th className="px-3 py-2 text-[8px] font-black text-[var(--text-muted)] uppercase text-right">Mentor ulushi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-glass)]">
                      {data.mentor_groups.map((group) => (
                        <tr key={group.id} className="hover:bg-[var(--gold-dim)] transition-colors">
                          <td className="px-3 py-2.5">
                            <p className="text-[10px] font-black text-[var(--text-primary)] leading-tight uppercase italic">{group.name}</p>
                            <p className="text-[8px] text-[var(--text-muted)] font-bold uppercase">{group.branch_name || "Asosiy"}</p>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-[var(--bg-void)] text-[10px] font-black text-[var(--gold)] border border-[var(--border-glass)]">
                              {group.students_count}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-[10px] text-[var(--text-secondary)] tabular-nums">
                            {formatCurrency(group.monthly_income)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-[10px] text-rose-400 tabular-nums">
                            -{formatCurrency(group.refund_amount || 0)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-[10px] text-emerald-400 tabular-nums">
                            {formatCurrency(group.real_income || group.monthly_income)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-black text-[10px] text-emerald-400 tabular-nums">
                            {formatCurrency((group.real_income || group.monthly_income) * (data.commission_percentage / 100))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--border-glass)] flex items-center gap-2 bg-[var(--bg-void)]/50">
                <History size={14} className="text-[var(--gold)]" />
                <span className="text-[11px] font-black text-[var(--text-primary)] uppercase">Tarix</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[var(--border-glass)]">
                      <th className="px-5 py-2.5 text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">Oy</th>
                      <th className="px-5 py-2.5 text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">Maosh</th>
                      <th className="px-5 py-2.5 text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest text-right">Amal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payment_history?.map((item) => (
                      <tr key={item.id} className={`border-b border-[var(--border-glass)] hover:bg-[var(--gold-dim)] transition-colors ${parseInt(staff_id) === item.id ? 'bg-[var(--gold)]/5' : ''}`}>
                        <td className="px-5 py-3 text-[11px] font-bold text-[var(--text-secondary)]">
                          {item.month}
                        </td>
                        <td className="px-5 py-3 text-[11px] font-black text-[var(--text-primary)] tabular-nums">
                          {formatCurrency(
                            item.is_paid
                              ? (item.total_amount || item.amount || item.salary_base)
                              : (item.salary_type === 'percentage'
                                ? (item.calculated_commission || item.salary_base)
                                : item.salary_base)
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {!item.is_paid && (
                              <button onClick={() => handleHistoryPayment(item)} className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded hover:bg-emerald-500 hover:text-white transition-all"><Wallet size={12} /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div >
  );
};

const InfoItem = ({ icon, label, value, color = "" }) => (
  <div className="flex items-center justify-between text-[11px]">
    <div className="flex items-center gap-2 text-[var(--text-muted)]">
      {icon}
      <span className="font-bold uppercase tracking-tighter text-[9px]">{label}</span>
    </div>
    <span className={`font-black truncate max-w-[120px] ${color || 'text-[var(--text-secondary)]'}`}>{value}</span>
  </div>
);

const DetailRow = ({ label, value }) => (
  <div className="flex items-center justify-between py-0.5">
    <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">{label}</span>
    <span className="text-[11px] font-bold text-[var(--text-primary)] tracking-tight">{value}</span>
  </div>
);

export default StaffPaymentDetails;