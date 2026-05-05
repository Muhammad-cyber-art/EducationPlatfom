import React from"react";
import { Users, Check, RotateCw, Search, Lock } from"lucide-react";
import GroupsStudent from"../GrupsStudent";

const AttendanceSection = ({
 group_id,
 groupinfo,
 groupStudents,
 filteredStudents,
 selectedDate,
 availableDates,
 attendanceData,
 isAttendanceConfirmed,
 canEditAttendanceToday,
 isGroupLogicActive,
 isEditing,
 studentSearch,
 branchID,
 markedStudents,
 mergedAttendanceForDate,
 uiDispatch,
 handleConfirmAttendance,
 handleLocalAttendanceChange,
 refetchAttends,
 queryClient
}) => {
 return (
 <div className="lux-card-static !p-0 overflow-hidden pb-10 shadow-xl border-[var(--border-glass)]">
 <div className="p-4 sm:p-8 flex items-center justify-between gap-4 border-b border-[var(--border-glass)]">
 <div className="flex items-center gap-3 sm:gap-5">
 <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--gold)] shadow-inner">
 <Users size={18} className="sm:size-[22px]" />
 </div>
 <div>
 <h3 className="text-sm sm:text-xl font-bold text-[var(--text-primary)] capitalize tracking-tight flex items-center gap-2">
 Davomat
 {isAttendanceConfirmed && (
 <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[8px] font-black tracking-widest flex items-center gap-1 mt-0.5 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
 <Check size={10} strokeWidth={3} /> TAYYOR
 </span>
 )}
 </h3>
 <p className="text-[8px] sm:text-[10px] font-bold text-[var(--text-muted)] capitalize tracking-[0.3em] font-sans mt-0.5">
 Sana: <span className="text-[var(--gold)]">{selectedDate}</span>
 </p>
 </div>
 </div>

 <div className="flex items-center gap-2">
 {canEditAttendanceToday && (
 <button
 onClick={handleConfirmAttendance}
 className="flex items-center justify-center w-10 sm:w-auto sm:px-6 h-10 bg-[var(--gold)] text-black rounded-xl font-bold text-[10px] capitalize tracking-wider transition-opacity hover:opacity-90 active:scale-95"
 title="Tayyor"
 >
 <Check size={18} /> <span className="hidden sm:inline ml-2">Tayyor</span>
 </button>
 )}
 <button
 onClick={() => {
 queryClient.refetchQueries(['group-detail', group_id]);
 queryClient.refetchQueries(['group-students', group_id]);
 refetchAttends();
 queryClient.refetchQueries(['homeworks', group_id]);
 queryClient.refetchQueries(['mock-tests', group_id]);
 }}
 className="p-2 sm:p-3.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--text-secondary)] hover:text-[var(--gold)] hover:border-[var(--gold)]/30 transition-all shadow-md"
 title="Yangilash"
 >
 <RotateCw size={18} />
 </button>
 </div>
 </div>

 {/* SEARCH PROTOCOL */}
 <div className="px-4 sm:px-8 py-3 border-b border-[var(--border-glass)]/10 bg-[var(--bg-void)]/20 shadow-inner">
 <div className="relative group">
 <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--gold)] transition-colors">
 <Search size={14} />
 </div>
 <input
 type="text"
 placeholder="O'quvchi qidirish..."
 className="lux-input !py-2.5 !pl-10 !pr-4 !bg-[var(--bg-void)]/30 !border-[var(--border-glass)] !text-[10px] w-full"
 value={studentSearch}
 onChange={(e) => uiDispatch({ type:"SET_FIELD", field:"studentSearch", value: e.target.value })}
 />
 </div>
 </div>

 {!isGroupLogicActive && !isEditing && (
 <div className="mx-8 mb-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-500">
 <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500">
 <Lock size={20} />
 </div>
 <div>
 <p className="text-[10px] font-black text-amber-500 capitalize tracking-widest">Guruh kutilmoqda</p>
 <p className="text-[9px] text-amber-500/70 font-bold capitalize tracking-wider mt-0.5">
 Guruh boshlanish sanasi ({groupinfo.start_date ||'---'}) yetib kelmaguncha davomat va boshqa logikalar cheklangan.
 </p>
 </div>
 </div>
 )}

 {/* DATE PROTOCOLS */}
 <div className="px-8 py-5 border-b border-[var(--border-glass)] flex gap-3 overflow-x-auto scrollbar-hide">
 {availableDates.map((date) => (
 <button
 key={date}
 onClick={() => uiDispatch({ type:"SET_FIELD", field:"selectedDate", value: date })}
 className={`flex flex-col items-center justify-center px-6 py-3 rounded-xl transition-all border whitespace-nowrap min-w-[100px]
 ${selectedDate === date
 ?"bg-[var(--gold)] text-black border-transparent shadow-[var(--gold-glow)] scale-105"
 :"bg-[var(--bg-void)]/40 text-[var(--text-secondary)] border-[var(--border-glass)] hover:border-[var(--gold)]/20"}`}
 >
 <span className="text-[8px] font-black capitalize tracking-[0.2em] mb-1 opacity-60">Sana {date.split('-')[2]}</span>
 <span className="text-xs font-bold tracking-tight">{new Date(date).toLocaleDateString(undefined, { weekday:'short' }).toUpperCase()}</span>
 </button>
 ))}
 </div>

 {/* DIRECTORY LIST */}
 <div className="md:hidden p-4 space-y-4">
 <GroupsStudent
 students={filteredStudents}
 canEdit={canEditAttendanceToday}
 attendanceData={attendanceData}
 onAttendanceChange={refetchAttends}
 onLocalAttendanceChange={canEditAttendanceToday ? handleLocalAttendanceChange : undefined}
 localOverrides={mergedAttendanceForDate}
 groupId={group_id}
 selectedDate={selectedDate}
 mode="card"
 currentBranchId={branchID}
 markedStudents={markedStudents}
 onToggleMark={(id) => uiDispatch({ type:"TOGGLE_MARK", payload: id })}
 />
 </div>

 <div className="hidden md:block overflow-x-auto text-[var(--text-primary)]">
 <table className="w-full text-left">
 <thead>
 <tr className="border-b border-[var(--border-glass)] text-[var(--text-muted)] text-[9px] font-black capitalize tracking-[0.4em]">
 <th className="px-8 py-6 w-16 text-center">#</th>
 <th className="px-8 py-6">O'quvchi</th>
 <th className="px-8 py-6 text-center">To'lov holati</th>
 <th className="px-8 py-6 text-center">Imtiyoz</th>
 <th className="px-8 py-6">Telefon</th>
 <th className="px-8 py-6 text-center">Davomat</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-[var(--border-glass)]">
 <GroupsStudent
 students={filteredStudents}
 canEdit={canEditAttendanceToday}
 attendanceData={attendanceData}
 onAttendanceChange={refetchAttends}
 onLocalAttendanceChange={canEditAttendanceToday ? handleLocalAttendanceChange : undefined}
 localOverrides={mergedAttendanceForDate}
 groupId={group_id}
 selectedDate={selectedDate}
 mode="table"
 currentBranchId={branchID}
 markedStudents={markedStudents}
 onToggleMark={(id) => uiDispatch({ type:"TOGGLE_MARK", payload: id })}
 />
 </tbody>
 </table>
 </div>
 </div>
 );
};

export default AttendanceSection;
