import { useState, useEffect } from 'react';
import {
  Search, Download, TrendingUp, Building2, Wallet, ArrowRight,
  Bell, MoreHorizontal, Loader2, Users, Activity, CreditCard,
  ChevronRight, MapPin, TrendingDown, ShieldCheck, Zap, Globe, ArrowUpRight, Circle
} from 'lucide-react';
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import api from '../../../tokenUpdater/updater';
import toast from 'react-hot-toast';
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

const AllPayments = () => {
  const navigate = useNavigate();
  const [branches, setBranches] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showNotif, setShowNotif] = useState(false);

  const formatNumber = (num) => {
    if (!num) return '0';
    return Math.floor(parseFloat(num)).toLocaleString();
  };

  const handleDownloadMonthlyReport = async () => {
    setIsDownloading(true);
    try {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;
      const response = await api.get('/reports/monthly-finance/', {
        params: { year: currentYear, month: currentMonth },
        responseType: 'blob',
      });
      const fileName = `Financial_Intelligence_Report_${currentYear}_${String(currentMonth).padStart(2, '0')}.xlsx`;
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Hisobot muvaffaqiyatli yuklandi.");
    } catch (error) {
      toast.error("Hisobotni yuklashda xatolik yuz berdi.");
    } finally {
      setIsDownloading(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [branchRes, statsRes] = await Promise.all([
        api.get(`/add_branch/branches/`),
        api.get(`/finance/statistics/`)
      ]);

      const statsMap = {};
      statsRes.data.branches?.forEach(b => {
        statsMap[b.id] = b;
      });

      const mergedBranches = branchRes.data.map(b => ({
        ...b,
        finance: statsMap[b.id] || { income: 0, expense: 0, profit: 0 }
      }));

      setBranches(mergedBranches);
      setStatistics(statsRes.data);
      setStatistics(statsRes.data);
    } catch (error) {
      toast.error("Ma'lumotlarni yuklashda xatolik.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalPersonnel = branches.reduce((sum, b) => sum + (b.mentors_count || 0) + (b.admins_count || 0), 0);

  return (
    <div className="space-y-4 pb-6">
      {/* Background removed as per request */}

      {/* HEADER ACTION AREA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-[var(--bg-panel)]/40 border border-[var(--border-glass)] rounded-2xl mb-8">
        <div className="flex items-center gap-4">
          <div className="w-1.5 h-8 bg-[var(--gold)] rounded-full" />
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight uppercase">Moliya Boshqaruvi</h1>
            <p className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-wider">Platformaning moliyaviy integratsiyasi</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadMonthlyReport}
            disabled={isDownloading}
            className="flex items-center gap-2 h-10 px-6 bg-[var(--gold)] text-black rounded-xl font-bold text-[10px] uppercase tracking-wider transition-opacity hover:opacity-90 active:scale-95 disabled:opacity-50"
          >
            {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            <span>Hisobotni Yuklash</span>
          </button>
        </div>
      </div>

      {/* PRIMARY INTELLIGENCE CARD */}
      {!loading && statistics ? (
        <div className="lux-card !p-6 mb-8">
          {/* HEADER ROW */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6 pb-6 border-b border-[var(--border-glass)]">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--gold)] shadow-inner">
                <Wallet size={28} strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-widest italic">Umumiy G'azna</h3>
                <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-[0.2em] mt-1">Barcha filiallar bo'yicha</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="text-right hidden sm:block">
                <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Xodimlar</p>
                <div className="flex items-center justify-end gap-2 text-lg font-black text-[var(--text-primary)]">
                  {totalPersonnel} <Users size={14} className="text-[var(--gold)] opacity-50" />
                </div>
              </div>
              
              <div className="w-px h-10 bg-[var(--border-glass)] hidden sm:block"></div>
              
              <div className="text-right">
                <p className="text-[9px] font-black text-[var(--gold)] uppercase tracking-widest mb-1">
                  Tasdiqlangan Tushum
                </p>
                <div className="flex items-baseline justify-end gap-2">
                  <span className="text-3xl font-black text-[var(--text-primary)] tracking-tight uppercase italic drop-shadow-md">
                    {formatNumber(statistics.total_income)}
                  </span>
                  <span className="text-[10px] font-black text-[var(--text-muted)] uppercase">UZS</span>
                </div>
                <div className="flex items-center justify-end gap-2 mt-1">
                  <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black tracking-widest ${statistics.income_trend >= 0 ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                    {statistics.income_trend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {statistics.income_trend >= 0 ? '+' : ''}{statistics.income_trend}%
                  </div>
                  <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-tight hidden sm:inline">O'tgan oyga nisbatan</span>
                </div>
              </div>
            </div>
          </div>

          {/* PERFORMANCE METRICS (Horizontal grid) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatMetric 
              label="Chiqimlar" 
              value={formatNumber(statistics.total_expense)} 
              icon={<TrendingDown size={20} />} 
              color="text-red-500" 
              bg="bg-red-500/10 border-red-500/20"
              trend={`${statistics.expense_trend >= 0 ? '+' : ''}${statistics.expense_trend}%`} 
            />
            <StatMetric 
              label="Qarzdorlik" 
              value={formatNumber(statistics.total_debt)} 
              icon={<CreditCard size={20} />} 
              color="text-amber-500" 
              bg="bg-amber-500/10 border-amber-500/20"
              trend={`${(parseFloat(statistics.total_debt) / (parseFloat(statistics.total_income) + parseFloat(statistics.total_debt) || 1) * 100).toFixed(1)}%`} 
            />
            <StatMetric 
              label="Sof Foyda" 
              value={formatNumber(statistics.net_profit)} 
              icon={<TrendingUp size={20} />} 
              color="text-emerald-500" 
              bg="bg-emerald-500/10 border-emerald-500/20"
              trend={`${statistics.profit_trend >= 0 ? '+' : ''}${statistics.profit_trend}%`} 
            />
          </div>

          {/* VISUAL CHART */}
          {statistics.branches && statistics.branches.length > 0 && (
            <div className="mt-8 pt-6 border-t border-[var(--border-glass)]">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
                <h4 className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em]">Filiallar kesimida moliyaviy oqim (UZS)</h4>
                <div className="flex gap-4">
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></div><span className="text-[8px] text-[var(--text-muted)] font-black uppercase tracking-widest">Tushum</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-red-500"></div><span className="text-[8px] text-[var(--text-muted)] font-black uppercase tracking-widest">Chiqim</span></div>
                </div>
              </div>
              <div className="h-[140px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statistics.branches} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'var(--text-muted)', fontSize: 9, fontWeight: 800 }} 
                      dy={10} 
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(255,255,255,0.02)' }} 
                      contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '12px', padding: '12px', fontSize: '10px', textTransform: 'uppercase', fontWeight: '900', letterSpacing: '1px' }}
                      itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                      formatter={(value) => [`${formatNumber(value)} UZS`, '']}
                      labelStyle={{ color: '#d4af37', marginBottom: '8px' }}
                    />
                    <Bar dataKey="income" name="Tushum" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="expense" name="Chiqim" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

      ) : (
        <div className="h-[250px] bg-[var(--bg-panel)]/40 border border-[var(--border-glass)] rounded-[2rem] mb-8" />
      )}

      {/* OPERATIONS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ACCESS PROTOCOL SIDEBAR */}
        <div className="lg:col-span-3 space-y-4">
          <div className="lux-card !p-3 !rounded-xl">
            <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest px-2 mb-3">
              Muddallar
            </p>
            <nav className="space-y-1.5">
              <SidebarProtocol to="payments-history" icon={<Wallet size={16} />} label="To'lovlar Tarixi" badge={statistics?.new_payments_count > 0 ? statistics.new_payments_count : null} />
              <SidebarProtocol to="staff-payments" icon={<Users size={16} />} label="Xodimlar Maoshi" />
              <SidebarProtocol to="utility-payments" icon={<Zap size={16} />} label="Kommunal To'lovlar" />
              {/* <SidebarProtocol to="" icon={<Activity size={16} />} label="Batafsil Tahlil" /> */}
            </nav>
          </div>

          <div className="lux-card !p-4 !rounded-xl">
            <h4 className="text-[9px] font-bold text-[var(--gold)] uppercase tracking-wider mb-4 italic">
              Filial Ulushi
            </h4>
            <div className="space-y-5">
              {statistics?.branches?.slice(0, 3).map((b, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-black">
                    <span className="text-[var(--text-muted)] uppercase tracking-wide truncate pr-4">{b.name}</span>
                    <span className="text-[var(--text-primary)]">{(b.income / (statistics?.total_income || 1) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-1 bg-[var(--bg-panel)] rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--gold)] opacity-40" style={{ width: `${(b.income / (statistics?.total_income || 1)) * 100 || 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* REGIONAL NODES LIST */}
        <div className="lg:col-span-9 space-y-4">
          <div className="flex justify-between items-end pb-3 border-b border-[var(--border-glass)]">
            <h3 className="text-xl font-bold text-[var(--text-primary)] uppercase tracking-tight italic">Hududiy Filiallar</h3>
            <div className="flex items-center gap-2 px-2 py-0.5 bg-[var(--bg-panel)]/40 border border-[var(--border-glass)] rounded">
              <span className="text-[9px] font-bold text-[var(--text-primary)] uppercase tracking-tight">{branches.length} Filial</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {branches.map((branch) => (
              <div
                key={branch.id}
                onClick={() => navigate(`branch-details/${branch.id}`)}
                className="lux-card !p-4 cursor-pointer hover:border-[var(--gold)]/40 flex flex-col justify-between"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-muted)]">
                      <Building2 size={20} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-base font-bold text-[var(--text-primary)] uppercase tracking-tight">{branch.name}</h4>
                      <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase mt-1 italic flex items-center gap-1">
                        <MapPin size={10} className="opacity-40" /> {branch.address?.slice(0, 20)}
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight size={16} className="text-[var(--text-muted)] opacity-20" />
                </div>

                <div className="grid grid-cols-2 gap-3 p-3 bg-[var(--bg-void)]/40 rounded-xl border border-[var(--border-glass)]">
                  <div>
                    <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase mb-1">Tushum</p>
                    <p className="text-sm font-bold text-[var(--text-primary)] tracking-tight uppercase tabular-nums">
                      {formatNumber(branch.finance?.income)} <span className="text-[8px] text-[var(--text-muted)] font-bold uppercase ml-1">UZS</span>
                    </p>
                  </div>
                  <div className="border-l border-[var(--border-glass)] pl-3">
                    <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase mb-1">Xodimlar</p>
                    <p className="text-sm font-bold text-[var(--text-muted)] tracking-tight tabular-nums">
                      {(branch.mentors_count || 0) + (branch.admins_count || 0)} <span className="text-[8px] font-bold uppercase ml-1">Jami</span>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatMetric = ({ label, value, icon, color, bg, trend }) => (
  <div className="flex items-center p-4 bg-[var(--bg-void)]/40 rounded-2xl border border-[var(--border-glass)] group hover:border-[var(--gold)]/30 transition-colors">
    <div className={`p-3 rounded-xl border mr-4 ${bg} ${color} shadow-inner group-hover:scale-110 transition-transform duration-300`}>
      {icon}
    </div>
    <div className="flex-1">
      <h4 className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-1">{label}</h4>
      <div className="flex items-baseline gap-2">
        <p className="text-xl font-black text-[var(--text-primary)] tabular-nums tracking-tight uppercase italic">{value}</p>
        <span className="text-[9px] font-black text-[var(--text-muted)] uppercase">UZS</span>
      </div>
    </div>
    <div className={`text-right flex items-center justify-center p-2 rounded bg-[var(--bg-panel)] border border-[var(--border-glass)] min-w-[48px]`}>
      <p className={`text-[10px] font-black ${color} tracking-widest`}>{trend}</p>
    </div>
  </div>
);

const SidebarProtocol = ({ icon, label, to = "#", badge }) => (
  <NavLink to={to} className="flex items-center justify-between p-3 rounded-lg hover:bg-[var(--gold-dim)] border border-transparent transition-all group">
    <div className="flex items-center gap-3">
      <div className="text-[var(--text-muted)] group-hover:text-[var(--gold)]">{icon}</div>
      <span className="text-[9px] font-bold text-[var(--text-muted)] group-hover:text-[var(--text-primary)] uppercase tracking-wide">{label}</span>
    </div>
    {badge ? (
      <span className="px-1.5 py-0.5 bg-[var(--gold)] text-black text-[8px] font-bold rounded">{badge}</span>
    ) : (
      <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 text-[var(--gold)] transition-all" />
    )}
  </NavLink>
);

export default AllPayments;
