import React, { useState } from'react';
import { useNavigate } from'react-router-dom';
import GoBackButton from'../sendback';
import { get_user_info } from'../Authorized/getRole';
import SendMessageModal from'../Common/SendMessageModal';
import {
 LogOut as LogOutIcon,
 Phone,
 ShieldCheck,
 Send
} from"lucide-react";

const SuperAdminProfile = () => {
 const user_info = get_user_info() || {};
 const navigate = useNavigate();
 const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);

 function LogOut() {
 if (window.confirm("Tizimdan chiqmoqchimisiz?")) {
 localStorage.clear();
 window.location.href = "/";
 }
 }

 return (
 <div className="w-full flex-1 min-h-screen bg-[var(--bg-void)] text-[var(--text-primary)] font-sans pb-20 md:pb-8 animate-lux-fade">

 {/* --- HEADER --- */}
 <div className="bg-[var(--bg-panel)]/80 backdrop-blur-md border-b border-[var(--border-glass)] px-3 md:px-8 py-2.5 md:py-4 flex items-center justify-between sticky top-0 z-50">
 <div className="flex items-center gap-3">
 <GoBackButton />
 <h1 className="text-base md:text-xl font-bold text-[var(--text-primary)] tracking-tight">Profil</h1>
 </div>
 </div>

 {/* --- CONTENT --- */}
 <div className="p-4 md:p-8 max-w-lg mx-auto space-y-8 mt-4 md:mt-10">

 <div className="flex items-center gap-5">
 <div className="w-16 h-16 md:w-20 md:h-20 bg-[var(--gold-dim)] border border-[var(--gold)]/20 rounded-2xl flex items-center justify-center text-[var(--gold)] shadow-xl shadow-[var(--gold)]/10">
 <ShieldCheck size={32} />
 </div>
 <div>
 <h2 className="text-lg md:text-2xl font-black text-[var(--text-primary)] tracking-tighter">Super Admin</h2>
 <p className="text-[10px] md:text-xs text-[var(--gold)] font-black capitalize tracking-[0.2em]">{user_info.username ||"superadmin"}</p>
 </div>
 </div>

 <div className="space-y-4 pt-6 border-t border-[var(--border-glass)]">

 {/* Global Broadcast Button */}
 <button
 onClick={() => setIsMessageModalOpen(true)}
 className="w-full py-4 bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-black border border-[var(--gold)]/50 rounded-2xl text-[12px] md:text-sm font-black capitalize tracking-widest transition-all shadow-lg shadow-[var(--gold)]/20 active:scale-95 flex items-center justify-center gap-3"
 >
 <Send size={18} />
 Global Xabar Yuborish
 </button>

 <div className="flex items-center justify-between py-2 border-b border-[var(--border-glass)] mt-4">
 <div className="flex items-center gap-3 text-[var(--text-secondary)]">
 <Phone size={16} />
 <span className="text-[12px] md:text-sm font-medium">Telefon raqam</span>
 </div>
 <span className="text-[12px] md:text-sm font-bold text-[var(--text-primary)]">{user_info.phone_number ||"+998 -- --- -- --"}</span>
 </div>

 <button
 onClick={LogOut}
 className="w-full py-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 rounded-xl text-[12px] md:text-sm font-black capitalize tracking-widest transition-all shadow-lg shadow-red-900/5 active:scale-95 mt-4"
 >
 <LogOutIcon size={16} className="inline mr-2" />
 Tizimdan chiqish
 </button>
 </div>

 </div>

 {/* Message Modal */}
 {isMessageModalOpen && (
 <SendMessageModal
 isOpen={isMessageModalOpen}
 onClose={() => setIsMessageModalOpen(false)}
 groupId={null} // Global send
 showGlobalOption={true}
 />
 )}
 </div>
 );
};

export default SuperAdminProfile;
