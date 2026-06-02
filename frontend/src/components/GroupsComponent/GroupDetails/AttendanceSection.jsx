import React, { useState } from "react";
import { Users, Check, RotateCw, Search, Lock, Plus, Info, CheckCircle2, Trash2, X, UserMinus, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import api from "../../../tokenUpdater/updater";
import toast from "react-hot-toast";
import GroupsStudent from "../GrupsStudent";
import AddSpecialLessonModal from "./AddSpecialLessonModal";

const MONTH_NAMES = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
];


const AttendanceSection = ({
  group_id,
  groupinfo,
  groupStudents,
  filteredStudents,
  selectedDate,
  availableDates,
  lessonDates = [],
  attendanceData,
  isAttendanceConfirmed,
  canEditAttendance,
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
  queryClient,
  canTakeAttendance,
  selectedMonth,
  selectedYear,
  isCurrentMonth,
  onPrevMonth,
  onNextMonth,
  onGoToCurrentMonth
}) => {
  const [isSpecialLessonModalOpen, setIsSpecialLessonModalOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);

  // Use groupinfo's built-in special and canceled dates
  const specialDates = groupinfo.special_lesson_dates || [];
  const canceledDates = groupinfo.canceled_lesson_dates || [];

  const isSpecialDay = specialDates.includes(selectedDate);
  const isCanceledDay = canceledDates.includes(selectedDate);
  const isLessonDay = lessonDates.includes(selectedDate);

  const markedCount = Object.keys(markedStudents || {}).length;

  const handleCancelLesson = async () => {
    if (!confirm(`${selectedDate} sanasini dars kuni sifatida bekor qilmoqchimisiz?`)) return;
    setLoadingAction(true);
    try {
      await api.post(`/groups/groups/${group_id}/cancel-lesson/`, { date: selectedDate });
      toast.success("Dars kuni bekor qilindi");
      queryClient.invalidateQueries(['group-detail', group_id]);
      queryClient.invalidateQueries(['group-lesson-dates', group_id]);
      refetchAttends();
    } catch (error) {
      toast.error(error.response?.data?.error || "Xatolik yuz berdi");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleReactivateLesson = async () => {
    if (!confirm(`${selectedDate} sanasini dars kuni sifatida qayta faollashtirmoqchimisiz?`)) return;
    setLoadingAction(true);
    try {
      await api.post(`/groups/groups/${group_id}/reactivate-lesson/`, { date: selectedDate });
      toast.success("Dars kuni qayta faollashtirildi");
      queryClient.invalidateQueries(['group-detail', group_id]);
      queryClient.invalidateQueries(['group-lesson-dates', group_id]);
      refetchAttends();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Xatolik yuz berdi");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleBulkAction = async (actionType) => {
    if (!markedCount) return;
    
    const isArchive = actionType === 'archive';
    const actionName = isArchive ? "tizimdan butunlay o'chirib (arxivlab)" : "guruhdan chiqarib";
    const confirmed = window.confirm(`${markedCount} ta o'quvchini ${actionName} yubormoqchimisiz?`);
    if (!confirmed) return;
    
    const toastId = toast.loading("Amal bajarilmoqda...");
    try {
      const studentIds = Object.keys(markedStudents).map(id => Number(id));
      const endpoint = isArchive ? 'bulk-archive' : 'bulk-unenroll';
      
      await api.post(`/groups/groups/${group_id}/${endpoint}/`, { student_ids: studentIds });
      
      toast.success(`${markedCount} ta o'quvchi muvaffaqiyatli ${isArchive ? 'arxivlandi' : 'chiqarildi'}`, { id: toastId });
      uiDispatch({ type: "CLEAR_MARKS" });
      
      queryClient.invalidateQueries(['group-detail', group_id]);
      queryClient.invalidateQueries(['group-students', group_id]);
      refetchAttends();
    } catch (err) {
      toast.error(err.response?.data?.error || "Xatolik yuz berdi", { id: toastId });
    }
  };

  return (
    <div className="lux-card-static !p-0 overflow-hidden pb-10 shadow-xl border-[var(--border-glass)] relative">
      {/* BULK ACTION BAR - Floating Premium UI */}
      {markedCount > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[1000] animate-in fade-in zoom-in slide-in-from-bottom-10 duration-500 w-[95%] max-w-[800px] sm:w-auto">
          <div className="bg-[#0a0a0a]/95 backdrop-blur-md border border-[var(--gold)]/40 rounded-2xl p-2 sm:p-4 shadow-[0_25px_60px_rgba(0,0,0,0.8)] flex flex-col sm:flex-row items-center gap-3 sm:gap-6">
            
            {/* Left Info Section */}
            <div className="flex items-center gap-4 px-4 py-2 sm:border-r sm:border-white/10 sm:pr-6">
              <div className="w-10 h-10 rounded-xl bg-[var(--gold)] flex items-center justify-center text-black font-black text-lg shadow-[0_0_15px_rgba(184,134,11,0.3)]">
                {markedCount}
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black text-[var(--gold)] uppercase tracking-widest leading-none mb-1">Tanlangan</p>
                <p className="text-[12px] font-bold text-white whitespace-nowrap">O'quvchilar ro'yxati</p>
              </div>
            </div>

            {/* Actions Section */}
            <div className="flex items-center gap-2 w-full sm:w-auto px-2 pb-2 sm:pb-0">
              <button
                onClick={() => handleBulkAction('unenroll')}
                className="flex-1 sm:flex-none h-11 px-5 rounded-xl bg-white/5 text-white border border-white/10 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white/10 transition-all active:scale-95 group"
              >
                <UserMinus size={14} className="text-amber-500" /> 
                <span className="hidden xs:inline">Guruhdan Chiqarish</span>
                <span className="xs:hidden">Chiqarish</span>
              </button>

              <button
                onClick={() => handleBulkAction('archive')}
                className="flex-1 sm:flex-none h-11 px-5 rounded-xl bg-red-600/10 text-red-500 border border-red-500/20 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-600 hover:text-white transition-all shadow-lg active:scale-95 group"
              >
                <Trash2 size={14} className="group-hover:rotate-12 transition-transform" /> 
                <span className="hidden xs:inline">Tizimdan O'chirish</span>
                <span className="xs:hidden">O'chirish</span>
              </button>

              {/* Close Button Integrated */}
              <div className="w-[1px] h-8 bg-white/10 mx-1 hidden sm:block"></div>
              
              <button
                onClick={() => uiDispatch({ type: "CLEAR_MARKS" })}
                className="w-11 h-11 shrink-0 rounded-xl bg-white/5 text-white/40 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:text-white transition-all active:scale-95"
                title="Yopish"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Special Day Banner */}
      {isSpecialDay && !isCanceledDay && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-8 py-3 flex items-center justify-between animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-500">
              <Info size={16} />
            </div>
            <div>
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                Maxsus dars kuni
              </p>
              <p className="text-xs font-bold text-emerald-400/80">
                {selectedDate} sanasiga qo'shimcha dars kuni belgilangan
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30">
            <CheckCircle2 size={12} className="text-emerald-500" />
            <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Faol</span>
          </div>
        </div>
      )}

      {/* Canceled Day Banner */}
      {isCanceledDay && (
        <div className="bg-rose-500/10 border-b border-rose-500/20 px-8 py-3 flex items-center justify-between animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center text-rose-500">
              <X size={16} />
            </div>
            <div>
              <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">
                Bekor qilingan dars kuni
              </p>
              <p className="text-xs font-bold text-rose-400/80">
                {selectedDate} sanasidagi dars bekor qilingan
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/30">
            <X size={12} className="text-rose-500" />
            <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest">Bekor</span>
          </div>
        </div>
      )}

      <div className="p-2 sm:p-3 flex items-center justify-between gap-4 border-b border-[var(--border-glass)]">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--gold)] shadow-inner">
            <Users size={14} className="sm:size-[18px]" />
          </div>
          <div >
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

        <div className="flex items-center gap-2 sm:gap-3">
          {canTakeAttendance && (
            <button
              onClick={() => setIsSpecialLessonModalOpen(true)}
              className="flex items-center justify-center min-w-[40px] sm:w-auto sm:px-4 h-10 sm:h-11 border border-[var(--gold)]/30 text-[var(--gold)] rounded-xl font-black text-[10px] uppercase tracking-wider transition-all hover:bg-[var(--gold)]/10 active:scale-95 shadow-lg bg-[var(--bg-panel)]"
              title="Dars qo'shish"
            >
              <Plus size={18} /> <span className="hidden sm:inline ml-2">Dars qo'shish</span>
            </button>
          )}

          {canTakeAttendance && !isCanceledDay && (
            <button
              onClick={handleCancelLesson}
              disabled={loadingAction}
              className="flex items-center justify-center min-w-[40px] sm:w-auto sm:px-4 h-10 sm:h-11 border border-rose-500/30 text-rose-500 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all hover:bg-rose-500/10 active:scale-95 shadow-lg bg-[var(--bg-panel)] disabled:opacity-50"
              title="Darsni bekor qilish"
            >
              {loadingAction ? <Loader2 size={18} className="animate-spin" /> : <X size={18} />} <span className="hidden sm:inline ml-2">Darsni bekor qilish</span>
            </button>
          )}

          {canTakeAttendance && isCanceledDay && (
            <button
              onClick={handleReactivateLesson}
              disabled={loadingAction}
              className="flex items-center justify-center min-w-[40px] sm:w-auto sm:px-4 h-10 sm:h-11 border border-emerald-500/30 text-emerald-500 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all hover:bg-emerald-500/10 active:scale-95 shadow-lg bg-[var(--bg-panel)] disabled:opacity-50"
              title="Darsni qayta faollashtirish"
            >
              {loadingAction ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} <span className="hidden sm:inline ml-2">Qayta faollashtirish</span>
            </button>
          )}
          
          {canEditAttendance && (
            <button
              onClick={() => handleConfirmAttendance(isLessonDay)}
              className="flex items-center justify-center min-w-[44px] sm:w-auto sm:px-6 h-10 sm:h-11 bg-[var(--gold)] text-black rounded-xl font-black text-[10px] uppercase tracking-widest transition-all hover:opacity-90 active:scale-95 shadow-[var(--gold-glow)]"
              title="Tayyor"
            >
              <Check size={20} strokeWidth={3} /> <span className="hidden sm:inline ml-2">Tayyor</span>
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
            className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--text-secondary)] hover:text-[var(--gold)] hover:border-[var(--gold)]/30 transition-all shadow-lg active:scale-95"
            title="Yangilash"
          >
            <RotateCw size={18} />
          </button>
        </div>
      </div>

      {/* SEARCH PROTOCOL */}
      <div className="px-4 sm:px-6 py-2 border-b border-[var(--border-glass)]/10 bg-[var(--bg-void)]/20 shadow-inner">
        <div className="relative group">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--gold)] transition-colors">
            <Search size={14} />
          </div>
          <input
            type="text"
            placeholder="O'quvchi qidirish..."
            className="lux-input !py-2.5 !pl-10 !pr-4 !bg-[var(--bg-void)]/30 !border-[var(--border-glass)] !text-[10px] w-full"
            value={studentSearch}
            onChange={(e) => uiDispatch({ type: "SET_FIELD", field: "studentSearch", value: e.target.value })}
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
              Guruh boshlanish sanasi ({groupinfo.start_date || '---'}) yetib kelmaguncha davomat va boshqa logikalar cheklangan.
            </p>
          </div>
        </div>
      )}

      {/* MONTH NAVIGATION */}
      <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3 border-b border-[var(--border-glass)] bg-[var(--bg-void)]/30">
        <button
          onClick={onPrevMonth}
          className="flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--text-secondary)] hover:text-[var(--gold)] hover:border-[var(--gold)]/30 transition-all active:scale-95"
          title="O'tgan oy"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="flex items-center gap-3">
          <h4 className="text-sm sm:text-base font-black text-[var(--text-primary)] tracking-tight">
            {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
          </h4>
          {!isCurrentMonth && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[7px] font-black uppercase tracking-widest flex items-center gap-1">
              <Lock size={8} /> Arxiv
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isCurrentMonth && (
            <button
              onClick={onGoToCurrentMonth}
              className="h-8 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[8px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all active:scale-95"
              title="Joriy oyga qaytish"
            >
              Bugun
            </button>
          )}
          <button
            onClick={onNextMonth}
            disabled={isCurrentMonth}
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--text-secondary)] hover:text-[var(--gold)] hover:border-[var(--gold)]/30 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Keyingi oy"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* DATE PROTOCOLS */}
      <div className="px-4 sm:px-6 py-2 border-b border-[var(--border-glass)] flex gap-2 overflow-x-auto scrollbar-hide bg-[var(--bg-void)]/10">
        {availableDates.map((date) => (
          <button
            key={date}
            onClick={() => uiDispatch({ type: "SET_FIELD", field: "selectedDate", value: date })}
            className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-lg transition-all border whitespace-nowrap min-w-[55px] sm:min-w-[65px]
             ${selectedDate === date
                ? "bg-[var(--gold)] text-black border-transparent shadow-[var(--gold-glow)] scale-105"
                : "bg-[var(--bg-void)]/40 text-[var(--text-secondary)] border-[var(--border-glass)] hover:border-[var(--gold)]/20"}`}
          >
            <span className="text-[7px] font-black capitalize tracking-wider opacity-60 leading-none mb-0.5">{date.split('-')[2]}</span>
            <span className="text-[9px] font-bold tracking-tight leading-none">{new Date(date).toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()}</span>
          </button>
        ))}
      </div>


      {/* DIRECTORY LIST */}
      <div className="md:hidden p-4 space-y-4">
        <GroupsStudent
          students={filteredStudents}
          canEdit={canEditAttendance}
          attendanceData={attendanceData}
          onAttendanceChange={refetchAttends}
          onLocalAttendanceChange={canEditAttendance ? handleLocalAttendanceChange : undefined}
          localOverrides={mergedAttendanceForDate}
          groupId={group_id}
          selectedDate={selectedDate}
          isLessonDay={isLessonDay}
          mode="card"
          currentBranchId={branchID}
          markedStudents={markedStudents}
          onToggleMark={(id) => uiDispatch({ type: "TOGGLE_MARK", payload: id })}
        />
      </div>

      <div className="hidden  md:block overflow-x-auto text-[var(--text-primary)]">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[var(--border-glass)] text-[var(--text-muted)] text-[9px] font-black capitalize tracking-[0.4em]">
              <th className="px-8 py-6 w-16 text-center">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-[var(--border-glass)] bg-transparent checked:bg-[var(--gold)] transition-all cursor-pointer"
                  checked={markedCount === filteredStudents.length && filteredStudents.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      uiDispatch({ type: "SELECT_ALL_MARKS", payload: filteredStudents });
                    } else {
                      uiDispatch({ type: "CLEAR_MARKS" });
                    }
                  }}
                />
              </th>
              <th className="px-8 py-6">O'quvchi</th>
              <th className="px-8 py-6 text-center">To'lov holati</th>
              <th className="px-8 py-6 text-center">Imtiyoz</th>
              <th className="px-8 py-6">Telefon</th>
              <th className="px-8 py-6 text-center">Davomat</th>
              <th className="px-8 py-6 text-center">Amallar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-glass)]">
            <GroupsStudent
              students={filteredStudents}
              canEdit={canEditAttendance}
              attendanceData={attendanceData}
              onAttendanceChange={refetchAttends}
              onLocalAttendanceChange={canEditAttendance ? handleLocalAttendanceChange : undefined}
              localOverrides={mergedAttendanceForDate}
              groupId={group_id}
              selectedDate={selectedDate}
              isLessonDay={isLessonDay}
              mode="table"
              currentBranchId={branchID}
              markedStudents={markedStudents}
              onToggleMark={(id) => uiDispatch({ type: "TOGGLE_MARK", payload: id })}
            />
          </tbody>
        </table>
      </div>
      <AddSpecialLessonModal
        isOpen={isSpecialLessonModalOpen}
        onClose={() => setIsSpecialLessonModalOpen(false)}
        groupId={group_id}
        onAdded={() => {
          queryClient.invalidateQueries(['group-lesson-dates', group_id]);
          refetchAttends();
        }}
      />
    </div>
  );
};


export default AttendanceSection;
