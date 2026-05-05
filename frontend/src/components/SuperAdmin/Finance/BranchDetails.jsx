import React from'react';
import { useBranchFinance } from'./BranchDetails/useBranchFinance';
import { 
 BranchHeader, BranchStatsGrid, FinancialIntelligence, 
 UnitBreakdown 
} from'./BranchDetails/BranchFinanceUI';
import { Activity, ShieldCheck } from'lucide-react';

export default function BranchFinance() {
 const { 
 loading, data, error, fetchBranchFinance, 
 formatNumber, progressPercentage, stats, 
 finance, branch, groups 
 } = useBranchFinance();

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
 <BranchHeader branchName={branch.name} />
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