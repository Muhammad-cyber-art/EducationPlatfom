import React, { useEffect, useReducer, useCallback, useMemo, memo } from'react';
import toast from'react-hot-toast';
import { useParams, useNavigate } from'react-router-dom';
import GoBackButton from"../sendback";
import {
 Users,
 Settings,
 CalendarDays,
 Hash,
 Loader2,
 Trash2,
 Save,
 Award,
 TrendingUp,
 ShieldCheck
} from"lucide-react";
import api from'../../tokenUpdater/updater';

// --- Reducer Logic ---
const initialState = {
 loading: true,
 saving: false,
 testData: null,
 students: [],
 maxScoreInput:'',
 maxScore:''
};

function reducer(state, action) {
 switch (action.type) {
 case'SET_LOADING':
 return { ...state, loading: action.payload };
 case'SET_SAVING':
 return { ...state, saving: action.payload };
 case'FETCH_SUCCESS':
 return {
 ...state,
 testData: action.payload.testData,
 students: action.payload.students,
 loading: false
 };
 case'UPDATE_STUDENT_SCORE':
 return {
 ...state,
 students: state.students.map(s =>
 s.id === action.payload.id ? { ...s, score: action.payload.value } : s
 )
 };
 case'SET_MAX_SCORE_INPUT':
 return { ...state, maxScoreInput: action.payload };
 case'SET_MAX_SCORE':
 return { ...state, maxScore: action.payload };
 default:
 return state;
 }
}

// --- Sub-components (Memoized) ---
const StudentRow = memo(({ student, maxScore, onScoreChange }) => {
 const initials = useMemo(() =>
 student.name.split('').map(n => n[0]).join('').slice(0, 2),
 [student.name]);

 return (
 <tr className="hover:bg-[var(--gold-dim)]/30 transition-all group">
 <td className="px-8 py-3">
 <div className="flex items-center gap-3">
 <div className="text-[10px] font-black text-[var(--gold)]/50">
 {initials}
 </div>
 <p className="text-[11px] font-bold text-[var(--text-primary)] capitalize group-hover:text-[var(--gold)] transition-colors">
 {student.name.toLowerCase()}
 </p>
 </div>
 </td>
 <td className="px-8 py-3">
 <div className="flex justify-center">
 <div className="relative w-full max-w-[140px]">
 <div className="flex items-center lux-input !py-0 !px-2 !h-9 overflow-hidden shadow-inner">
 <input
 type="text"
 value={student.score}
 onChange={(e) => onScoreChange(student.id, e.target.value)}
 placeholder="Ball"
 className={`bg-transparent border-none outline-none font-bold text-[11px] h-full min-w-0 ${maxScore ?'flex-1 text-right pr-1' :'w-full text-center'}`}
 />
 {maxScore && (
 <div className="text-[var(--text-muted)] font-black text-[9px] flex-none text-left pl-1 pointer-events-none whitespace-nowrap">
 / {maxScore}
 </div>
 )}
 </div>
 </div>
 </div>
 </td>
 </tr>
 );
});

const StudentCardMobile = memo(({ student, maxScore, onScoreChange }) => {
 const initials = useMemo(() =>
 student.name.split('').map(n => n[0]).join('').slice(0, 2),
 [student.name]);

 return (
 <div className="bg-[var(--bg-void)]/40 border border-[var(--border-glass)] rounded-xl p-3 flex items-center justify-between gap-3">
 <div className="flex items-center gap-3 overflow-hidden">
 <div className="text-[10px] font-black text-[var(--gold)]/60 min-w-[24px]">
 {initials}
 </div>
 <p className="text-[11px] font-bold text-[var(--text-primary)] truncate capitalize">
 {student.name.toLowerCase()}
 </p>
 </div>

 <div className="w-32 flex-shrink-0">
 <div className="flex items-center justify-center lux-input !py-0 !px-0 !h-9 overflow-hidden">
 <input
 type="text"
 value={student.score}
 onChange={(e) => onScoreChange(student.id, e.target.value)}
 placeholder="Ball"
 className={`bg-transparent border-none outline-none font-bold text-[11px] h-full min-w-0 ${maxScore ?'flex-1 text-right pr-1' :'w-full text-center'}`}
 />
 {maxScore && (
 <div className="text-[var(--text-muted)] font-black text-[9px] flex-1 text-left pl-1 pointer-events-none whitespace-nowrap overflow-hidden">
 / {maxScore}
 </div>
 )}
 </div>
 </div>
 </div>
 );
});

// --- Main Component ---
const MockTestDetails = () => {
 const { test_id } = useParams();
 const navigate = useNavigate();
 const [state, dispatch] = useReducer(reducer, initialState);

 const { loading, saving, testData, students, maxScoreInput, maxScore } = state;

 useEffect(() => {
 const fetchTestDetails = async () => {
 try {
 const res = await api.get(`/homework_attends/mock-tests/${test_id}/`);
 const formattedTestData = {
 id: res.data.id,
 subject: res.data.subject,
 type: res.data.type,
 date: res.data.date,
 group_name: res.data.group_name
 };

 const formattedStudents = (res.data.students_status || []).map(s => {
 let displayScore = s.score ||'';
 if (displayScore.includes('/')) {
 displayScore = displayScore.split('/')[0].trim();
 }
 return {
 id: s.id,
 name: s.student_name,
 score: displayScore
 };
 });

 dispatch({
 type:'FETCH_SUCCESS',
 payload: { testData: formattedTestData, students: formattedStudents }
 });
 } catch (err) {
 console.error("Failed to fetch test details", err);
 dispatch({ type:'SET_LOADING', payload: false });
 }
 };

 if (test_id) {
 fetchTestDetails();
 }
 }, [test_id]);

 const handleScoreChange = useCallback((id, value) => {
 dispatch({ type:'UPDATE_STUDENT_SCORE', payload: { id, value } });
 }, []);

 const handleSave = useCallback(async () => {
 dispatch({ type:'SET_SAVING', payload: true });
 let successCount = 0;
 let failCount = 0;

 try {
 for (const s of students) {
 // Agar ball kiritilmagan bo'lsa, bu o'quvchini tashlab ketamiz (na saqlanadi, na xabar boradi)
 if (s.score ==="" || s.score === null) continue;

 try {
 const finalScore = maxScore ? `${s.score} / ${maxScore}` : String(s.score);
 await api.patch(`/homework_attends/mock-tests/${Number(test_id)}/update_student_score/`, {
 result_id: Number(s.id),
 score: finalScore
 });
 successCount++;
 } catch (e) {
 console.error(`Error saving score for ${s.name}:`, e.response?.data || e.message);
 failCount++;
 }
 }

 if (failCount === 0) {
 toast.success("Barcha natijalar muvaffaqiyatli saqlandi!");
 } else if (successCount > 0) {
 toast.error(`${failCount} ta o'quvchida xatolik yuz berdi.`);
 } else {
 toast.error("Hech bir natija saqlanmadi.");
 }
 } catch (err) {
 console.error("General error in handleSave:", err);
 toast.error("Tizimda kutilmagan xatolik");
 } finally {
 dispatch({ type:'SET_SAVING', payload: false });
 }
 }, [students, maxScore, test_id]);

 const handleDeleteTest = useCallback(async () => {
 if (window.confirm("Bu testni o'chirib tashlamoqchimisiz?")) {
 try {
 await api.delete(`/homework_attends/mock-tests/${test_id}/`);
 toast.success("Test o'chirildi");
 navigate(-1);
 } catch (err) {
 console.error("Error deleting test:", err);
 }
 }
 }, [test_id, navigate]);

 const handleSetMaxScore = useCallback(() => {
 if (maxScoreInput) {
 dispatch({ type:'SET_MAX_SCORE', payload: maxScoreInput });
 toast.success(`Maksimal ball: ${maxScoreInput}`);
 }
 }, [maxScoreInput]);

 // Derived Data
 const studentCount = useMemo(() => students.length, [students]);

 if (loading) return (
 <div className="min-h-screen bg-[var(--bg-void)] flex flex-col items-center justify-center gap-4">
 <Loader2 className="animate-spin text-[var(--gold)]" size={32} />
 <p className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-[0.3em]">Yuklanmoqda...</p>
 </div>
 );

 if (!testData) return (
 <div className="min-h-screen bg-[var(--bg-void)] flex items-center justify-center text-[var(--text-muted)] font-bold capitalize tracking-widest text-center">
 MA'LUMOT TOPILMADI
 </div>
 );

 return (
 <div className="min-h-screen bg-[var(--bg-void)] p-3 md:p-8 text-[var(--text-primary)] font-sans selection:bg-[var(--gold)]/30 animate-lux-fade">
 <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
 <div className="absolute top-1/4 -right-20 w-80 h-80 rounded-full blur-[100px] bg-[var(--gold)] opacity-5"></div>
 <div className="absolute bottom-1/4 -left-20 w-64 h-64 rounded-full blur-[80px] bg-[var(--gold)] opacity-5"></div>
 </div>

 <div className="max-w-[1100px] mx-auto space-y-6 md:space-y-8">
 {/* Header */}
 <div className="lux-card !p-5 md:!p-8 relative overflow-hidden group">
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
 <div className="flex items-start md:items-center gap-5">
 <GoBackButton />
 <div>
 <div className="flex items-center gap-3 mb-1">
 <h2 className="text-xl md:text-2xl font-bold tracking-tight capitalize">{testData.subject}</h2>
 <div className="hidden sm:flex bg-[var(--gold-dim)] text-[var(--gold)] px-2 py-0.5 rounded border border-[var(--gold)]/20 text-[9px] font-black tracking-widest items-center gap-1">
 <Hash size={10} /> {test_id}
 </div>
 </div>
 <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
 <p className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-[0.2em] flex items-center gap-2">
 <span className="w-1.5 h-1.5 bg-[var(--gold)] rounded-full shadow-[0_0_5px_var(--gold)]"></span>
 {testData.type}
 </p>
 <p className="text-[9px] font-black text-[var(--gold)] capitalize tracking-[0.2em]">
 {testData.group_name}
 </p>
 </div>
 </div>
 </div>

 <div className="flex items-center justify-between md:justify-end gap-3 border-t md:border-t-0 border-[var(--border-glass)] pt-4 md:pt-0">
 <div className="flex items-center gap-2.5 px-4 py-2 bg-[var(--bg-void)]/40 rounded-xl border border-[var(--border-glass)] shadow-inner">
 <CalendarDays size={14} className="text-[var(--gold)] opacity-60" />
 <span className="text-[10px] font-black text-[var(--text-secondary)] capitalize tracking-[0.1em]">
 {testData.date}
 </span>
 </div>

 <button
 onClick={handleDeleteTest}
 className="w-10 h-10 bg-red-500/5 text-red-500 border border-red-500/10 rounded-xl hover:bg-red-500 hover:text-white transition-all flex items-center justify-center"
 title="Testni o'chirish"
 >
 <Trash2 size={18} />
 </button>
 </div>
 </div>
 </div>

 {/* Analytics */}
 <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
 <div className="lux-card !p-4 flex items-center gap-3">
 <div className="p-2.5 bg-[var(--gold-dim)] rounded-xl text-[var(--gold)]">
 <Users size={18} />
 </div>
 <div className="overflow-hidden">
 <p className="text-[8px] font-black text-[var(--text-muted)] capitalize tracking-wider truncate text-ellipsis">O'quvchilar</p>
 <p className="text-sm font-bold truncate">{studentCount} ta</p>
 </div>
 </div>
 <div className="lux-card !p-4 flex items-center gap-3">
 <div className="p-2.5 bg-[var(--gold-dim)] rounded-xl text-[var(--gold)]">
 <Award size={18} />
 </div>
 <div className="overflow-hidden">
 <p className="text-[8px] font-black text-[var(--text-muted)] capitalize tracking-wider truncate text-ellipsis">O'zlashtirish</p>
 <p className="text-sm font-bold truncate">Standard</p>
 </div>
 </div>
 <div className="lux-card !p-4 col-span-2 md:col-span-1 flex items-center gap-3">
 <div className="p-2.5 bg-[var(--gold-dim)] rounded-xl text-[var(--gold)]">
 <ShieldCheck size={18} />
 </div>
 <div className="overflow-hidden">
 <p className="text-[8px] font-black text-[var(--text-muted)] capitalize tracking-wider truncate text-ellipsis">Holati</p>
 <p className="text-sm font-bold truncate text-emerald-500">Tasdiqlangan</p>
 </div>
 </div>
 </div>

 {/* Main Content */}
 <div className="lux-card !p-0 overflow-hidden shadow-xl border border-[var(--border-glass)]">
 <div className="px-6 py-5 md:px-10 md:py-6 border-b border-[var(--border-glass)] bg-[var(--bg-panel)]/30 flex flex-col sm:flex-row items-center justify-between gap-4">
 <div className="flex items-center gap-4 w-full sm:w-auto">
 <TrendingUp size={20} className="text-[var(--gold)]" />
 <div>
 <h3 className="text-sm md:text-base font-bold text-[var(--text-primary)] tracking-tight capitalize">Natijalar</h3>
 <p className="text-[8px] font-bold text-[var(--text-muted)] capitalize tracking-[0.2em] hidden sm:block">Ballarni tahrirlash</p>
 </div>
 </div>

 <div className="flex items-center flex-wrap justify-center sm:justify-end gap-3 w-full sm:w-auto">
 <div className="flex items-center gap-1.5 bg-[var(--bg-void)]/50 p-1 rounded-lg border border-[var(--border-glass)]">
 <div className="relative">
 <input
 type="number"
 value={maxScoreInput}
 onChange={(e) => dispatch({ type:'SET_MAX_SCORE_INPUT', payload: e.target.value })}
 placeholder="Max ball"
 className="bg-transparent border-none outline-none text-[9px] font-bold px-1.5 w-16 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] placeholder:font-normal"
 />
 </div>
 <button
 onClick={handleSetMaxScore}
 className="h-6 px-2 bg-[var(--gold-dim)] text-[var(--gold)] hover:bg-[var(--gold)] hover:text-black transition-all rounded-md text-[8px] font-black capitalize tracking-wider"
 >
 OK
 </button>
 </div>

 <button
 onClick={handleSave}
 disabled={saving}
 className="lux-btn lux-btn-primary !px-6 !h-10 !text-[10px] shadow-lg active:scale-95 disabled:opacity-50"
 >
 {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
 <span>Saqlash</span>
 </button>
 </div>
 </div>

 {/* Mobile View */}
 <div className="block md:hidden p-3 space-y-2">
 {students.map((student) => (
 <StudentCardMobile
 key={student.id}
 student={student}
 maxScore={maxScore}
 onScoreChange={handleScoreChange}
 />
 ))}
 </div>

 {/* Desktop View */}
 <div className="hidden md:block overflow-x-auto">
 <table className="w-full text-left">
 <thead>
 <tr className="text-[var(--text-muted)] text-[8px] font-black capitalize tracking-[0.3em] border-b border-[var(--border-glass)]">
 <th className="px-8 py-4">O'quvchi ismi-familiyasi</th>
 <th className="px-8 py-4 text-center">Natija</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-[var(--border-glass)]">
 {students.map((student) => (
 <StudentRow
 key={student.id}
 student={student}
 maxScore={maxScore}
 onScoreChange={handleScoreChange}
 />
 ))}
 </tbody>
 </table>
 </div>

 {students.length === 0 && (
 <div className="text-center py-16 text-[var(--text-muted)] font-black capitalize tracking-[0.2em] text-[10px]">
 Ma'lumotlar topilmadi.
 </div>
 )}
 </div>
 </div>
 </div>
 );
};

export default MockTestDetails;
