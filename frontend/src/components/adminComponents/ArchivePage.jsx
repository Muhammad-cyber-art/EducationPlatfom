import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useOutletContext } from "react-router-dom";
import api from "../../tokenUpdater/updater";
import toast from "react-hot-toast";
import GoBackButton from "../sendback";
import { useCurrentBranch } from "../Authorized/useBranchId";
import { get_user_info } from "../Authorized/getRole";
import {
    Trash2, RotateCcw, User, Users, GraduationCap,
    Loader2, AlertCircle, CheckCircle2, Calendar, Hash,
    ArrowUpRight, Circle, Layers, Search
} from "lucide-react";

export default function ArchivePage() {
    const [activeTab, setActiveTab] = useState("students");
    const queryClient = useQueryClient();
    const user_info = get_user_info();

    const { currentBranchId } = useCurrentBranch();
    const outletContext = useOutletContext() || {};
    const { branchId: superAdminBranchId } = outletContext;

    const activeBranchId = user_info?.role === "super_admin"
        ? superAdminBranchId
        : currentBranchId;

    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    // Debounce effects
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const { data: archivedStudents = [], isLoading: studentsLoading } = useQuery({
        queryKey: ["archived-students", debouncedSearch],
        queryFn: () => api.get(`/archive/students/?search=${debouncedSearch}`).then((res) => res.data),
    });

    const { data: archivedStaff = [], isLoading: staffLoading } = useQuery({
        queryKey: ["archived-staff", debouncedSearch],
        queryFn: () => api.get(`/archive/staff/?search=${debouncedSearch}`).then((res) => res.data),
    });

    const { data: archivedGroups = [], isLoading: groupsLoading } = useQuery({
        queryKey: ["archived-groups", debouncedSearch],
        queryFn: () => api.get(`/archive/groups/?search=${debouncedSearch}`).then((res) => res.data),
    });

    const restoreStudentMutation = useMutation({
        mutationFn: (id) => api.post(`/archive/students/${id}/restore/`),
        onSuccess: () => {
            queryClient.invalidateQueries(["archived-students"]);
            toast.success("O'quvchi faol holatga qaytarildi.");
        }
    });

    const restoreStaffMutation = useMutation({
        mutationFn: (id) => api.post(`/archive/staff/${id}/restore/`),
        onSuccess: (response) => {
            queryClient.invalidateQueries(["archived-staff"]);
            toast.success("Xodim ma'lumotlari tiklandi.");
        }
    });

    const restoreGroupMutation = useMutation({
        mutationFn: (id) => api.post(`/archive/groups/${id}/restore/`),
        onSuccess: () => {
            queryClient.invalidateQueries(["archived-groups"]);
            toast.success("Guruh qayta faollashtirildi.");
        }
    });

    const deleteStudentMutation = useMutation({
        mutationFn: (id) => api.delete(`/archive/students/${id}/`),
        onSuccess: () => {
            queryClient.invalidateQueries(["archived-students"]);
            toast.success("Shaxs yozuvlardan o'chirildi.");
        }
    });

    const deleteStaffMutation = useMutation({
        mutationFn: (id) => api.delete(`/archive/staff/${id}/`),
        onSuccess: () => {
            queryClient.invalidateQueries(["archived-staff"]);
            toast.success("Xodim yozuvlari o'chirildi.");
        }
    });

    const deleteGroupMutation = useMutation({
        mutationFn: (id) => api.delete(`/archive/groups/${id}/`),
        onSuccess: () => {
            queryClient.invalidateQueries(["archived-groups"]);
            toast.success("Guruh tarixi o'chirildi.");
        }
    });

    const handleDelete = (id, type) => {
        if (window.confirm("DIQQAT: Ushbu yozuvni butunlay o'chirib tashlaysizmi?")) {
            if (type === 'student') deleteStudentMutation.mutate(id);
            if (type === 'staff') deleteStaffMutation.mutate(id);
            if (type === 'group') deleteGroupMutation.mutate(id);
        }
    };

    const filteredStudents = archivedStudents.filter(
        (s) => !activeBranchId || s.metadata?.branch === activeBranchId
    );

    const filteredStaff = archivedStaff.filter(
        (s) => !activeBranchId || s.branch_id === activeBranchId || s.metadata?.branch === activeBranchId
    );

    const filteredGroups = archivedGroups.filter(
        (g) => !activeBranchId || g.metadata?.branch === activeBranchId
    );

    const tabs = [
        { id: "students", label: "O'quvchilar", icon: User, count: filteredStudents.length },
        { id: "staff", label: "Xodimlar", icon: Users, count: filteredStaff.length },
        { id: "groups", label: "Guruhlar", icon: Layers, count: filteredGroups.length },
    ];

    const formatDate = (dateString) => {
        if (!dateString) return "---";
        return new Date(dateString).toLocaleDateString(undefined, {
            year: "numeric", month: "short", day: "numeric",
        }).toUpperCase();
    };

    const LoadingState = () => (
        <div className="flex flex-col items-center justify-center py-40">
            <Loader2 className="animate-spin text-[var(--gold)] mb-6" size={40} />
            <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40 italic">Ma'lumotlar yuklanmoqda...</p>
        </div>
    );

    const EmptyState = ({ label }) => (
        <div className="flex flex-col items-center justify-center py-40 text-[var(--text-muted)]">
            <Layers size={48} className="mb-6 opacity-20" />
            <p className="text-[10px] font-black uppercase tracking-[0.4em] italic mb-2">Arxiv bo'sh</p>
            <p className="text-[9px] font-bold uppercase tracking-widest opacity-40">Arxivlangan {label} topilmadi.</p>
        </div>
    );

    return (
        <div className="animate-lux-fade space-y-10 pb-20">
            {/* Atmosphere Background */}
            <div className="fixed inset-0 pointer-events-none -z-10">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-radial-gradient opacity-[0.03]"></div>
                <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[var(--gold)]/5 rounded-full blur-[120px]"></div>
            </div>

            {/* HEADER AREA */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[var(--border-glass)]">
                <div className="flex items-center gap-6">
                    <GoBackButton />
                    <div>
                        <h1 className="text-4xl font-black text-[var(--text-primary)] tracking-tighter uppercase mb-2 italic">Arxivlar Tarixi</h1>
                        <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-[0.3em] flex items-center gap-3">
                            <Hash size={12} className="text-[var(--gold)]" /> O'chirilgan Va Tasdiqlangan Ma'lumotlar
                        </p>
                    </div>
                </div>

                {/* SEARCH BAR */}
                <div className="flex-1 max-w-md relative group">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--gold)]" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Arxivdan qidirish..."
                        className="lux-input !pl-12 !py-4 w-full"
                    />
                </div>
            </div>

            {/* TABS GRID */}
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-4 px-10 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] transition-all whitespace-nowrap border shrink-0
                            ${activeTab === tab.id
                                ? "bg-[var(--gold)] text-black border-transparent shadow-[var(--gold-glow)] scale-105"
                                : "bg-[var(--bg-void)]/60 text-[var(--text-secondary)] border-[var(--border-glass)] hover:border-[var(--gold)]/30"}`}
                    >
                        <tab.icon size={16} />
                        <span>{tab.label}</span>
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-black ${activeTab === tab.id ? "bg-black/10" : "bg-[var(--gold-dim)] text-[var(--gold)]"}`}>
                            {tab.count}
                        </div>
                    </button>
                ))}
            </div>

            {/* TABLE CONTAINER */}
            <div className="lux-card !p-0 overflow-hidden group">
                <div className="overflow-x-auto">
                    {activeTab === "students" && (studentsLoading ? <LoadingState /> : filteredStudents.length === 0 ? <EmptyState label="membership" /> : (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-[var(--border-glass)] text-[9px] font-black uppercase tracking-[0.4em] text-[var(--text-muted)] italic">
                                    <th className="px-8 py-6 w-16 text-center">#</th>
                                    <th className="px-8 py-6">O'quvchi ma'lumotlari</th>
                                    <th className="px-8 py-6 hidden md:table-cell">Oxirgi faol guruhi</th>
                                    <th className="px-8 py-6 hidden lg:table-cell">O'chirilgan sana</th>
                                    <th className="px-8 py-6 text-right">Amallar</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-glass)]">
                                {filteredStudents.map((item, i) => (
                                    <tr key={item.id} className="group/row hover:bg-[var(--gold-dim)] transition-colors">
                                        <td className="px-8 py-5 text-center text-[10px] font-black opacity-30">{(i + 1).toString().padStart(2, '0')}</td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--gold)]">
                                                    <User size={18} />
                                                </div>
                                                <p className="text-sm font-bold text-white uppercase tracking-tight">{item.full_name}</p>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-[10px] font-bold text-[var(--text-secondary)] hidden md:table-cell uppercase">{item.last_group_name || "GURUHSZ"}</td>
                                        <td className="px-8 py-5 text-[9px] font-black text-[var(--text-muted)] hidden lg:table-cell uppercase tracking-widest">{formatDate(item.archived_at)}</td>
                                        <td className="px-8 py-5 text-right space-x-3">
                                            <button onClick={() => restoreStudentMutation.mutate(item.id)} className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-black transition-all border border-emerald-500/20"><RotateCcw size={12} className="inline mr-2" /> Tiklash</button>
                                            <button onClick={() => handleDelete(item.id, 'student')} className="p-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-500/20"><Trash2 size={16} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ))}

                    {activeTab === "staff" && (staffLoading ? <LoadingState /> : filteredStaff.length === 0 ? <EmptyState label="delegates" /> : (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-[var(--border-glass)] text-[9px] font-black uppercase tracking-[0.4em] text-[var(--text-muted)] italic">
                                    <th className="px-8 py-6 w-16 text-center">#</th>
                                    <th className="px-8 py-6">Xodim ma'lumotlari</th>
                                    <th className="px-8 py-6 hidden md:table-cell">Vazifasi</th>
                                    <th className="px-8 py-6 hidden lg:table-cell">O'chirilgan sana</th>
                                    <th className="px-8 py-6 text-right">Amallar</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-glass)]">
                                {filteredStaff.map((item, i) => (
                                    <tr key={item.id} className="group/row hover:bg-[var(--gold-dim)] transition-colors">
                                        <td className="px-8 py-5 text-center text-[10px] font-black opacity-30">{(i + 1).toString().padStart(2, '0')}</td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-indigo-400">
                                                    <Users size={18} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <p className="text-sm font-bold text-white uppercase tracking-tight">{item.full_name}</p>
                                                    <p className="text-[8px] font-black text-[var(--gold)] uppercase tracking-[0.2em]">{item.phone}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-[10px] font-black text-white/50 hidden md:table-cell uppercase tracking-widest">{item.role}</td>
                                        <td className="px-8 py-5 text-[9px] font-black text-[var(--text-muted)] hidden lg:table-cell uppercase tracking-widest">{formatDate(item.archived_at)}</td>
                                        <td className="px-8 py-5 text-right space-x-3">
                                            <button onClick={() => restoreStaffMutation.mutate(item.id)} className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-black transition-all border border-emerald-500/20"><RotateCcw size={12} className="inline mr-2" /> Tiklash</button>
                                            <button onClick={() => handleDelete(item.id, 'staff')} className="p-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-500/20"><Trash2 size={16} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ))}

                    {activeTab === "groups" && (groupsLoading ? <LoadingState /> : filteredGroups.length === 0 ? <EmptyState label="units" /> : (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-[var(--border-glass)] text-[9px] font-black uppercase tracking-[0.4em] text-[var(--text-muted)] italic">
                                    <th className="px-8 py-6 w-16 text-center">#</th>
                                    <th className="px-8 py-6">Guruh nomi</th>
                                    <th className="px-8 py-6 hidden md:table-cell">Yo'nalish</th>
                                    <th className="px-8 py-6 hidden lg:table-cell">O'chirilgan sana</th>
                                    <th className="px-8 py-6 text-right">Amallar</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-glass)]">
                                {filteredGroups.map((item, i) => (
                                    <tr key={item.id} className="group/row hover:bg-[var(--gold-dim)] transition-colors">
                                        <td className="px-8 py-5 text-center text-[10px] font-black opacity-30">{(i + 1).toString().padStart(2, '0')}</td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-orange-400">
                                                    <Layers size={18} />
                                                </div>
                                                <p className="text-sm font-bold text-white uppercase tracking-tight">{item.full_name}</p>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-[10px] font-black text-white/50 hidden md:table-cell uppercase tracking-widest">{item.subject || "UMUMIY"}</td>
                                        <td className="px-8 py-5 text-[9px] font-black text-[var(--text-muted)] hidden lg:table-cell uppercase tracking-widest">{formatDate(item.archived_at)}</td>
                                        <td className="px-8 py-5 text-right space-x-3">
                                            <button onClick={() => restoreGroupMutation.mutate(item.id)} className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-black transition-all border border-emerald-500/20"><RotateCcw size={12} className="inline mr-2" /> Tiklash</button>
                                            <button onClick={() => handleDelete(item.id, 'group')} className="p-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-500/20"><Trash2 size={16} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ))}
                </div>
            </div>
        </div>
    );
}
