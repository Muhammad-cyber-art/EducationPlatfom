import React, { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft, Wallet, DollarSign, User, Bookmark, MapPin,
  CheckCircle, CheckCircle2, XCircle, ShieldCheck, Phone, Hash, Calendar,
  CreditCard, Edit3, Trash2, Settings, Save, X, Loader2,
  Percent, CalendarDays, Users, Calculator, RefreshCw, History, ExternalLink,
  Coins, Receipt, PlusCircle, MinusCircle, FileText, TrendingUp
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
import StaffAdvanceModal from "./StaffAdvanceModal";

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

  const [selectedGroupForDebtors, setSelectedGroupForDebtors] = React.useState(null);

  const isPercentageType = data?.salary_type === 'percentage';
  const isStudentCountType = data?.salary_type === 'student_count';

  const studentCountSummary = React.useMemo(() => {
    if (!data) return {};
    const groups = data?.mentor_groups || [];
    return groups.reduce((acc, group) => {
      acc.groups += 1;
      acc.totalStudents += Number(group.students_count || 0);
      acc.paidStudents += Number(group.paid_students_count || 0);
      acc.paidIncome += Number(group.monthly_income || 0);
      acc.expectedIncome += Number(group.expected_income || 0);
      acc.mentorSharePaid += Number(group.mentor_share_paid || 0);
      acc.mentorShareExpected += Number(group.mentor_share_expected || 0);
      return acc;
    }, {
      groups: 0,
      totalStudents: 0,
      paidStudents: 0,
      paidIncome: 0,
      expectedIncome: 0,
      mentorSharePaid: 0,
      mentorShareExpected: 0
    });
  }, [data]);

  const liveBaseSalary = React.useMemo(() => {
    if (!data) return 0;
    return isPercentageType
      ? (data.calculated_commission || 0)
      : isStudentCountType
        ? (data.calculated_per_student || 0)
        : (data.salary_base || 0);
  }, [data, isPercentageType, isStudentCountType]);

  const finalTotalAmount = React.useMemo(() => {
    if (!data) return 0;
    const bonus = Number(data.bonus || 0);
    const deductions = Number(data.deductions || 0);
    const advances = Number(data.total_advances || 0);

    if (data.is_paid) return data.total_amount;
    return liveBaseSalary + bonus - deductions - advances;
  }, [data, liveBaseSalary]);

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
        per_student_amount: paymentInfo.per_student_amount || "0.00",
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
      if (error.response?.status === 404) {
        toast.error("Ma'lumot topilmadi yoki o'chirib yuborilgan");
        navigate(-1);
      } else {
        toast.error("Xatolik yuz berdi");
      }
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
    if (!window.confirm("DIQQAT! Ushbu xodimning barcha moliyaviy ma'lumotlarini (profilini) butunlay o'chirib tashlamoqchimisiz? Bu amalni ortga qaytarib bo'lmaydi!")) return;
    try {
      await api.delete(`/finance/staff-profiles/${data.employee_id}/`);
      toast.success(`Xodim profili o'chirildi!`);
      navigate(-1);
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Profilni o'chirishda xatolik yuz berdi");
    }
  };

  const handleDeleteHistory = async (historyId) => {
    if (!isSuperAdmin) return toast.error("Ruxsat yo'q");
    if (!window.confirm("Ushbu oy uchun hisoblangan maosh tarixini o'chirmoqchimisiz? (Eslatma: Xodim profili o'chmaydi, faqat shu oy ro'yxatdan o'chadi)")) return;
    try {
      await api.delete(`/finance/employee-payments/${historyId}/`);
      toast.success("Maosh tarixi o'chirildi");

      // Agar joriy ko'rilayotgan ID o'chirilgan bo'lsa, orqaga qaytish
      if (parseInt(historyId) === parseInt(staff_id)) {
        navigate(-1);
      } else {
        await fetchAllData();
      }
    } catch (error) {
      toast.error("Tarixni o'chirishda xatolik");
    }
  };

  const handleDeleteAdvance = async (advanceId) => {
    if (!isSuperAdmin) return toast.error("Ruxsat yo'q");
    if (!window.confirm("Avansni o'chirmoqchimisiz?")) return;
    try {
      await api.delete(`/finance/employee-advances/${advanceId}/`);
      toast.success("Avans o'chirildi");
      await fetchAllData();
    } catch (error) {
      toast.error("O'chirishda xatolik");
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


  return (
    <div className="min-h-screen bg-[var(--bg-void)] text-[var(--text-secondary)] font-sans selection:bg-[var(--gold)]/30 overflow-x-hidden">

      <StaffAdvanceModal
        isOpen={selectedHistoryItem === 'advance'}
        onClose={() => dispatch(setSelectedHistoryItem(null))}
        staffName={`${data.employee_first_name} ${data.employee_last_name}`}
        onConfirm={async (amount, description) => {
          try {
            await api.post(`/finance/employee-payments/${staff_id}/add-advance/`, {
              amount,
              description
            });
            toast.success("Avans muvaffaqiyatli qo'shildi!");
            dispatch(setSelectedHistoryItem(null));
            await fetchAllData();
          } catch (error) {
            toast.error(error.response?.data?.detail || "Avans qo'shishda xatolik");
          }
        }}
      />

      <StaffPaymentModal
        isOpen={payModal}
        onClose={() => { dispatch(setPayModal(false)); dispatch(setSelectedHistoryItem(null)); }}
        info={selectedHistoryItem || data}
        amount={
          selectedHistoryItem
            ? (selectedHistoryItem.salary_type === 'percentage' && !selectedHistoryItem.is_paid
              ? (selectedHistoryItem.calculated_commission || 0)
              : (selectedHistoryItem.total_amount || selectedHistoryItem.salary_base))
            : (!data.is_paid
              ? (liveBaseSalary - (data.total_advances || 0))
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
                  <div className="grid grid-cols-3 gap-2">
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
                    <button
                      type="button"
                      onClick={() => dispatch(updateEditForm({ salary_type: 'student_count' }))}
                      className={`py-2.5 px-3 rounded-xl transition-all ${editForm.salary_type === 'student_count' ? 'bg-[var(--gold)] text-black shadow-[0_0_15px_rgba(184,134,11,0.3)]' : 'bg-[var(--bg-panel)] text-[var(--text-muted)] border border-[var(--border-glass)]'}`}
                    >
                      <span className="text-[10px] font-black uppercase">Student</span>
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
                ) : editForm.salary_type === 'percentage' ? (
                  <div>
                    <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1 mb-1.5 block">Foiz (%)</label>
                    <input
                      type="number"
                      value={editForm.commission_percentage}
                      onChange={(e) => dispatch(updateEditForm({ commission_percentage: e.target.value }))}
                      className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-xl py-2.5 px-4 text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)]/50 transition-all font-bold text-sm shadow-inner"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1 mb-1.5 block">Har bir o'quvchi uchun (UZS)</label>
                    <AmountInput
                      value={editForm.per_student_amount}
                      onChange={(e) => dispatch(updateEditForm({ per_student_amount: e.target.value }))}
                      placeholder="0"
                      className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-xl py-2.5 px-4 text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)]/50 transition-all font-black text-sm shadow-inner italic"
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
                  {isPercentageType ? "Foiz asosida" : isStudentCountType ? "O'quvchi boshiga" : "Belgilangan maosh"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <ThemeToggle />
                {(isPercentageType || isStudentCountType) && !data.is_paid && (
                  <button
                    onClick={handleRecalculate}
                    disabled={recalculating}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white border border-emerald-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                    title="Qayta hisoblash"
                  >
                    {recalculating ? <Loader2 className="animate-spin" size={12} /> : <Calculator size={12} />}
                    <span className="hidden md:inline">Yangilash</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => isSuperAdmin ? dispatch(setEditModal(true)) : toast.error("Ruxsat yo'q")} className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[var(--bg-panel)] hover:bg-[var(--gold)]/10 border border-[var(--border-glass)] hover:border-[var(--gold)]/50 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all text-[var(--text-secondary)] hover:text-[var(--gold)]">
                  <Edit3 size={12} /> <span className="hidden md:inline">Tahrirlash</span>
                </button>

                {isSuperAdmin && (
                  <button
                    onClick={() => dispatch(setSelectedHistoryItem('advance'))}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-white border border-amber-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                  >
                    <Coins size={12} /> <span className="hidden md:inline">Avans</span>
                  </button>
                )}

                {isSuperAdmin && (
                  <button onClick={handleDelete} className="flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all" title="Butun profilni o'chirish">
                    <Trash2 size={12} /> <span className="hidden md:inline">Profilni O'chirish</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* LEFT SIDEBAR: COMPACT PROFILE & STATUS */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-[var(--bg-panel)] border border-[var(--border-glass)] p-5 rounded-2xl relative overflow-hidden text-center shadow-xl shadow-black/20">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--gold)] to-transparent opacity-50" />

              <div className="w-20 h-20 bg-gradient-to-br from-[var(--bg-void)] to-[var(--bg-panel)] border border-[var(--border-glass)] rounded-2xl mx-auto mb-4 flex items-center justify-center text-[var(--gold)] shadow-inner group-hover:scale-105 transition-transform">
                <User size={36} />
              </div>

              <h2 className="text-base font-black text-[var(--text-primary)] tracking-tight mb-1 uppercase italic">
                {data.employee_first_name} {data.employee_last_name}
              </h2>
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.2em] mb-4">
                {data.employee_role}
              </p>

              <div className="space-y-2 pt-4 border-t border-[var(--border-glass)]">
                <div className="flex justify-between items-center px-1">
                  <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${data.is_paid ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>
                    {data.is_paid ? "To'langan" : "Kutilmoqda"}
                  </span>
                  <span className="px-3 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] font-black uppercase tracking-widest">
                    ID: #{data.employee_id}
                  </span>
                </div>
              </div>
            </div>

            {/* QUICK STATS IN LIST FORM */}
            <div className="bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-2xl overflow-hidden shadow-lg p-4 space-y-4">
              <div className="pb-3 border-b border-[var(--border-glass)]">
                <h4 className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-3">Tizim malumotlari</h4>
                <div className="space-y-3">
                  <InfoItem icon={<MapPin size={12} />} label="Filial" value={`${data.employee_branch}-filial`} />
                  <InfoItem icon={<CreditCard size={12} />} label="Karta" value={data.karta || "Yo'q"} color={data.karta ? "text-[var(--gold)]" : ""} />
                  <InfoItem icon={<Calendar size={12} />} label="Davr" value={data.month} />
                </div>
              </div>

              <div>
                <h4 className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-3">Maosh Sharti</h4>
                <div className="p-3 rounded-xl bg-[var(--bg-void)]/40 border border-[var(--border-glass)]">
                  <p className="text-[11px] font-black text-[var(--text-primary)] tabular-nums mb-1">
                    {isPercentageType
                      ? `${data.commission_percentage}% (KPI)`
                      : isStudentCountType
                        ? `${formatCurrency(data.per_student_amount || 0)}/st`
                        : formatCurrency(data.salary_base)}
                  </p>
                  <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">
                    {isPercentageType ? "Aylanmadan ulush" : isStudentCountType ? "O'quvchi boshiga" : "Fiksiyalangan miqdor"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT CONTENT:主 SUMMARY & TABLES */}
          <div className="lg:col-span-9 space-y-4">
            <div className={`grid gap-4 ${isPercentageType || isStudentCountType ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-1 md:grid-cols-3'}`}>

              {/* 1. ASOSIY MAOSH KARTASI */}
              {isPercentageType ? (
                <div className="p-4 rounded-2xl bg-[var(--bg-panel)] border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                    <Receipt size={12} /> KPI Maosh
                  </p>
                  <h3 className="text-xl font-black text-[var(--text-primary)] tabular-nums mb-1">
                    {formatCurrency(data.calculated_commission || 0)}
                  </h3>
                  <div className="flex items-center justify-between">
                    <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest italic">Hisoblandi</p>
                    <p className="text-[8px] font-bold text-emerald-500 uppercase tabular-nums">{formatCurrency(data.groups_income)} tushum</p>
                  </div>
                </div>
              ) : isStudentCountType ? (
                <div className="p-4 rounded-2xl bg-[var(--bg-panel)] border border-blue-500/20 shadow-lg shadow-blue-500/5">
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                    <Users size={12} /> KPI Maosh
                  </p>
                  <h3 className="text-xl font-black text-[var(--text-primary)] tabular-nums mb-1">
                    {formatCurrency(data.calculated_per_student || data.salary_base || 0)}
                  </h3>
                  <div className="flex items-center justify-between">
                    <p className="text-[8px] font-bold text-blue-400/60 uppercase tracking-widest italic">{studentCountSummary.paidStudents} / {studentCountSummary.totalStudents} st.</p>
                    <p className="text-[8px] font-black text-blue-500 uppercase tabular-nums">-{formatCurrency(studentCountSummary.mentorShareExpected)} max</p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-glass)] shadow-lg">
                  <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1.5">
                    Asosiy Maosh
                  </p>
                  <h3 className="text-xl font-black text-[var(--text-primary)] tabular-nums">
                    {formatCurrency(data.salary_base)}
                  </h3>
                </div>
              )}

              {/* 2. POTENTIAL REVENUE (Faqat student_count bo'lsa) */}
              {isStudentCountType ? (
                <div className="p-4 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-glass)] shadow-lg">
                  <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1.5 flex items-center gap-2">
                    <TrendingUp size={12} className="text-amber-500" /> Tahminiy Tushum
                  </p>
                  <h3 className="text-xl font-black text-amber-500 tabular-nums mb-1">
                    {formatCurrency(studentCountSummary.expectedIncome)}
                  </h3>
                  <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest italic">Real: {formatCurrency(studentCountSummary.paidIncome)}</p>
                </div>
              ) : (
                (data.bonus > 0 || data.deductions > 0) && (
                  <div className="p-4 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-glass)]">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Qo'shimcha</p>
                      <div className="flex gap-1">
                        <PlusCircle size={10} className="text-emerald-500" />
                        <MinusCircle size={10} className="text-rose-500" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {data.bonus > 0 && <span className="text-emerald-500 text-[11px] font-black">+{formatCurrency(data.bonus)}</span>}
                      {data.deductions > 0 && <span className="text-rose-500 text-[11px] font-black">-{formatCurrency(data.deductions)}</span>}
                    </div>
                  </div>
                )
              )}

              {/* 3. AVANS KARTASI */}
              {data.total_advances > 0 ? (
                <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10 shadow-lg shadow-rose-900/5">
                  <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1.5">
                    Avanslar
                  </p>
                  <h3 className="text-xl font-black text-rose-400 tabular-nums">
                    -{formatCurrency(data.total_advances)}
                  </h3>
                </div>
              ) : (
                isStudentCountType && (data.bonus > 0 || data.deductions > 0) ? (
                  <div className="p-4 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-glass)]">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Qo'shimcha</p>
                      <div className="flex gap-1">
                        <PlusCircle size={10} className="text-emerald-500" />
                        <MinusCircle size={10} className="text-rose-500" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {data.bonus > 0 && <span className="text-emerald-500 text-[11px] font-black">+{formatCurrency(data.bonus)}</span>}
                      {data.deductions > 0 && <span className="text-rose-500 text-[11px] font-black">-{formatCurrency(data.deductions)}</span>}
                    </div>
                  </div>
                ) : <div className="hidden md:block" />
              )}

              {/* 4. YAKUNIY TO'LOV */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-[var(--gold)]/20 to-[var(--bg-panel)] border-2 border-[var(--gold)]/30 shadow-2xl shadow-[var(--gold)]/10 flex flex-col justify-center">
                <div className="text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.2em] mb-1 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] animate-pulse shadow-[0_0_8px_var(--gold)]" />
                  Yakuniy To'lov
                </div>
                <h3 className="text-2xl font-black text-[var(--text-primary)] tabular-nums tracking-tighter italic">
                  {formatCurrency(finalTotalAmount)}
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-2xl overflow-hidden shadow-lg">
                <div className="px-5 py-3 border-b border-[var(--border-glass)] flex items-center justify-between bg-[var(--bg-void)]/30">
                  <div className="flex items-center gap-2">
                    <History size={14} className="text-[var(--gold)]" />
                    <span className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-widest">To'lov Tarixi</span>
                  </div>
                </div>

                <div className="max-h-[220px] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left">
                    <tbody className="divide-y divide-[var(--border-glass)]">
                      {data.payment_history?.map((item) => (
                        <tr key={item.id} className={`hover:bg-[var(--gold-dim)] transition-colors ${parseInt(staff_id) === item.id ? 'bg-[var(--gold)]/5' : ''}`}>
                          <td className="px-5 py-3">
                            <p className="text-[10px] font-black text-[var(--text-primary)]">{item.month}</p>
                            <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase italic">{item.is_paid ? "To'langan" : "Kutilmoqda"}</p>
                          </td>
                          <td className="px-5 py-3 text-[11px] font-black text-[var(--text-primary)] tabular-nums text-right flex items-center justify-end gap-3">
                            <span>{formatCurrency(item.total_amount || item.amount || item.salary_base)}</span>
                            {isSuperAdmin && (
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteHistory(item.id); }} className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                                <Trash2 size={12} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-2xl overflow-hidden shadow-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Bookmark size={14} className="text-[var(--gold)]" />
                    <span className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-widest">Hisob Tafsiloti</span>
                  </div>
                  {isSuperAdmin && data.id && (
                    <button onClick={() => handleDeleteHistory(data.id)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg translate-x-2" title="Joriy oyni o'chirish">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>

                <div className="space-y-3 mb-6">
                  <DetailRow label="Hisoblangan oy" value={data.month} />
                  <DetailRow label="Tasdiqlangan sana" value={data.paid_at ? new Date(data.paid_at).toLocaleDateString() : "---"} />
                  <DetailRow label="Tasdiqlovchi" value={data.marked_by || "---"} />
                </div>

                {!data.is_paid ? (
                  <button onClick={() => dispatch(setPayModal(true))} className="w-full py-3.5 rounded-xl bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-black font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_10px_30px_rgba(184,134,11,0.2)] transition-all active:scale-[0.98]">
                    To'lovni tasdiqlash
                  </button>
                ) : (
                  <div className="w-full py-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
                    <CheckCircle size={14} /> To'lov yakunlangan
                  </div>
                )}
              </div>
            </div>

            {/* KPI TAFSILOTLARI (Faqat foizli mentorlar uchun) */}
            {isPercentageType && data.mentor_groups && data.mentor_groups.length > 0 && (
              <div className="bg-[var(--bg-panel)] border border-emerald-500/10 rounded-2xl overflow-hidden shadow-xl">
                <div className="px-5 py-4 border-b border-[var(--border-glass)] flex items-center justify-between bg-emerald-500/5">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Users size={16} />
                    <span className="text-[11px] font-black uppercase tracking-widest italic">Guruhlar tahlili</span>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">
                      Real Tushum: {formatCurrency(data.groups_income)}
                    </span>
                  </div>
                </div>
                <div className="p-2 overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[var(--border-glass)]">
                        <th className="px-4 py-3 text-[8px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em]">Guruh</th>
                        <th className="px-4 py-3 text-[8px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] text-center">Talaba</th>
                        <th className="px-4 py-3 text-[8px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] text-right">Sof Tushum</th>
                        <th className="px-4 py-3 text-[8px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] text-right text-emerald-400">Ulushingiz</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-glass)]">
                      {data.mentor_groups.map((group) => (
                        <tr key={group.id} className="hover:bg-emerald-500/[0.02] transition-colors group">
                          <td className="px-4 py-3.5">
                            <p className="text-[10px] font-black text-[var(--text-primary)] leading-tight uppercase italic">{group.name}</p>
                            <p className="text-[8px] text-[var(--text-muted)] font-black uppercase tracking-widest opacity-60 group-hover:opacity-100">{group.branch_name || "Asosiy"}</p>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className="text-[10px] font-black">{group.students_count}</span>
                          </td>
                          <td className="px-4 py-3.5 text-right font-black text-[10px] text-[var(--text-secondary)] tabular-nums">
                            {formatCurrency(group.real_income || group.monthly_income)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-black text-[10px] text-emerald-400 tabular-nums">
                            {formatCurrency((group.real_income || group.monthly_income) * (data.commission_percentage / 100))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {isStudentCountType && data.mentor_groups && data.mentor_groups.length > 0 && (
              <div className="bg-[var(--bg-panel)] border border-blue-500/10 rounded-2xl overflow-hidden shadow-xl">
                <div className="px-5 py-4 border-b border-[var(--border-glass)] flex items-center justify-between bg-blue-500/5">
                  <div className="flex items-center gap-2 text-blue-400">
                    <Users size={16} />
                    <span className="text-[11px] font-black uppercase tracking-widest italic">O'quvchilar tahlili</span>
                  </div>
                </div>
                <div className="p-2 overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[var(--border-glass)]">
                        <th className="px-4 py-3 text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">Guruh & Narx</th>
                        <th className="px-4 py-3 text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest text-center">To'lov / Jami</th>
                        <th className="px-4 py-3 text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest text-right">Tushum (Real/Max)</th>
                        <th className="px-4 py-3 text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest text-right text-blue-400">Mentor ulushi</th>
                        <th className="px-4 py-3 text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest text-center">Qarzdorlar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-glass)]">
                      {data.mentor_groups.map((group) => (
                        <tr key={group.id} className="hover:bg-blue-500/[0.02] transition-colors group">
                          <td className="px-4 py-3.5">
                            <p className="text-[10px] font-black text-[var(--text-primary)] leading-tight uppercase italic">{group.name}</p>
                            <p className="text-[8px] text-blue-400 font-black uppercase tracking-widest">{formatCurrency(group.monthly_price)}</p>
                          </td>
                          <td className="px-4 py-3.5 text-center font-black text-[10px] text-[var(--text-primary)] tabular-nums">
                            {group.paid_students_count || 0} / {group.students_count || 0}
                          </td>
                          <td className="px-4 py-3.5 text-right font-black text-[10px] tabular-nums whitespace-nowrap">
                            <span className="text-emerald-500">{formatCurrency(group.monthly_income)}</span>
                            <span className="text-[var(--text-muted)] mx-1">/</span>
                            <span className="text-[var(--text-muted)]">{formatCurrency(group.expected_income)}</span>
                          </td>
                          <td className="px-4 py-3.5 text-right font-black text-[10px] text-blue-400 tabular-nums">
                            {formatCurrency(group.mentor_share_paid || 0)}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {group.unpaid_students && group.unpaid_students.length > 0 ? (
                              <button
                                onClick={() => setSelectedGroupForDebtors(group)}
                                className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/20 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 mx-auto shadow-sm"
                              >
                                <Users size={10} />
                                Qarzdorlar ({group.unpaid_students.length})
                              </button>
                            ) : (
                              <span className="text-[8px] font-black text-emerald-500 uppercase flex items-center justify-center gap-1">
                                <CheckCircle2 size={10} /> To'liq
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* AVANSLAR TARIXI (FAQAT BO'LSA) */}
            {data.advances_history && data.advances_history.length > 0 && (
              <div className="bg-[var(--bg-panel)] border border-rose-500/10 rounded-2xl overflow-hidden shadow-xl">
                <div className="px-5 py-3 border-b border-[var(--border-glass)] flex items-center gap-2 bg-rose-500/5">
                  <Coins size={14} className="text-rose-400" />
                  <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Berilgan Avanslar</span>
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                  <table className="w-full text-left">
                    <tbody className="divide-y divide-[var(--border-glass)]">
                      {data.advances_history.map((adv) => (
                        <tr key={adv.id} className="hover:bg-rose-500/5 transition-colors group">
                          <td className="px-5 py-3">
                            <p className="text-[10px] font-black text-[var(--text-secondary)]">{new Date(adv.date).toLocaleDateString()}</p>
                            <p className="text-[8px] text-[var(--text-muted)] font-bold truncate max-w-[250px] italic">{adv.description || "Izohsiz"}</p>
                          </td>
                          <td className="px-5 py-3 text-[11px] font-black text-rose-400 tabular-nums text-right flex items-center justify-end gap-3">
                            <span>-{formatCurrency(adv.amount)}</span>
                            {isSuperAdmin && (
                              <button onClick={() => handleDeleteAdvance(adv.id)} className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                                <XCircle size={10} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {selectedGroupForDebtors && createPortal(
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-[2.5rem] w-full max-w-lg max-h-[85vh] overflow-hidden shadow-[0_0_50px_rgba(244,63,94,0.15)] flex flex-col">
            <div className="p-6 border-b border-[var(--border-glass)] flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight italic">Qarzdorlar Ro'yxati</h4>
                <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mt-1">Guruh: {selectedGroupForDebtors.name}</p>
              </div>
              <button
                onClick={() => setSelectedGroupForDebtors(null)}
                className="p-2 hover:bg-rose-500/10 text-[var(--text-muted)] hover:text-rose-500 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {selectedGroupForDebtors.unpaid_students.map((st) => (
                <div key={st.id} className="p-4 bg-[var(--bg-void)]/40 border border-[var(--border-glass)] rounded-2xl flex items-center justify-between hover:border-rose-500/30 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-500 font-black text-xs">
                      {st.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-black text-[var(--text-primary)] uppercase italic leading-none">{st.name}</p>
                      <p className="text-[8px] font-bold text-rose-400/60 uppercase tracking-widest mt-1.5">{st.status}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-rose-400 tabular-nums">{formatCurrency(st.expected)}</p>
                    <p className="text-[7px] font-black text-[var(--text-muted)] uppercase tracking-widest opacity-50">Kutilayotgan to'lov</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-6 bg-rose-500/5 border-t border-[var(--border-glass)]">
              <div className="flex justify-between items-center text-xs font-black uppercase italic">
                <span className="text-rose-400">Jami qarz:</span>
                <span className="text-[var(--text-primary)]">{formatCurrency(selectedGroupForDebtors.unpaid_students.reduce((acc, s) => acc + s.expected, 0))}</span>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
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