import { useState, useEffect } from 'react';
import {
  Users, UserCircle, GraduationCap, TrendingUp,
  DollarSign, CheckCircle, Clock, ArrowUpRight,
  Wallet, Activity, Target, Award, Building2,
  ChevronRight, ArrowLeft, ShieldCheck, Zap, Layers,
  CalendarDays
} from 'lucide-react';
import GoBackButton from '../../sendback';
import { useParams } from 'react-router-dom';
import api from '../../../tokenUpdater/updater';
import toast from 'react-hot-toast';

export default function BranchFinance() {
  const { b_id } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchBranchFinance();
  }, [b_id]);

  const fetchBranchFinance = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/finance/statistics/branch-finance/${b_id}/`);
      setData(response.data);
      setError(null);
    } catch (err) {
      setError("Xatolik: Tizimga ulanishda muammo yuz berdi.");
      toast.error("Ma'lumotlarni yuklashda xatolik.");
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (!num) return '0';
    return Math.floor(num).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <Loader2 className="animate-spin text-[var(--gold)] mb-6" size={48} />
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[var(--text-muted)] italic">Yuklanmoqda...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <ShieldCheck size={48} className="text-red-500/40 mb-6" />
        <p className="text-sm font-black text-red-400 uppercase tracking-widest italic mb-6">{error}</p>
        <button
          onClick={fetchBranchFinance}
          className="lux-btn lux-btn-primary !px-10"
        >
          Qayta urinish
        </button>
      </div>
    );
  }

  if (!data) return null;

  const stats = data.stats;
  const finance = data.finance;
  const branch = data.branch;

  const progressPercentage = finance.expected_income > 0
    ? ((finance.received_income / finance.expected_income) * 100).toFixed(1)
    : 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Background removed as per request */}

      {/* HEADER ACTION AREA */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-[var(--border-glass)]">
        <div className="flex items-center gap-6">
          <GoBackButton />
          <div>
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight uppercase italic">Filial Ko'rsatkichlari</h1>
              <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase flex items-center gap-2">
                <Building2 size={10} className="text-[var(--gold)]" /> <span className="text-[var(--text-primary)]">{branch.name}</span>
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-[var(--bg-void)]/40 border border-[var(--border-glass)] rounded">
          <span className="text-[9px] font-bold text-[var(--text-primary)] uppercase tracking-widest italic">Jonli Tahlil</span>
        </div>
      </div>

      {/* STATS MATRIX */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <BranchStatCard nom="Mentorlar" label="O'qituvchilar" value={stats.mentors} icon={<Users size={18} />} color="text-[var(--gold)]" />
        <BranchStatCard nom="Adminlar" label="Administratorlar" value={stats.admins} icon={<UserCircle size={18} />} color="text-emerald-400" />
        <BranchStatCard nom="Guruhlar" label="Guruhlar" value={stats.groups} icon={<Layers size={18} />} color="text-amber-400" />
        <BranchStatCard nom="O'quvchilar" label="O'quvchilar Soni" value={stats.students} icon={<GraduationCap size={18} />} color="text-[var(--text-primary)]" />
      </div>

      {/* CORE FINANCIAL INTELLIGENCE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* TARGET PROJECTION */}
        <div className="lg:col-span-5 lux-card !p-4 min-h-0 flex flex-col justify-between">

          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--bg-void)]/40 border border-[var(--gold)]/30 rounded-lg flex items-center justify-center text-[var(--gold)]">
                <Target size={20} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide italic">Kutilayotgan Tushum</h3>
              </div>
            </div>

            <div>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-2xl font-bold text-[var(--text-primary)] tracking-tight uppercase italic">{formatNumber(finance.expected_income)}</span>
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">UZS</span>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <span className="text-[9px] font-bold text-[var(--text-primary)] uppercase">Yig'im Tezligi</span>
                  <span className="text-xl font-bold text-[var(--gold)] italic">{progressPercentage}%</span>
                </div>
                <div className="h-1.5 w-full bg-[var(--bg-void)]/40 rounded-full overflow-hidden border border-[var(--border-glass)]">
                  <div
                    className="h-full bg-[var(--gold)] opacity-80"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MiniIndicator label="Tasdiqlangan" value={formatNumber(finance.received_income)} icon={<CheckCircle size={12} />} color="text-emerald-400" />
              <MiniIndicator label="Kutilmoqda" value={formatNumber(finance.debt)} icon={<Clock size={12} />} color="text-orange-400" />
            </div>
          </div>
        </div>

        {/* REVENUE BREAKDOWN */}
        <div className="lg:col-span-7 space-y-4 flex flex-col justify-between">
          <div className="lux-card !bg-[var(--bg-void)]/20 flex-1 flex flex-col justify-center relative">

            <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-8 items-center p-2">
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2 text-emerald-400">
                    <DollarSign size={16} className="opacity-40" />
                    <h4 className="text-[9px] font-bold uppercase tracking-widest">Haqiqiy Tushum</h4>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-[var(--text-primary)] tracking-tight uppercase italic">{formatNumber(finance.real_revenue || finance.received_income)}</span>
                    <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase">UZS</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2 bg-rose-500/10 rounded-lg border border-rose-500/20">
                    <p className="text-[7px] font-bold text-rose-400 uppercase tracking-widest mb-1 italic">Refundlar</p>
                    <p className="text-xs font-bold text-rose-400 tabular-nums italic">-{formatNumber(finance.refunds)}</p>
                  </div>
                  <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    <p className="text-[7px] font-bold text-emerald-400 uppercase tracking-widest mb-1 italic">Brutto Tushum</p>
                    <p className="text-xs font-bold text-emerald-400 tabular-nums italic">{formatNumber(finance.received_income)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-bold border border-emerald-500/20">
                    <TrendingUp size={10} /> {progressPercentage}% Natija
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="p-4 bg-[var(--bg-void)]/60 rounded-xl border border-[var(--border-glass)]">
                  <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase mb-1">Chiqimlar</p>
                  <p className="text-base font-bold text-[var(--text-primary)] tracking-tight uppercase italic">{formatNumber(finance.expenses)} <span className="text-[9px] not-italic opacity-30">UZS</span></p>
                </div>
                <div className="p-4 bg-[var(--bg-void)]/60 rounded-xl border border-[var(--border-glass)]">
                  <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase mb-1">Sof Foyda</p>
                  <p className="text-lg font-bold text-[var(--gold)] tracking-tight uppercase italic">{formatNumber(finance.net_profit)} <span className="text-[9px] not-italic opacity-30">UZS</span></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* UNIT BREAKDOWN */}
      {data.groups && data.groups.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-end justify-between border-b border-[var(--border-glass)] pb-3">
            <h3 className="text-lg font-bold text-[var(--text-primary)] uppercase tracking-tight italic">Guruhlar Tahlili</h3>
            <div className="flex items-center gap-2 text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">
              <span className="text-[var(--text-primary)]">{data.groups.length}</span> Ta Guruh Mavjud
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {data.groups.map((group) => {
              const groupProgress = group.expected_income > 0
                ? ((group.received_income / group.expected_income) * 100).toFixed(1)
                : 0;

              return (
                <div key={group.id} className="lux-card !p-4 hover:border-[var(--gold)]/30">
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-4 w-full lg:w-60">
                      <div className="w-10 h-10 rounded-lg bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--gold)]">
                        <Layers size={20} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-tight group-hover/unit:text-[var(--gold)] truncate italic">{group.name}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <UserCircle size={10} className="text-[var(--text-muted)] opacity-50" />
                          <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase truncate">Mentor: {group.mentor}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 flex-1 w-full">
                      <UnitMetric label="A'zolar" value={group.student_count} icon={<Users size={10} />} />
                      <UnitMetric label="Narx" value={formatNumber(group.monthly_price)} icon={<DollarSign size={10} />} />
                      <UnitMetric label="Kunlik" value={`${formatNumber(group.daily_price)}`} icon={<Activity size={10} />} color="text-blue-400" />
                      <UnitMetric label="Reja" value={formatNumber(group.expected_income)} icon={<Target size={10} />} gold />
                      <UnitMetric label="Tushum" value={formatNumber(group.received_income)} icon={<CheckCircle size={10} />} emerald />
                      <div className="flex flex-col justify-center">
                        <div className={`px-2 py-1 rounded-md text-center text-[9px] font-bold tabular-nums border ${groupProgress >= 80 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          groupProgress >= 50 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                            'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>
                          {groupProgress}% Ef.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const BranchStatCard = ({ label, value, icon, color, nom }) => (
  <div className="lux-card !p-3">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-2 bg-[var(--bg-void)]/60 rounded-lg border border-[var(--border-glass)] ${color}`}>
        {icon}
      </div>
    </div>
    <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase mb-1 italic">{nom}</p>
    <h3 className="text-xl font-bold text-[var(--text-primary)] tracking-tight uppercase italic">{value}</h3>
  </div>
);

const MiniIndicator = ({ label, value, icon, color }) => (
  <div className="p-2 bg-[var(--bg-void)]/30 rounded-lg border border-[var(--border-glass)]">
    <div className={`flex items-center gap-1.5 mb-1 ${color} opacity-50`}>
      {icon}
      <span className="text-[7px] font-bold uppercase">{label}</span>
    </div>
    <p className="text-xs font-bold text-[var(--text-primary)] tabular-nums italic">{value}</p>
  </div>
);

const UnitMetric = ({ label, value, icon, gold, emerald, color }) => (
  <div>
    <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase mb-1 flex items-center gap-1">
      <span className="opacity-30">{icon}</span> {label}
    </p>
    <p className={`text-[10px] font-bold tabular-nums tracking-tight ${color ? color : (gold ? 'text-[var(--gold)]' : emerald ? 'text-emerald-400' : 'text-[var(--text-primary)]')} italic uppercase`}>
      {value}
    </p>
  </div>
);

const Loader2 = ({ className, size }) => (
  <Activity size={size} className={className} />
);