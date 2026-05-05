import React, { useEffect, useState } from'react';
import GoBackButton from'../sendback';
import { useNavigate, useOutletContext } from"react-router-dom";
import AdminCard from'../adminComponents/AdminCard';
import api from'../../tokenUpdater/updater';
import toast from'react-hot-toast';
import { UserPlus, Users, Loader2, ShieldCheck, Plus } from"lucide-react";
import { useQuery } from"@tanstack/react-query";
import { get_user_info } from'../Authorized/getRole';

const AdminList = () => {
 const { branchId } = useOutletContext() || {};
 const navigate = useNavigate();
 const [admin, setAdmin] = useState([]);
 const [loading, setLoading] = useState(false);

 // User details (Cache: Infinity)
 const { data: userData = {} } = useQuery({
 queryKey: ['user-me'],
 queryFn: () => api.get('/user/me/').then(res => res.data),
 staleTime: Infinity,
 });

 const userInfo = get_user_info();
 const perms = userData.permissions || {};
 const isSuperAdmin = userData.role ==="super_admin" || userInfo?.role ==="super_admin";

 // Super admin always has access
 const canCreateAdmin = isSuperAdmin || perms.branches === true;

 useEffect(() => {
 // Explicitly allow if user is super_admin regardless of perms.branches
 if (userData.id && !isSuperAdmin && perms.branches === false) {
 toast.error("Administratorlar bo'limiga kirish huquqi yo'q!");
 navigate(-1);
 }
 }, [userData.id, perms.branches, isSuperAdmin, navigate]);

 const fetchAdmins = async () => {
 if (!branchId) return;
 setLoading(true);

 try {
 const res = await api.get(`/groups/admins/?branch_id=${branchId}`);
 setAdmin(res.data);
 } catch (err) {
 console.error(err);
 toast.error("Ma'lumotlarni yuklashda xatolik.");
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchAdmins();
 }, [branchId]);

 return (
 <div className="space-y-6 md:space-y-8 animate-lux-fade pb-10">
 {/* Atmosphere Background */}
 <div className="fixed inset-0 pointer-events-none -z-10">
 <div className="absolute top-1/4 right-0 w-96 h-96 bg-[var(--gold)]/5 rounded-full blur-[120px]"></div>
 </div>

 {/* HEADER SECTION */}
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 pb-6 border-b border-[var(--border-glass)]">
 <div className="flex items-center gap-4 md:gap-6">
 <GoBackButton />
 <div>
 <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)] tracking-tight">Administratorlar</h1>
 <p className="text-[9px] md:text-[10px] text-[var(--text-muted)] font-bold capitalize tracking-[0.2em] md:tracking-[0.3em] font-sans">
 Filial Administratorlari • {admin.length} NAFAR
 </p>
 </div>
 </div>

 {canCreateAdmin && (
 <button
 onClick={() => { navigate('admin_add') }}
 className="lux-btn lux-btn-primary !py-3 md:!py-3.5 !px-6 md:!px-8 !text-[10px] md:!text-[11px]"
 >
 <Plus size={16} />
 <span>Admin qo'shish</span>
 </button>
 )}
 </div>

 {/* CONTENT AREA */}
 <div className="relative min-h-[400px]">
 {/* Loading State */}
 {loading && (
 <div className="flex flex-col items-center justify-center py-24 md:py-32 space-y-4">
 <Loader2 className="text-[var(--gold)] animate-spin" size={32} md:size={40} />
 <p className="text-[9px] md:text-[10px] font-bold capitalize tracking-[0.3em] text-[var(--text-muted)]">Yuklanmoqda...</p>
 </div>
 )}

 {/* Empty State */}
 {!loading && admin.length === 0 && (
 <div className="lux-card !p-10 md:!p-20 text-center border-dashed border-[var(--border-glass)] opacity-30 !rounded-3xl">
 <Users size={40} md:size={48} className="mx-auto mb-4 md:mb-6 text-[var(--gold)]/50" />
 <p className="text-xs md:text-sm font-bold capitalize tracking-widest text-[var(--text-primary)]">Administratorlar topilmadi</p>
 <p className="text-[9px] md:text-[10px] mt-2 font-bold capitalize tracking-widest">Ushbu filialda administratorlar mavjud emas.</p>
 </div>
 )}

 {/* Admin Cards Grid - More spacious for larger cards */}
 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8 max-w-7xl mx-auto">
 {admin.map((item, index) => (
 <AdminCard key={index} data={item} />
 ))}
 </div>
 </div>
 </div>
 );
};

export default AdminList;