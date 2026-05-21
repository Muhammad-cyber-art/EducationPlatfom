import React from"react";
import { Loader2, LogOut as LogOutIcon } from"lucide-react";
import toast from"react-hot-toast";

// Hooks
import { useMentorProfile } from"./MentorProfile/useMentorProfile";

// Components
import MentorHeader from"./MentorProfile/MentorHeader";
import MentorEditForm from"./MentorProfile/MentorEditForm";
import MentorDashboard from"./MentorProfile/MentorDashboard";
import MentorPermissionsModal from"./MentorProfile/MentorPermissionsModal";
import StaffTransferModal from"../SuperAdmin/StaffTransferModal";
import GoBackButton from"../sendback";
import ThemeToggle from"../ThemeToggle";
import MentorsGroupCards from"./MentorsGroupCards";

export default function MentorProfilePage({ viewMode ="all" }) {
 const {
 state,
 dispatch,
 user_info,
 userData,
 isMentorLoading,
 staffBranches,
 isSuperAdmin,
 canEditMentor,
 handleUpdate,
 handleDelete,
 permMutation,
 navigate,
 queryClient,
 PERMISSION_LABELS
 } = useMentorProfile();

 const { mentor, mentorsGroup, isEditing, editData, showPassword, isPermModalOpen, isTransferModalOpen, permissions } = state;

 function LogOut() {
 if (window.confirm("Tizimdan chiqmoqchimisiz?")) {
 localStorage.clear();
 window.location.href = "/";
 }
 }

 if (isMentorLoading || !mentor.id) {
 return (
 <div className="flex items-center justify-center min-h-[400px]">
 <Loader2 size={32} className="text-[var(--gold)] animate-spin" />
 </div>
 );
 }

 const userRole = (userData.role || user_info?.role ||"").toLowerCase();

 return (
 <div className="p-3 sm:p-6 space-y-4 md:space-y-6 overflow-hidden">
 {/* TOP BAR */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 {user_info.role !=="mentor" && <GoBackButton />}
 </div>
 {(userRole !=="super_admin" && userRole !=="admin") && (
 <div className="flex items-center gap-2">
 <ThemeToggle />
 <button
 onClick={LogOut}
 className="p-2.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] hover:border-red-500/50 text-red-500 hover:text-red-400 transition-all group shadow-lg"
 title="Tizimdan chiqish"
 >
 <LogOutIcon size={18} className="group-hover:-translate-x-0.5 transition-transform" />
 </button>
 </div>
 )}
 </div>

 <MentorHeader 
 mentor={mentor}
 isEditing={isEditing}
 editData={editData}
 canEditMentor={canEditMentor}
 isSuperAdmin={isSuperAdmin}
 dispatch={dispatch}
 handleUpdate={handleUpdate}
 handleDelete={handleDelete}
 />

 {viewMode ==="groups" ? (
 <div className="space-y-10">
 <div className="flex items-center justify-between px-2">
 <div>
 <h2 className="text-xl font-bold text-[var(--text-primary)] capitalize tracking-tight">Guruhlar</h2>
 <p className="text-[10px] text-[var(--gold)] font-black capitalize tracking-[0.3em] mt-1">Ishchi maydoni taqsimoti</p>
 </div>
 <div className="flex items-center gap-6 px-6 py-3 bg-[var(--gold-dim)] rounded-2xl border border-[var(--gold)]/10 shadow-inner">
 <div className="text-center">
 <p className="text-sm font-black text-[var(--text-primary)]">{mentorsGroup.length}</p>
 <p className="text-[7px] font-black text-[var(--gold)] capitalize tracking-widest">Faol guruhlar</p>
 </div>
 <div className="w-px h-6 bg-[var(--gold)]/20"></div>
 <div className="text-center">
 <p className="text-sm font-black text-[var(--text-primary)]">
 {mentorsGroup.reduce((acc, g) => acc + (g.students_count || 0), 0)}
 </p>
 <p className="text-[7px] font-black text-[var(--gold)] capitalize tracking-widest">O'quvchilar</p>
 </div>
 </div>
 </div>
 <MentorsGroupCards mentorsGroups={mentorsGroup} navig={navigate} />
 </div>
 ) : (
 isEditing ? (
 <MentorEditForm 
 editData={editData}
 dispatch={dispatch}
 showPassword={showPassword}
 handleUpdate={handleUpdate}
 />
 ) : (
 <MentorDashboard 
 mentor={mentor}
 mentorsGroup={mentorsGroup}
 user_info={user_info}
 staffBranches={staffBranches}
 navigate={navigate}
 />
 )
 )}

 {isTransferModalOpen && (
 <StaffTransferModal
 isOpen={isTransferModalOpen}
 onClose={() => dispatch({ type:"TOGGLE_TRANSFER_MODAL", payload: false })}
 staffMember={mentor}
 onTransferSuccess={() => {
 queryClient.invalidateQueries(['mentor-details']);
 toast.success("Muvaffaqiyatli o'tkazildi.");
 }}
 />
 )}

 <MentorPermissionsModal 
 isOpen={isPermModalOpen}
 onClose={() => dispatch({ type:'TOGGLE_PERM_MODAL', payload: false })}
 labels={PERMISSION_LABELS}
 permissions={permissions}
 dispatch={dispatch}
 mutation={permMutation}
 />
 </div>
 );
}
