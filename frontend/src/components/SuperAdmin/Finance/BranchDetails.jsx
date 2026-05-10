import React from'react';
import { useBranchFinance } from'./BranchDetails/useBranchFinance';
import { 
 BranchHeader, BranchStatsGrid, FinancialIntelligence, 
 UnitBreakdown 
} from'./BranchDetails/BranchFinanceUI';
import { Activity, ShieldCheck, Calendar } from'lucide-react';

export default function BranchFinance() {
 const { 
 loading, data, error, fetchBranchFinance, 
 formatNumber, progressPercentage, stats, 
 finance, branch, groups,
 selectedYear,
 selectedMonth,
 setSelectedYear,
 setSelectedMonth,
 goPrevMonth,
 goCurrentMonth,
 formatMonthLabel,
 } = useBranchFinance();

 const today = new Date();
 const periodControls = (
 <div className="flex flex-wrap items-center gap-2">
 <div className="flex items-center gap-2 h-9 px-2 bg-[var(--bg-void)]/40 border border-[var(--border-glass)] rounded-lg">
 <Calendar size={12} className="text-[var(--gold)] opacity-60 shrink-0" />
 <select
 value={selectedMonth}
 onChange={(e) => setSelectedMonth(Number(e.target.value))}
 className="bg-transparent text-[9px] font-black text-[var(--text-primary)] outline-none max-w-[3rem]"
 >
 {Array.from({ length: 12 }).map((_, idx) => (
 <option key={idx + 1} value={idx + 1} className="bg-[var(--bg-panel)]">
 {String(idx + 1).padStart(2,'0')}
 </option>
 ))}
 </select>
 <select
 value={selectedYear}
 onChange={(e) => setSelectedYear(Number(e.target.value))}
 className="bg-transparent text-[9px] font-black text-[var(--text-primary)] outline-none"
 >
 {Array.from({ length: 6 }).map((_, i) => {
 const y = today.getFullYear() - i;
 return <option key={y} value={y} className="bg-[var(--bg-panel)]">{y}</option>;
 })}
 </select>
 </div>
 <span className="text-[9px] font-black text-[var(--gold)] tabular-nums px-1">
 {formatMonthLabel(selectedYear, selectedMonth)}
 </span>
 <button
 type="button"
 onClick={goPrevMonth}
 className="h-9 px-3 bg-[var(--bg-void)]/40 border border-red-500/20 text-red-400 rounded-lg font-black text-[9px] capitalize tracking-wider hover:bg-red-500/10"
 >
 O'tgan oy
 </button>
 <button
 type="button"
 onClick={goCurrentMonth}
 className="h-9 px-3 bg-[var(--bg-void)]/40 border border-emerald-500/20 text-emerald-400 rounded-lg font-black text-[9px] capitalize tracking-wider hover:bg-emerald-500/10"
 >
 Joriy oy
 </button>
 </div>
 );

 if (loading) {
 return (
 <div className="flex flex-col items-center justify-center py-40">
 <Activity className="animate-spin text-[var(--gold)] mb-6" size={48} />
 <p className="text-[10px] font-black capitalize tracking-[0.4em] text-[var(--text-muted)]">Yuklanmoqda...</p>
 </div>
 );
 }

 if (error) {
 return (
 <div className="flex flex-col items-center justify-center py-40">
 <ShieldCheck size={48} className="text-red-500/40 mb-6" />
 <p className="text-sm font-black text-red-400 capitalize tracking-widest mb-6">{error}</p>
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

 return (
 <div className="space-y-6 pb-12">
 <BranchHeader branchName={branch.name} periodControls={periodControls} />
 <BranchStatsGrid stats={stats} />
 <FinancialIntelligence 
 finance={finance} 
 formatNumber={formatNumber} 
 progressPercentage={progressPercentage} 
 />
 {groups && groups.length > 0 && (
 <UnitBreakdown groups={groups} formatNumber={formatNumber} />
 )}
 </div>
 );
}