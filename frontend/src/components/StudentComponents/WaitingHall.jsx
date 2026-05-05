import React, { useState } from"react";
import { useOutletContext } from"react-router-dom";
import { UserPlus, Search, Loader2, LayoutGrid } from"lucide-react";
import { get_user_info } from"../Authorized/getRole";

// Hooks
import { useWaitingHall } from"./WaitingHall/useWaitingHall";

// Components
import WaitingStudentCard from"./WaitingHall/WaitingStudentCard";
import AddStudentModal from"./WaitingHall/AddStudentModal";
import AssignGroupModal from"./WaitingHall/AssignGroupModal";

export default function WaitingHall() {
 const outletContext = useOutletContext();
 const branchIdFromOutlet = outletContext?.branchId;
 const userInfo = get_user_info();

 const [searchTerm, setSearchTerm] = useState("");
 const [showAddModal, setShowAddModal] = useState(false);
 const [showAssignModal, setShowAssignModal] = useState(null);

 const activeBranchId = userInfo?.role ==="super_admin" ? branchIdFromOutlet : userInfo?.branch_id;

 const {
 students,
 loading,
 groups,
 loadingGroups,
 fetchGroups,
 handleDelete,
 handleAssignToGroup,
 handleAddStudent
 } = useWaitingHall(activeBranchId);

 const filteredStudents = students.filter(s =>
 s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
 s.phone.includes(searchTerm) ||
 (s.subject && s.subject.toLowerCase().includes(searchTerm.toLowerCase()))
 );

 const onAssignClick = (student) => {
 setShowAssignModal(student);
 fetchGroups();
 };

 const handleAssign = async (studentId, groupId) => {
 const success = await handleAssignToGroup(studentId, groupId);
 if (success) setShowAssignModal(null);
 };

 return (
 <div className="animate-lux-fade">
 {/* BACKGROUND DECOR */}
 <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
 <div className="absolute top-[10%] left-[5%] w-[400px] h-[400px] bg-[var(--gold)]/5 rounded-full blur-[100px] animate-pulse"></div>
 </div>

 {/* HEADER SECTION */}
 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
 <div>
 <h1 className="gold-text text-3xl md:text-4xl font-black mb-2 flex items-center gap-3">
 Kutishlar Zali
 </h1>
 <p className="text-[var(--text-secondary)] text-sm max-w-lg">
 Guruhga qo'shilishi rejalashtirilgan o'quvchilar tahlili va boshqaruvi.
 </p>
 </div>
 <button
 onClick={() => setShowAddModal(true)}
 className="lux-btn lux-btn-primary flex items-center gap-3 py-3 px-8 group shadow-[var(--gold-glow)]"
 >
 <UserPlus size={18} className="group-hover:scale-110 transition-transform" />
 <span className="text-[11px] font-black capitalize tracking-widest">Yangi Reja</span>
 </button>
 </div>

 {/* SEARCH CARD */}
 <div className="lux-card mb-8 p-0.5 max-w-xl flex items-center bg-[var(--bg-panel)]/50 border border-[var(--border-glass)] backdrop-blur-md">
 <div className="flex-1 relative flex items-center">
 <Search size={16} className="absolute left-4 text-[var(--text-muted)]" />
 <input
 type="text"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 placeholder="Qidiruv..."
 className="w-full h-11 bg-transparent pl-12 pr-6 text-xs text-[var(--text-primary)] border-none focus:ring-0 outline-none font-medium placeholder:text-[var(--text-muted)]/50"
 />
 </div>
 </div>

 {/* STUDENTS LIST */}
 {loading ? (
 <div className="flex flex-col items-center justify-center py-32 gap-4">
 <Loader2 size={40} className="animate-spin text-[var(--gold)]" />
 <p className="text-[10px] font-black capitalize tracking-[0.2em] text-[var(--text-muted)]">O'quvchilar yuklanmoqda...</p>
 </div>
 ) : filteredStudents.length === 0 ? (
 <div className="lux-card p-24 text-center border-dashed border-2 border-[var(--border-glass)] bg-transparent opacity-60">
 <div className="w-16 h-16 bg-[var(--bg-panel)] rounded-2xl flex items-center justify-center mx-auto mb-6 text-[var(--text-muted)]">
 <LayoutGrid size={32} />
 </div>
 <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">Hozircha hech kim yo'q</h3>
 <p className="text-xs text-[var(--text-secondary)]">Kutishlar zalida birorta ham o'quvchi topilmadi.</p>
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
 {filteredStudents.map((student) => (
 <WaitingStudentCard
 key={student.id}
 student={student}
 onDelete={handleDelete}
 onAssignClick={onAssignClick}
 />
 ))}
 </div>
 )}

 <AddStudentModal
 isOpen={showAddModal}
 onClose={() => setShowAddModal(false)}
 onAdd={handleAddStudent}
 />

 <AssignGroupModal
 student={showAssignModal}
 isOpen={!!showAssignModal}
 onClose={() => setShowAssignModal(null)}
 groups={groups}
 loadingGroups={loadingGroups}
 onAssign={handleAssign}
 />
 </div>
 );
}
