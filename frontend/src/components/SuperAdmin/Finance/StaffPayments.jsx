import React, { useEffect } from "react";
import {
  UserPlus, Search, ShieldCheck, GraduationCap, Mail, Phone,
  ChevronRight, ArrowLeft, Zap, RefreshCw, Target, Award,
  TrendingUp, Users, ShieldAlert, Circle, Activity, Loader2, Sparkles, Undo2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import {
  setActiveBranch, setActiveTab, setAddStaffModal,
  setBranches, setStaffData, setStaffSearchQuery,
  setStaffRefreshing, setStaffLoading, setRefundProcessing
} from "../../../store/slices/financeSlice";
import api from "../../../tokenUpdater/updater";
import StaffProfileForm from "./StaffProfileForm";
import toast from "react-hot-toast";

const StaffManagementPro = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const {
    activeBranch,
    activeTab,
    addStaffModal,
    branches,
    staffData,
    staffSearchQuery,
    staffRefreshing,
    staffLoading,
    refundProcessing
  } = useSelector((state) => state.finance);

  const fetchBranch = async () => {
    try {
      const res = await api.get(`/add_branch/branches/`);
      dispatch(setBranches(res.data));
      // Agar activeBranch tanlanmagan bo'lsa va filiallar bo'lsa, birinchisini tanlash
      if (!activeBranch && res.data.length > 0) {
        dispatch(setActiveBranch(res.data[0].id));
      }
    } catch (err) {
      toast.error("Filial ma'lumotlarini yuklashda xatolik.");
    }
  };

  const fetchStaffData = async () => {
    if (!activeBranch) return;
    dispatch(setStaffLoading(true));
    try {
      let url;
      if (activeTab === "admin") {
        url = `/finance/staff-profiles/?user__role=admin&user__branch=${Number(activeBranch)}`;
      } else if (activeTab === "mentor") {
        url = `/finance/staff-profiles/?user__role=mentor&user__branch=${Number(activeBranch)}`;
      }
      const res = await api.get(url);
      dispatch(setStaffData(res.data));
    } catch (err) {
      toast.error("Xodimlar ma'lumotlarini yuklashda xatolik.");
    } finally {
      dispatch(setStaffLoading(false));
    }
  };

  useEffect(() => {
    fetchStaffData();
  }, [activeTab, activeBranch]);

  useEffect(() => {
    fetchBranch();
  }, []);

  const handleRefreshPayments = async () => {
    dispatch(setStaffRefreshing(true));
    try {
      const response = await api.post('/finance/generate/');
      if (response.data.success) {
        toast.success("Oylik to'lovlar yangilandi.");
        await fetchStaffData();
      }
    } catch (error) {
      toast.error("Yangilashda xatolik yuz berdi.");
    } finally {
      dispatch(setStaffRefreshing(false));
    }
  };

  const handleProcessRefunds = async () => {
    if (!window.confirm("O'quvchilarning qolib ketgan darslari uchun refundlarni hisoblab chiqishni tasdiqlaysizmi?")) return;

    dispatch(setRefundProcessing(true));
    try {
      const response = await api.post('/finance/absence-refunds/');
      const { count, total_amount } = response.data;
      toast.success(`${count} ta refund (${total_amount} UZS) muvaffaqiyatli hisoblandi.`);
      await fetchStaffData();
    } catch (error) {
      console.error("Refund error:", error);
      toast.error("Refundlarni hisoblashda xatolik yuz berdi.");
    } finally {
      dispatch(setRefundProcessing(false));
    }
  };

  const filteredStaffData = staffData.filter((person) => {
    const searchLower = staffSearchQuery.toLowerCase().trim();
    if (!searchLower) return true;
    const fullName = (person.full_name || person.username || '').toLowerCase();
    return fullName.includes(searchLower);
  });

  return (
    <div className="space-y-10 pb-20">
      {/* Atmosphere Background */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-[var(--gold)]/5 rounded-full blur-[140px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-indigo-500/[0.04] rounded-full blur-[120px]"></div>
      </div>

      {addStaffModal && (
        <StaffProfileForm
          role={activeTab}
          branch={Number(activeBranch)}
          isOpen={addStaffModal}
          onClose={() => dispatch(setAddStaffModal(false))}
          onSuccess={fetchStaffData}
        />
      )}

      {/* HEADER & BRANCH NAVIGATION */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-8 pb-6 border-b border-[var(--border-glass)]">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate(-1)} className="p-3 bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-xl text-[var(--gold)] hover:scale-110 transition-all"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="text-2xl sm:text-4xl font-black text-[var(--text-primary)] tracking-tighter uppercase mb-2 italic">Xodimlar Boshqaruvi</h1>
            <p className="text-[8px] sm:text-[10px] text-[var(--text-muted)] font-black uppercase tracking-[0.2em] sm:tracking-[0.4em] flex items-center gap-2 sm:gap-3">
              <ShieldCheck size={10} className="text-[var(--gold)] sm:w-3 sm:h-3" /> Strategik Delegatsiya va Maosh Tizimi
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 p-1.5 bg-black/40 border border-[var(--border-glass)] rounded-2xl shadow-inner max-w-2xl">
          {branches.map((b) => (
            <button
              key={b.id}
              onClick={() => {
                dispatch(setActiveBranch(b.id));
              }}
              className={`px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-xl text-[8px] sm:text-[10px] font-black uppercase tracking-widest transition-all ${activeBranch == b.id
                ? "bg-[var(--gold)] text-black shadow-[var(--gold-glow)]"
                : "text-[var(--text-muted)] hover:bg-white/5 hover:text-white"
                }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* LEFT: CATEGORY SELECTOR */}
        <div className="lg:col-span-3 space-y-6">
          <div className="lux-card !p-3 sm:!p-4 !rounded-2xl">
            <p className="text-[8px] sm:text-[9px] font-black text-[var(--text-muted)] uppercase tracking-[0.4em] px-3 mb-4 sm:mb-5 flex items-center gap-2 sm:gap-3">
              <Circle size={4} className="fill-[var(--gold)]" /> Xodimlar
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 sm:gap-1.5">
              <CategoryBtn
                active={activeTab === "admin"}
                onClick={() => dispatch(setActiveTab("admin"))}
                icon={<ShieldCheck size={16} />}
                label="Admin"
                shortLabel="Admin"
                count={staffData.filter(s => s.employee_role === 'admin').length || 0}
              />
              <CategoryBtn
                active={activeTab === "mentor"}
                onClick={() => dispatch(setActiveTab("mentor"))}
                icon={<GraduationCap size={16} />}
                label="Mentorlar"
                shortLabel="Mentor"
                count={staffData.filter(s => s.employee_role === 'mentor').length || 0}
              />
            </div>
          </div>

          <div className="lux-card !p-6 !bg-gradient-to-br !from-[var(--gold-dim)] !to-transparent border-dashed border-[var(--gold)]/20">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles size={16} className="text-[var(--gold)]" />
              <h4 className="text-[10px] font-black text-white uppercase tracking-widest italic">Yangi Xodim</h4>
            </div>
            <p className="text-[9px] text-[var(--text-muted)] font-bold uppercase leading-relaxed mb-6">Yangi xodimni ro'yxatdan o'tkazish.</p>
            <button
              onClick={() => dispatch(setAddStaffModal(true))}
              className="lux-btn lux-btn-primary !w-full !rounded-xl !h-10 sm:!h-12 text-[9px] sm:text-[10px]"
            >
              <UserPlus size={14} className="mr-2 sm:w-4 sm:h-4" /> QO'SHISH
            </button>
          </div>
        </div>

        {/* RIGHT: SEARCH & STAFF LIST */}
        <div className="lg:col-span-9 space-y-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 group">
              <Search className="absolute left-5 sm:left-6 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--gold)] transition-colors sm:w-5 sm:h-5 w-4 h-4" />
              <input
                type="text"
                value={staffSearchQuery}
                onChange={(e) => dispatch(setStaffSearchQuery(e.target.value))}
                placeholder="QIDIRISH..."
                className="w-full bg-black/40 border border-[var(--border-glass)] hover:border-[var(--gold)]/30 focus:border-[var(--gold)]/50 rounded-2xl py-3.5 sm:py-5 pl-12 sm:pl-16 pr-6 text-white placeholder:text-white/5 outline-none transition-all text-xs sm:text-sm font-bold uppercase tracking-widest shadow-inner"
              />
            </div>

            <button
              onClick={handleRefreshPayments}
              disabled={staffRefreshing}
              className="px-6 sm:px-8 py-3.5 sm:py-0 flex items-center justify-center gap-3 sm:gap-4 bg-[var(--bg-panel)]/40 border border-[var(--border-glass)] hover:border-[var(--gold)]/30 rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw size={16} className={staffRefreshing ? "animate-spin" : "text-[var(--gold)] sm:w-4 sm:h-4"} />
              <span>{staffRefreshing ? "..." : "Oylik Ochish"}</span>
            </button>

            <button
              onClick={handleProcessRefunds}
              disabled={refundProcessing}
              className="px-6 sm:px-8 py-3.5 sm:py-0 flex items-center justify-center gap-3 sm:gap-4 bg-rose-500/10 border border-rose-500/20 hover:border-rose-500/50 rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 text-rose-500 group"
            >
              <Undo2 size={16} className={refundProcessing ? "animate-spin" : "group-hover:-rotate-45 transition-transform sm:w-4 sm:h-4"} />
              <span>{refundProcessing ? "..." : "Refundlar"}</span>
            </button>
          </div>

          <div className="space-y-4">
            {staffLoading ? (
              <div className="lux-card !py-20 text-center opacity-40">
                <Loader2 size={48} className="mx-auto mb-6 text-[var(--gold)] animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-[0.4em]">Yuklanmoqda...</p>
              </div>
            ) : filteredStaffData.length > 0 ? (
              filteredStaffData.map((person) => (
                <div
                  onClick={() => {
                    if (person.current_payment_id) {
                      navigate(`staff/${person.current_payment_id}`);
                    } else {
                      toast.error("Ushbu oy uchun maosh hisoblanmagan. 'Oylik Ochish' tugmasini bosing.");
                    }
                  }}
                  key={person.id}
                  className="lux-card !p-4 group/row cursor-pointer hover:border-[var(--gold)]/40 transition-all flex flex-col md:flex-row items-center justify-between gap-6"
                >
                  <div className="flex items-center gap-4 sm:gap-5 w-full md:w-auto">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--gold)] shadow-inner group-hover/row:scale-110 transition-transform duration-500 shrink-0">
                      <span className="text-xs sm:text-sm font-black italic uppercase">
                        {person.full_name?.charAt(0) || person.username?.charAt(0)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-base sm:text-lg font-black text-white uppercase tracking-tight group-hover/row:text-[var(--gold)] transition-colors italic truncate">
                        {person.full_name || person.username}
                      </h4>
                      <div className="flex items-center gap-2 sm:gap-3 mt-1 sm:mt-1.5">
                        <div className={`w-1 h-1 sm:w-1.5 sm:h-1.5 ${person.current_payment_id ? 'bg-emerald-500' : 'bg-rose-500'} rounded-full animate-pulse`} />
                        <span className="text-[7px] sm:text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                          {person.current_payment_id ? "Hisob-kitob mavjud" : "Hisoblanmagan"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 sm:gap-8 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-[var(--border-glass)] pt-3 sm:pt-4 md:pt-0">
                    <div className="hidden sm:block text-right">
                      <p className="text-[7px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1.5 italic">Maosh Turi / Karta</p>
                      <p className="text-[10px] sm:text-xs font-black text-white uppercase tracking-tighter">
                        {person.salary_display || person.salary_type} {person.karta ? `(${person.karta})` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <ActionBtn icon={<Mail size={12} className="sm:w-3.5 sm:h-3.5" />} />
                      <ActionBtn icon={<Phone size={12} className="sm:w-3.5 sm:h-3.5" />} />
                      <div className="w-px h-5 sm:h-6 bg-[var(--border-glass)] mx-1 sm:mx-2" />
                      <div className="p-2 sm:p-2.5 bg-[var(--gold-dim)] rounded-xl text-[var(--gold)] group-hover/row:bg-[var(--gold)] group-hover/row:text-black transition-all">
                        <ChevronRight size={16} className="sm:w-4.5 sm:h-4.5" />
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="lux-card !py-20 text-center opacity-40 italic">
                <ShieldAlert size={48} className="mx-auto mb-6 text-[var(--text-muted)]" />
                <p className="text-[10px] font-black uppercase tracking-[0.4em]">Ma'lumot topilmadi.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const CategoryBtn = ({ active, onClick, icon, label, shortLabel, count }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between p-2.5 sm:p-4 rounded-xl transition-all border ${active
      ? "bg-[var(--gold)] text-black border-transparent shadow-[var(--gold-glow)]"
      : "bg-transparent text-[var(--text-muted)] border-transparent hover:bg-white/5 hover:text-white"
      }`}
  >
    <div className="flex items-center gap-2 sm:gap-4">
      <div className={`${active ? "text-black" : "text-[var(--gold)]"} shrink-0`}>
        {React.cloneElement(icon, { size: 16, className: "sm:w-4 sm:h-4 w-3.5 h-3.5" })}
      </div>
      <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] whitespace-nowrap">
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">{shortLabel}</span>
      </span>
    </div>
    <div className={`px-1.5 sm:px-2 py-0.5 rounded-lg text-[8px] sm:text-[9px] font-black shrink-0 ${active ? "bg-black/10" : "bg-[var(--gold-dim)] text-[var(--gold)]"}`}>
      {count}
    </div>
  </button>
);

const ActionBtn = ({ icon }) => (
  <button onClick={(e) => e.stopPropagation()} className="p-2 sm:p-2.5 bg-black/40 border border-[var(--border-glass)] rounded-xl text-[var(--text-muted)] hover:text-[var(--gold)] hover:border-[var(--gold)]/30 transition-all shadow-inner shrink-0">
    {icon}
  </button>
);

export default StaffManagementPro;