import React, { useState, useMemo, useEffect } from'react';
import {
 ArrowLeft, Search, Filter, Calendar,
 User, CheckCircle2, ChevronRight,
 ArrowDownLeft, ArrowUpRight,
 Wallet, DollarSign, PieChart, Database,
 MapPin, Loader2, X, Trash2, RefreshCw,
 ShieldCheck, Zap, Globe, Circle, Activity
} from'lucide-react';
import { useNavigate } from'react-router-dom';
import { useInfiniteQuery, useQuery } from'@tanstack/react-query';
import { useInView } from'react-intersection-observer';
import api from'../../../tokenUpdater/updater';
import { get_user_info } from'../../Authorized/getRole';
import toast from'react-hot-toast';

const PaymentsStory = () => {
 const navigate = useNavigate();
 const user = get_user_info();

 const [filters, setFilters] = useState({
 search:"",
 type:"",
 category:"",
 branch:"",
 startDate:"",
 endDate:""
 });
 const [debouncedFilters, setDebouncedFilters] = useState(filters);
 const [showFilters, setShowFilters] = useState(false);

 // ✅ DEBOUNCE LOGIC: Qotishni oldini olish uchun
 useEffect(() => {
 const timer = setTimeout(() => {
 setDebouncedFilters(filters);
 }, 500);
 return () => clearTimeout(timer);
 }, [filters]);

 const { ref, inView } = useInView();

 const {
 data,
 fetchNextPage,
 hasNextPage,
 isFetchingNextPage,
 isLoading,
 isFetching,
 refetch
 } = useInfiniteQuery({
 queryKey: ['finance-transactions', debouncedFilters],
 queryFn: async ({ pageParam = 1 }) => {
 const params = new URLSearchParams();
 params.append('page', pageParam);
 if (debouncedFilters.search) params.append('search', debouncedFilters.search);
 if (debouncedFilters.type) params.append('transaction_type', debouncedFilters.type);
 if (debouncedFilters.category) params.append('category', debouncedFilters.category);
 if (debouncedFilters.branch) params.append('branch', debouncedFilters.branch);
 if (debouncedFilters.startDate) params.append('date__gte', debouncedFilters.startDate);
 if (debouncedFilters.endDate) params.append('date__lte', debouncedFilters.endDate);

 const res = await api.get(`/finance/transactions/?${params.toString()}`);
 return res.data;
 },
 getNextPageParam: (lastPage) => {
 if (!lastPage.next) return undefined;
 const url = new URL(lastPage.next);
 return url.searchParams.get('page') || undefined;
 },
 initialPageParam: 1
 });

 // ✅ Auto-load next page on scroll
 useEffect(() => {
 if (inView && hasNextPage && !isFetchingNextPage) {
 fetchNextPage();
 }
 }, [inView, hasNextPage, isFetchingNextPage]);

 const { data: branches } = useQuery({
 queryKey: ['branches-list'],
 queryFn: async () => {
 const res = await api.get('/add_branch/branches/');
 return res.data;
 }
 });

 const transactions = useMemo(() => {
 return data?.pages.flatMap(page => page.results) || [];
 }, [data]);

 const stats = useMemo(() => {
 // ✅ Backenddan kelgan umumiy statistikadan foydalanamiz (Oxirgi olingan page dan)
 const latestPage = data?.pages[0];
 if (!latestPage?.stats) return { income: 0, expense: 0, net: 0 };
 return latestPage.stats;
 }, [data]);

 const formatCurrency = (amount) => {
 return Math.floor(amount).toLocaleString() +" UZS";
 };

 const handleFilterChange = (key, value) => {
 setFilters(prev => ({ ...prev, [key]: value }));
 };

 const resetFilters = () => {
 setFilters({ search:"", type:"", category:"", branch:"", startDate:"", endDate:"" });
 };

 const handleDeleteTransaction = async (id) => {
 if (user.role !=='super_admin') return toast.error("Ruxsat yo'q");
 if (!window.confirm("Ushbu tranzaksiyani butkul o'chirmoqchimisiz?")) return;

 try {
 await api.delete(`/finance/transactions/${id}/`);
 toast.success("Tranzaksiya o'chirildi");
 refetch();
 } catch (error) {
 toast.error("O'chirishda xatolik");
 }
 };

 return (
 <div className="space-y-10 pb-20">
 {/* Atmosphere Background */}
 <div className="fixed inset-0 pointer-events-none -z-10">
 <div className="absolute top-[-15%] right-[-10%] w-[600px] h-[600px] bg-[var(--gold)]/5 rounded-full blur-[140px]"></div>
 <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-[var(--gold)]/5 rounded-full blur-[120px]"></div>
 </div>

 {/* HEADER SECTION */}
 <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-6 border-b border-[var(--border-glass)]">
 <div className="flex items-center gap-6">
 <button onClick={() => navigate(-1)} className="p-3 bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-xl text-[var(--gold)] hover:scale-110 transition-all shadow-inner"><ArrowLeft size={20} /></button>
 <div>
 <h1 className="text-4xl font-black text-[var(--text-primary)] tracking-tighter capitalize mb-2 flex items-center gap-4">
 Moliya Tarixi
 {isFetching && <Loader2 className="animate-spin text-[var(--gold)]/30" size={20} />}
 </h1>
 <p className="text-[10px] text-[var(--text-muted)] font-black capitalize tracking-[0.4em] flex items-center gap-3">
 <ShieldCheck size={12} className="text-[var(--gold)]" /> Tasdiqlangan Tranzaksiyalar Tarixi
 </p>
 </div>
 </div>

 <div className="flex flex-wrap items-center gap-3">
 <div className="relative group">
 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--gold)] transition-colors" size={18} />
 <input
 type="text"
 placeholder="QIDIRISH..."
 className="lux-input !pl-12 !w-full lg:!w-80 !bg-[var(--bg-void)]/40 !border-[var(--border-glass)] hover:!border-[var(--gold)]/30 focus:!border-[var(--gold)]/50 transition-all placeholder:text-[9px] placeholder:tracking-[0.2em] placeholder:capitalize placeholder:text-[var(--text-muted)]/50"
 value={filters.search}
 onChange={(e) => handleFilterChange('search', e.target.value)}
 />
 </div>
 <button
 onClick={() => setShowFilters(!showFilters)}
 className={`p-4 border rounded-xl transition-all flex items-center justify-center shadow-inner ${showFilters ?'bg-[var(--gold)] border-transparent text-black' :'bg-[var(--bg-panel)]/40 border-[var(--border-glass)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--gold)]/30'}`}
 >
 <Filter size={20} />
 </button>
 <button
 onClick={() => refetch()}
 className="p-4 bg-[var(--bg-panel)]/40 border border-[var(--border-glass)] rounded-xl text-[var(--text-muted)] hover:text-[var(--gold)] hover:border-[var(--gold)]/30 transition-all active:rotate-180 duration-500"
 >
 <RefreshCw size={20} />
 </button>
 </div>
 </div>

 {/* EXPANDABLE FILTER BAR */}
 {showFilters && (
 <div className="lux-card !bg-[var(--bg-void)]/80 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 animate-in slide-in-from-top-4 duration-500">
 <FilterSelect
 label="Tranzaksiya Turi"
 value={filters.type}
 onChange={(v) => handleFilterChange('type', v)}
 options={[
 { label:'Barcha Operatsiyalar', value:'' },
 { label:'Kirim', value:'income' },
 { label:'Chiqim', value:'expense' },
 ]}
 />
 <FilterSelect
 label="Kategoriya"
 value={filters.category}
 onChange={(v) => handleFilterChange('category', v)}
 options={[
 { label:'Barcha Yo\'nalishlar', value:'' },
 { label:'Talaba To\'lovi', value:'student_fee' },
 { label:'Xodimlar Maoshi', value:'salary' },
 { label:'Kommunal', value:'utility' },
 { label:'Ijara', value:'rent' },
 { label:'Boshqa', value:'other' },
 ]}
 />
 {user.role ==='super_admin' && (
 <FilterSelect
 label="Regional Node"
 value={filters.branch}
 onChange={(v) => handleFilterChange('branch', v)}
 options={[
 { label:'Global Registry', value:'' },
 ...(branches?.map(b => ({ label: b.name, value: b.id })) || [])
 ]}
 />
 )}
 <div className="space-y-2">
 <label className="text-[8px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1 group-hover:text-[var(--gold)] transition-colors">Boshlanish Sanasi</label>
 <input
 type="date"
 value={filters.startDate}
 onChange={(e) => handleFilterChange('startDate', e.target.value)}
 className="w-full bg-[var(--bg-void)]/40 border border-[var(--border-glass)] rounded-xl px-4 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--gold)]/50 transition-all"
 />
 </div>
 <div className="space-y-2">
 <label className="text-[8px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1">Tugash Sanasi</label>
 <input
 type="date"
 value={filters.endDate}
 onChange={(e) => handleFilterChange('endDate', e.target.value)}
 className="w-full bg-[var(--bg-void)]/40 border border-[var(--border-glass)] rounded-xl px-4 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--gold)]/50 transition-all"
 />
 </div>
 <div className="flex items-end">
 <button
 onClick={resetFilters}
 className="w-full h-10 bg-red-500/5 hover:bg-red-500/10 text-red-500 border border-red-500/10 rounded-xl text-[9px] font-black capitalize tracking-widest transition-all"
 >
 Tozalash
 </button>
 </div>
 </div>
 )}

 {/* SUMMARY STATS GRID */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 <FinanceStat label="Kirim" value={formatCurrency(stats.income)} color="emerald" icon={<ArrowDownLeft size={20} />} trend="+12.4%" />
 <FinanceStat label="Chiqim" value={formatCurrency(stats.expense)} color="rose" icon={<ArrowUpRight size={20} />} trend="-3.2%" />
 <FinanceStat label="Sof Foyda" value={formatCurrency(stats.net)} color="gold" icon={<PieChart size={20} />} isMain />
 </div>

 {/* TRANSACTION LIST */}
 <div className="space-y-4">
 <div className="px-10 hidden md:flex items-center justify-between text-[10px] font-black text-[var(--text-muted)] capitalize tracking-[0.4em] mb-6 opacity-30">
 <div className="flex items-center gap-16">
 <span className="w-12">ID</span>
 <span className="w-48">Izoh</span>
 </div>
 <div className="flex items-center gap-20 text-right">
 <span className="w-24">Filial</span>
 <span className="w-32">Kiritdi</span>
 <span className="w-32 text-right">Summa</span>
 </div>
 </div>

 {isLoading ? (
 <div className="py-40 flex flex-col items-center justify-center gap-6">
 <Loader2 className="animate-spin text-[var(--gold)]" size={48} />
 <p className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-[0.4em]">Accessing Ledger Data...</p>
 </div>
 ) : transactions.length === 0 ? (
 <div className="lux-card !py-32 flex flex-col items-center justify-center text-[var(--text-muted)] opacity-30">
 <Database size={48} className="mb-6 opacity-20" />
 <p className="text-[10px] font-black capitalize tracking-[0.4em]">Tarix topilmadi.</p>
 </div>
 ) : (
 <div className="space-y-3">
 {transactions.map((trx, index) => (
 <TransactionRow
 key={trx.id || index}
 trx={trx}
 formatCurrency={formatCurrency}
 onDelete={() => handleDeleteTransaction(trx.id)}
 isSuperAdmin={user.role ==='super_admin'}
 />
 ))}
 </div>
 )}
 </div>

 {/* PAGINATION / SCROLL ANCHOR */}
 <div ref={ref} className="mt-16 flex flex-col items-center justify-center gap-4">
 {hasNextPage && (
 <div className="py-8">
 <Loader2 className="animate-spin text-[var(--gold)]/30" size={32} />
 </div>
 )}
 {!hasNextPage && transactions.length > 0 && (
 <p className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-[0.4em] opacity-20">
 History sync complete. All nodes reached.
 </p>
 )}
 </div>
 </div>
 );
};

const FinanceStat = ({ label, value, color, icon, trend, isMain }) => {
 const colors = {
 emerald:"text-emerald-400 border-emerald-500/20 bg-emerald-500/[0.03]",
 rose:"text-rose-400 border-rose-500/20 bg-rose-500/[0.03]",
 gold:"text-[var(--gold)] border-[var(--gold)]/20 bg-[var(--gold-dim)] shadow-[var(--gold-glow-soft)]"
 };

 return (
 <div className={`lux-card !p-6 flex flex-col justify-between group overflow-hidden relative ${colors[color]}`}>
 <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 blur-2xl rounded-full translate-x-1/2 -translate-y-1/2" />
 <div className="flex justify-between items-start mb-6">
 <div className="p-3 bg-[var(--bg-void)]/40 rounded-2xl border border-[var(--border-glass)] shadow-inner group-hover:scale-110 transition-transform duration-500">
 {icon}
 </div>
 {trend && (
 <div className="px-3 py-1 bg-[var(--bg-void)]/40 border border-[var(--border-glass)] rounded-full text-[10px] font-black shadow-inner">
 {trend}
 </div>
 )}
 </div>
 <div>
 <p className="text-[10px] font-black capitalize tracking-[0.2em] mb-2 opacity-60">{label}</p>
 <p className={`text-2xl font-black tracking-tighter tabular-nums ${isMain ?'text-[var(--text-primary)]' :''}`}>{value}</p>
 </div>
 </div>
 );
};

const TransactionRow = React.memo(({ trx, formatCurrency, onDelete, isSuperAdmin }) => {
 const isIncome = trx.transaction_type ==='income';

 return (
 <div className="lux-card !p-5 group/row hover:border-[var(--gold)]/30 transition-all flex flex-col md:flex-row items-center justify-between gap-8">
 <div className="flex items-center gap-6 w-full md:w-auto">
 <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-500 group-hover/row:scale-110 shadow-inner ${isIncome ?'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :'bg-rose-500/10 border-rose-500/20 text-rose-400'
 }`}>
 {isIncome ? <ArrowDownLeft size={24} /> : <ArrowUpRight size={24} />}
 </div>
 <div className="min-w-0">
 <div className="flex items-center gap-3 mb-1.5">
 <h4 className="text-lg font-black text-[var(--text-primary)] capitalize tracking-tight group-hover/row:text-[var(--gold)] transition-colors truncate">{trx.title}</h4>
 <div className={`px-2 py-0.5 rounded-lg text-[8px] font-black capitalize tracking-widest border border-[var(--border-glass)] shadow-inner ${isIncome ?'bg-emerald-500/5 text-emerald-500/60' :'bg-rose-500/5 text-rose-500/60'
 }`}>
 {trx.category_display}
 </div>
 </div>
 <p className="text-[10px] text-[var(--text-muted)] font-bold flex items-center gap-2 truncate opacity-60 capitalize">
 {trx.description?.slice(0, 50)}... <span className="text-[8px] not-italic text-[var(--gold)] opacity-40 ml-2">HEX:#{trx.id?.toString().slice(-6)}</span>
 </p>
 </div>
 </div>

 <div className="flex items-center justify-between md:justify-end w-full md:w-auto md:gap-16 border-t md:border-t-0 border-[var(--border-glass)] pt-5 md:pt-0">
 <div className="space-y-2 text-left md:text-right">
 <div className="flex items-center gap-2 md:justify-end text-[var(--gold)] opacity-40">
 <MapPin size={10} />
 <span className="text-[9px] font-black capitalize tracking-widest">{trx.branch_name ||"MARKAZIY FILIAL"}</span>
 </div>
 <div className="flex items-center gap-4 text-[var(--text-muted)] opacity-30 md:justify-end">
 <span className="text-[8px] font-black">AUTH: @{trx.marked_by_name?.split('')[0]}</span>
 <span className="text-[8px] font-black capitalize tabular-nums">{new Date(trx.date).toLocaleDateString('en-GB', { day:'2-digit', month:'short' })}</span>
 </div>
 </div>

 <div className="flex items-center gap-6">
 <div className="text-right">
 <p className={`text-xl font-black tabular-nums tracking-tighter md:min-w-32 ${isIncome ?'text-emerald-400' :'text-rose-400'} `}>
 {isIncome ?'+' :'-'}{formatCurrency(trx.amount)}
 </p>
 <p className="text-[8px] font-black text-[var(--text-muted)] capitalize tracking-widest mt-1 opacity-20">
 VAQT: {new Date(trx.created_at).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}
 </p>
 </div>

 <div className="flex items-center gap-2">
 {isSuperAdmin && (
 <button
 onClick={(e) => { e.stopPropagation(); onDelete(); }}
 className="p-3 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white border border-rose-500/10 rounded-xl transition-all"
 title="O'chirish"
 >
 <Trash2 size={18} />
 </button>
 )}
 <div className="p-2.5 bg-[var(--bg-void)]/40 border border-[var(--border-glass)] rounded-xl text-[var(--text-muted)] hover:text-[var(--gold)] hover:border-[var(--gold)]/30 transition-all shadow-inner group-hover/row:bg-[var(--gold-dim)] group-hover/row:text-[var(--gold)]">
 <ChevronRight size={18} />
 </div>
 </div>
 </div>
 </div>
 </div>
 );
});

const FilterSelect = ({ label, value, onChange, options }) => (
 <div className="space-y-2 group">
 <label className="text-[8px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1 group-hover:text-[var(--gold)] transition-colors">{label}</label>
 <div className="relative">
 <select
 value={value}
 onChange={(e) => onChange(e.target.value)}
 className="w-full bg-[var(--bg-void)]/40 border border-[var(--border-glass)] text-[var(--text-primary)] text-[10px] font-black capitalize tracking-widest px-4 py-3 rounded-xl outline-none hover:border-[var(--gold)]/30 focus:border-[var(--gold)]/50 appearance-none transition-all cursor-pointer shadow-inner"
 >
 {options.map(opt => (
 <option key={opt.value} value={opt.value} className="bg-[var(--bg-panel)]">{opt.label}</option>
 ))}
 </select>
 <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] rotate-90 pointer-events-none group-focus-within:text-[var(--gold)] transition-colors shadow-inner" />
 </div>
 </div>
);

export default PaymentsStory;