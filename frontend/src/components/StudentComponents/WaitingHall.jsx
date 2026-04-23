import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useOutletContext, useLocation } from "react-router-dom";
import api from "../../tokenUpdater/updater";
import toast from "react-hot-toast";
import {
    UserPlus,
    Search,
    Loader2,
    Phone,
    BookOpen,
    Trash2,
    CheckCircle,
    Plus,
    Info,
    ChevronRight,
    UserCheck,
    X,
    LayoutGrid,
    Circle,
    User
} from "lucide-react";
import { get_user_info } from "../Authorized/getRole";

export default function WaitingHall() {
    const navigate = useNavigate();
    const location = useLocation();
    const outletContext = useOutletContext();
    const branchIdFromOutlet = outletContext?.branchId;
    const userInfo = get_user_info();

    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [showAddModal, setShowAddModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(null); // stores the student to assign
    const [groups, setGroups] = useState([]);
    const [loadingGroups, setLoadingGroups] = useState(false);

    // New Student Form State
    const [formData, setFormData] = useState({
        full_name: "",
        phone: "",
        subject: "",
        notes: ""
    });

    const activeBranchId = userInfo?.role === "super_admin" ? branchIdFromOutlet : userInfo?.branch_id;

    const fetchWaitingStudents = async () => {
        if (!activeBranchId) return;
        setLoading(true);
        try {
            const res = await api.get(`/groups/waiting-students/?branch=${activeBranchId}`);
            setStudents(res.data.results || res.data);
        } catch (error) {
            toast.error("Kutishlar zalini yuklashda xato!");
        } finally {
            setLoading(false);
        }
    };

    const fetchGroups = async () => {
        if (!activeBranchId) return;
        setLoadingGroups(true);
        try {
            const res = await api.get(`/groups/groups/?branch_id=${activeBranchId}`);
            setGroups(res.data.results || res.data);
        } catch (error) {
            toast.error("Guruhlarni yuklashda xato!");
        } finally {
            setLoadingGroups(false);
        }
    };

    useEffect(() => {
        fetchWaitingStudents();
    }, [activeBranchId]);

    const handleAddStudent = async (e) => {
        e.preventDefault();
        if (!formData.full_name || !formData.phone) {
            return toast.error("Ism va telefon majburiy!");
        }

        try {
            await api.post("/groups/waiting-students/", {
                ...formData,
                branch: activeBranchId
            });
            toast.success("O'quvchi kutishlar zaliga qo'shildi");
            setShowAddModal(false);
            setFormData({ full_name: "", phone: "", subject: "", notes: "" });
            fetchWaitingStudents();
        } catch (error) {
            toast.error("Qo'shishda xatolik!");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("O'quvchini ro'yxatdan o'chirmoqchimisiz?")) return;
        try {
            await api.delete(`/groups/waiting-students/${id}/`);
            toast.success("O'chirildi");
            fetchWaitingStudents();
        } catch (error) {
            toast.error("O'chirishda xatolik!");
        }
    };

    const handleAssignToGroup = async (groupId) => {
        if (!showAssignModal) return;
        try {
            await api.post(`/groups/waiting-students/${showAssignModal.id}/assign-to-group/`, {
                group_id: groupId
            });
            toast.success("O'quvchi guruhga muvaffaqiyatli biriktirildi!");
            setShowAssignModal(null);
            fetchWaitingStudents();
        } catch (error) {
            toast.error("Biriktirishda xatolik!");
        }
    };

    const filteredStudents = students.filter(s =>
        s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.phone.includes(searchTerm) ||
        (s.subject && s.subject.toLowerCase().includes(searchTerm.toLowerCase()))
    );

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
                    <span className="text-[11px] font-black uppercase tracking-widest">Yangi Reja</span>
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
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">O'quvchilar yuklanmoqda...</p>
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
                        <div
                            key={student.id}
                            className="lux-card group hover:translate-y-[-4px] transition-all duration-500 overflow-hidden"
                        >
                            {/* Card Header Background */}
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <UserCheck size={80} className="text-[var(--gold)]" />
                            </div>

                            <div className="p-6 relative">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-xl font-black text-[var(--gold)] shadow-[var(--gold-glow)] uppercase">
                                            {student.full_name.charAt(0)}
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-bold text-[var(--text-primary)] leading-tight">{student.full_name}</h4>
                                            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--gold)] mt-1 opacity-80">{student.subject || "Umumiy yo'nalish"}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                setShowAssignModal(student);
                                                fetchGroups();
                                            }}
                                            className="w-10 h-10 rounded-xl bg-[var(--gold-dim)] text-[var(--gold)] flex items-center justify-center hover:bg-[var(--gold)] hover:text-black transition-all border border-[var(--gold)]/20"
                                            title="Guruhga biriktirish"
                                        >
                                            <UserCheck size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(student.id)}
                                            className="w-10 h-10 rounded-xl bg-red-500/5 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all border border-red-500/10"
                                            title="O'chirish"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-4 mb-6">
                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-void)]/50 border border-[var(--border-glass)]">
                                        <Phone size={14} className="text-[var(--text-muted)]" />
                                        <span className="text-xs font-bold text-[var(--text-primary)]">{student.phone}</span>
                                    </div>
                                    {student.notes && (
                                        <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--bg-void)]/30">
                                            <Info size={14} className="text-[var(--text-muted)] mt-0.5 shrink-0" />
                                            <p className="text-[11px] text-[var(--text-secondary)] italic leading-relaxed">
                                                "{student.notes}"
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-[var(--border-glass)]">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                                        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                                            Qo'shilgan: {new Date(student.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ADD MODAL */}
            {showAddModal && createPortal(
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-xl animate-in fade-in duration-500" onClick={() => setShowAddModal(false)}></div>
                    <div className="lux-card w-full max-w-lg max-h-[90vh] relative z-10 animate-in zoom-in-95 duration-500 flex flex-col p-0 overflow-hidden border-[var(--gold)]/20 shadow-[0_30px_60px_-15px_rgba(184,134,11,0.2)]">
                        {/* Modal Header */}
                        <div className="p-8 border-b border-[var(--border-glass)] bg-gradient-to-r from-[var(--bg-panel)] to-[var(--bg-void)] relative overflow-hidden flex-shrink-0">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--gold)]/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
                            <div className="flex justify-between items-center relative z-10">
                                <div>
                                    <h3 className="text-2xl font-black gold-text uppercase tracking-tighter italic">O'quvchi rejalashtirish</h3>
                                    <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-[0.2em] mt-1">Kutishlar ro'yxatiga yangi yozuv qo'shish</p>
                                </div>
                                <button onClick={() => setShowAddModal(false)} className="w-10 h-10 rounded-xl bg-[var(--bg-void)]/50 border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-muted)] hover:text-white hover:border-[var(--gold)]/40 transition-all flex-shrink-0">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleAddStudent} className="p-8 space-y-6 bg-[var(--bg-panel)]/40 overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-1 gap-6">
                                <div className="group/field space-y-2">
                                    <label className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] px-1 flex items-center gap-2 group-focus-within/field:text-[var(--gold)] transition-colors">
                                        <Circle size={8} className="fill-[var(--gold)]/20" /> To'liq ismi
                                    </label>
                                    <div className="relative">
                                        <input
                                            autoFocus
                                            className="lux-input !py-4 !pl-12 text-sm font-bold w-full"
                                            value={formData.full_name}
                                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                            placeholder="Masalan: Ali Valiyev"
                                        />
                                        <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--gold)]/40" />
                                    </div>
                                </div>

                                <div className="group/field space-y-2">
                                    <label className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] px-1 flex items-center gap-2 group-focus-within/field:text-[var(--gold)] transition-colors">
                                        <Circle size={8} className="fill-[var(--gold)]/20" /> Telefon raqami
                                    </label>
                                    <div className="relative">
                                        <input
                                            className="lux-input !py-4 !pl-12 text-sm font-bold w-full"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            placeholder="+998 90 123 45 67"
                                        />
                                        <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--gold)]/40" />
                                    </div>
                                </div>

                                <div className="group/field space-y-2">
                                    <label className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] px-1 flex items-center gap-2 group-focus-within/field:text-[var(--gold)] transition-colors">
                                        <Circle size={8} className="fill-[var(--gold)]/20" /> Yo'nalish / Fan
                                    </label>
                                    <div className="relative">
                                        <input
                                            className="lux-input !py-4 !pl-12 text-sm font-bold w-full"
                                            value={formData.subject}
                                            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                            placeholder="Matematika, Ingliz tili..."
                                        />
                                        <BookOpen size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--gold)]/40" />
                                    </div>
                                </div>

                                <div className="group/field space-y-2">
                                    <label className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] px-1 flex items-center gap-2 group-focus-within/field:text-[var(--gold)] transition-colors">
                                        <Circle size={8} className="fill-[var(--gold)]/20" /> Qisqa izoh
                                    </label>
                                    <div className="relative">
                                        <textarea
                                            className="lux-input !py-4 !pl-12 text-xs font-bold min-h-[100px] resize-none w-full"
                                            value={formData.notes}
                                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                            placeholder="Talabaning darajasi yoki qo'shimcha istaklari..."
                                        />
                                        <Info size={16} className="absolute left-4 top-6 text-[var(--gold)]/40" />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    className="lux-btn lux-btn-primary w-full py-5 shadow-[var(--gold-glow)] flex items-center justify-center gap-3 relative overflow-hidden group/btn"
                                >
                                    <div className="absolute inset-0 bg-white/10 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300"></div>
                                    <Plus size={20} className="relative z-10" />
                                    <span className="text-[11px] font-black uppercase tracking-[0.4em] relative z-10">Ro'yxatga Qo'shish</span>
                                </button>
                            </div>
                        </form>

                        {/* Modal Footer Decorative */}
                        <div className="px-8 py-4 bg-[var(--bg-void)]/60 border-t border-[var(--border-glass)] flex items-center justify-center flex-shrink-0">
                            <p className="text-[7px] text-[var(--text-muted)] uppercase tracking-[0.5em] font-black">Secure Data Entry Protocol v2.0</p>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ASSIGN MODAL */}
            {showAssignModal && createPortal(
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-2xl animate-in fade-in duration-300" onClick={() => setShowAssignModal(null)}></div>
                    <div className="lux-card w-full max-w-lg max-h-[90vh] relative z-10 animate-in slide-in-from-bottom-10 duration-500 flex flex-col p-0 overflow-hidden shadow-[0_30px_60px_-15px_rgba(184,134,11,0.2)]">
                        <div className="p-8 border-b border-[var(--border-glass)] bg-[var(--bg-void)]/80 flex-shrink-0">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-2xl font-black gold-text uppercase">Guruh tanlash</h3>
                                <button onClick={() => setShowAssignModal(null)} className="text-[var(--text-muted)] hover:text-white transition-colors"><X size={24} /></button>
                            </div>
                            <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest flex items-center gap-2">
                                O'quvchi: <span className="text-white italic">{showAssignModal.full_name}</span>
                            </p>
                        </div>

                        <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                            <div className="space-y-3">
                                {loadingGroups ? (
                                    <div className="py-20 flex justify-center">
                                        <Loader2 className="animate-spin text-[var(--gold)]" size={32} />
                                    </div>
                                ) : groups.length === 0 ? (
                                    <div className="text-center py-10 opacity-50 italic text-sm text-[var(--text-muted)] uppercase tracking-widest">Faol guruhlar topilmadi.</div>
                                ) : (
                                    groups.map(group => (
                                        <button
                                            key={group.id}
                                            onClick={() => handleAssignToGroup(group.id)}
                                            className="w-full flex items-center justify-between p-5 rounded-[20px] bg-[var(--bg-void)]/50 border border-[var(--border-glass)] hover:border-[var(--gold)]/40 hover:bg-[var(--gold-dim)] transform transition-all active:scale-[0.98] text-left group/item"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-black border border-[var(--gold)]/10 flex items-center justify-center group-hover/item:border-[var(--gold)]/30 transition-colors shadow-lg">
                                                    <BookOpen size={20} className="text-[var(--gold)]" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-[var(--text-primary)] group-hover/item:text-[var(--gold)] transition-colors uppercase tracking-tight">{group.name}</p>
                                                    <div className="flex items-center gap-3 mt-1">
                                                        <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{group.subject || "No Subject"}</span>
                                                        <span className="w-1 h-1 rounded-full bg-[var(--border-glass)]"></span>
                                                        <span className="text-[9px] font-bold text-[var(--gold)] opacity-70 uppercase tracking-widest">{group.students_count} o'quvchi</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <ChevronRight size={18} className="text-[var(--text-muted)] group-hover/item:text-[var(--gold)] group-hover/item:translate-x-1 transition-all" />
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="p-6 bg-[var(--bg-void)]/40 border-t border-[var(--border-glass)] flex-shrink-0">
                            <p className="text-[8px] text-[var(--text-muted)] text-center uppercase tracking-[0.2em] font-black">
                                Guruh tanlaganingizdan so'ng, o'quvchi avtomatik tarzda Studentlar ro'yxatiga ko'chiriladi.
                            </p>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
