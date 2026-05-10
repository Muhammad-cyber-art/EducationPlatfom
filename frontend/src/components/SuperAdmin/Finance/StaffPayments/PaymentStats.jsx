import React, { useState } from"react";
import { Receipt, Users, TrendingUp, PlusCircle, MinusCircle, CalendarDays, CheckCircle2, UserCheck } from"lucide-react";

const PaymentStats = ({
 data,
 isPercentageType,
 isStudentCountType,
 formatCurrency,
 studentCountSummary,
 finalTotalAmount,
 isSuperAdmin,
 onSelectIncomeType
}) => {
 const [selectedIncomeType, setSelectedIncomeType] = useState('actual'); // 'actual' | 'attendance' | 'mentor_attendance'
 return (
 <div className={`grid gap-4 ${isPercentageType || isStudentCountType ?'grid-cols-2 md:grid-cols-4' :'grid-cols-1 md:grid-cols-3'}`}>
 {/* 1. ASOSIY MAOSH KARTASI */}
 {isPercentageType ? (
 <>
 {/* Asl Tushum va Komissiya */}
 <div 
 onClick={() => { setSelectedIncomeType('actual'); onSelectIncomeType?.('actual'); }}
 className={`p-4 rounded-2xl bg-[var(--bg-panel)] border shadow-lg cursor-pointer transition-all ${selectedIncomeType === 'actual' ? 'border-emerald-500 shadow-emerald-500/10 ring-1 ring-emerald-500/30' : 'border-emerald-500/20 shadow-emerald-500/5 hover:border-emerald-500/40'}`}
 >
 <div className="flex items-center justify-between mb-1.5">
 <p className="text-[10px] font-black text-emerald-500 capitalize tracking-widest flex items-center gap-2">
 <Receipt size={12} /> Asl KPI
 </p>
 {selectedIncomeType === 'actual' && <CheckCircle2 size={12} className="text-emerald-500" />}
 </div>
 <h3 className="text-xl font-black text-[var(--text-primary)] tabular-nums mb-1">
 {formatCurrency(data.calculated_commission || 0)}
 </h3>
 <div className="flex items-center justify-between">
 <p className="text-[8px] font-bold text-[var(--text-muted)] capitalize tracking-widest">Hisoblandi</p>
 <p className="text-[8px] font-bold text-emerald-500 capitalize tabular-nums">{formatCurrency(data.groups_income)} tushum</p>
 </div>
 <p className="text-[7px] font-medium text-[var(--text-muted)]/80 mt-1.5 leading-snug">
 To'lov − refund + qo'shimcha; o'quvchi qoldirishlari hisobga olinmaydi
 </p>
 </div>

 
 {/* Yangi: Davomat Asosidagi Mentor Oyligi */}
 {data.attendance_based_salary?.salary > 0 && isSuperAdmin && (
 <div 
 onClick={() => { setSelectedIncomeType('mentor_attendance'); onSelectIncomeType?.('mentor_attendance'); }}
 className={`p-4 rounded-2xl bg-[var(--bg-panel)] border shadow-lg cursor-pointer transition-all ${selectedIncomeType === 'mentor_attendance' ? 'border-purple-500 shadow-purple-500/10 ring-1 ring-purple-500/30' : 'border-purple-500/20 shadow-purple-500/5 hover:border-purple-500/40'}`}
 >
 <div className="flex items-center justify-between mb-1.5">
 <p className="text-[10px] font-black text-purple-500 capitalize tracking-widest flex items-center gap-2">
 <UserCheck size={12} /> Mentor Davomati
 </p>
 {selectedIncomeType === 'mentor_attendance' && <CheckCircle2 size={12} className="text-purple-500" />}
 </div>
 <h3 className="text-xl font-black text-[var(--text-primary)] tabular-nums mb-1">
 {formatCurrency(data.attendance_based_salary.salary || 0)}
 </h3>
 <div className="flex items-center justify-between text-[8px]">
 <p className="font-bold text-[var(--text-muted)]">
 {data.attendance_based_salary.details?.total_teaching_days || 0} / {data.attendance_based_salary.details?.total_lesson_days || 0} kun
 </p>
 <p className="font-bold text-purple-500 tabular-nums">
 {formatCurrency(data.attendance_based_salary.details?.daily_rate || 0).replace(' UZS', '')}/kun
 </p>
 </div>
 {data.attendance_based_salary.details?.missed_days > 0 && (
 <p className="text-[7px] font-medium text-rose-400/70 mt-1.5">
 -{formatCurrency(data.attendance_based_salary.details?.missed_deduction || 0).replace(' UZS', '')} ({data.attendance_based_salary.details?.missed_days} kun dars o'tilmagan)
 </p>
 )}
 <p className="text-[7px] font-medium text-[var(--text-muted)]/80 mt-1.5 leading-snug">
 Brutto maosh ÷ jami reja kunlari × mentor kelgan kunlar (o'quvchi KPI dan mustaqil)
 </p>
 </div>
 )}
 </>
 ) : isStudentCountType ? (
 <div className="p-4 rounded-2xl bg-[var(--bg-panel)] border border-blue-500/20 shadow-lg shadow-blue-500/5">
 <p className="text-[10px] font-black text-blue-400 capitalize tracking-widest mb-1.5 flex items-center gap-2">
 <Users size={12} /> KPI Maosh
 </p>
 <h3 className="text-xl font-black text-[var(--text-primary)] tabular-nums mb-1">
 {formatCurrency(data.calculated_per_student || data.salary_base || 0)}
 </h3>
 <div className="flex items-center justify-between">
 <p className="text-[8px] font-bold text-blue-400/60 capitalize tracking-widest">{studentCountSummary.paidStudents} / {studentCountSummary.totalStudents} st.</p>
 <p className="text-[8px] font-black text-blue-500 capitalize tabular-nums">-{formatCurrency(studentCountSummary.mentorShareExpected)} max</p>
 </div>
 </div>
 ) : (
 <div className="p-4 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-glass)] shadow-lg">
 <p className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-1.5">
 Asosiy Maosh
 </p>
 <h3 className="text-xl font-black text-[var(--text-primary)] tabular-nums">
 {formatCurrency(data.salary_base)}
 </h3>
 </div>
 )}

 {/* 2. POTENTIAL REVENUE */}
 {isStudentCountType ? (
 <div className="p-4 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-glass)] shadow-lg">
 <p className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-1.5 flex items-center gap-2">
 <TrendingUp size={12} className="text-amber-500" /> Tahminiy Tushum
 </p>
 <h3 className="text-xl font-black text-amber-500 tabular-nums mb-1">
 {formatCurrency(studentCountSummary.expectedIncome)}
 </h3>
 <p className="text-[8px] font-bold text-[var(--text-muted)] capitalize tracking-widest">Real: {formatCurrency(studentCountSummary.paidIncome)}</p>
 </div>
 ) : (
 (data.bonus > 0 || data.deductions > 0) && (
 <div className="p-4 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-glass)]">
 <div className="flex items-center justify-between mb-1.5">
 <p className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-widest">Qo'shimcha</p>
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
 <p className="text-[10px] font-black text-rose-500 capitalize tracking-widest mb-1.5">
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
 <p className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-widest">Qo'shimcha</p>
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
 <div className="text-[10px] font-black text-[var(--gold)] capitalize tracking-[0.2em] mb-1 flex items-center gap-2">
 <div className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] animate-pulse shadow-[0_0_8px_var(--gold)]" />
 Yakuniy To'lov
 </div>
 <h3 className="text-2xl font-black text-[var(--text-primary)] tabular-nums tracking-tighter">
 {formatCurrency(finalTotalAmount)}
 </h3>
 </div>
 </div>
 );
};

export default PaymentStats;
