import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../../tokenUpdater/updater";
import toast from "react-hot-toast";
import GoBackButton from "../sendback";
import { useCurrentBranch } from "../Authorized/useBranchId";
import {
  Search,
  Loader2,
  Plus,
  User,
  Phone,
  GraduationCap,
  ChevronRight,
  SearchCode,
  UserPlus,
  ArrowUpRight,
  Filter,
  Clock
} from "lucide-react";
import { get_user_info } from "../Authorized/getRole";

export default function GlobalStudentComponent() {
  const navigate = useNavigate();
  const { currentBranchId, branchLoading, hasAccess, isExtraBranch } = useCurrentBranch();
  const { branchId } = useOutletContext();
  const user_info = get_user_info();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: userData = {} } = useQuery({
    queryKey: ['user-me'],
    queryFn: () => api.get('/user/me/').then(res => res.data),
    staleTime: Infinity,
  });

  const perms = userData.permissions || {};
  const isSuperAdmin = user_info?.role === "super_admin";
  const canCreateStudent = isSuperAdmin || perms.students === true;

  const fetchStudents = async (search = "") => {
    const activeBranchId = user_info?.role === "super_admin" ? branchId : currentBranchId;
    if (!search.trim() || !activeBranchId) {
      setStudents([]);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`/groups/nested_students/?branch_id=${activeBranchId}&search=${search}&page_size=200`);
      setStudents(res.data.results || res.data);
    } catch {
      toast.error("Ma'lumotlarni yuklashda xatolik.");
    } finally {
      setTimeout(() => setLoading(false), 300);
    }
  };

  useEffect(() => {
    const isSuperAdmin = user_info?.role === "super_admin";
    if (!isSuperAdmin && (branchLoading || !hasAccess)) return;

    const debounce = setTimeout(() => {
      fetchStudents(searchTerm);
    }, 600);

    return () => clearTimeout(debounce);
  }, [searchTerm, currentBranchId, branchId, branchLoading, hasAccess]);

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  };

  return (
    <div className="animate-lux-fade">
      {/* BACKGROUND ATMOSPHERE */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-[20%] right-0 w-[600px] h-[600px] bg-[var(--gold)]/5 rounded-full blur-[140px]"></div>
      </div>

      {/* HEADER SECTION - 1:1 DESIGN FIDELITY */}
      <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="gold-text">O'quvchilar Boshqarmasi</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '14px' }}>
            Filialdagi o'quvchilarni ko'rish va boshqarish.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="lux-btn"
            onClick={() => navigate(user_info?.role === "super_admin" ? `/super_admin/branch/${branchId}/waiting-hall` : "/admin/waiting-hall")}
            style={{ padding: '12px 24px', background: 'var(--bg-panel)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Clock size={16} /> Kutishlar Zali
          </button>
          {!isExtraBranch && canCreateStudent && (
            <button
              className="lux-btn lux-btn-primary"
              onClick={() => navigate("add_to_global")}
              style={{ padding: '12px 32px' }}
            >
              <UserPlus size={16} /> Yangi O'quvchi
            </button>
          )}
        </div>
      </div>

      {/* SEARCH BAR CARD */}
      <div className="lux-card" style={{ marginBottom: '32px', padding: '12px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            {loading ? (
              <Loader2 size={18} className="animate-spin" style={{ position: 'absolute', left: '16px', top: '16px', color: 'var(--gold)' }} />
            ) : (
              <Search size={18} style={{ position: 'absolute', left: '5px', top: '16px', color: 'var(--text-secondary)' }} />
            )}
            <input
              className="lux-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Ism yoki tel orqali qidiruv"
              style={{ paddingLeft: '100px', border: 'none', background: 'transparent' }}
            />
          </div>
          <div style={{ height: '30px', width: '1px', background: 'var(--border-glass)' }}></div>
          <button className="lux-nav-item" style={{ border: 'none', margin: 0, padding: '8px 16px' }}>
            <Filter size={16} /> <span>Filtr</span>
          </button>
        </div>
      </div>

      {/* RESULT AREA */}
      <div className="min-h-[500px]">
        {!searchTerm.trim() ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 0', opacity: 0.6 }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'var(--gold-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
              <SearchCode size={32} color="var(--gold)" />
            </div>
            <h2 style={{ fontSize: '18px', color: 'var(--text-primary)', marginBottom: '8px' }}>Qidiruvni Boshlang</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '300px', textAlign: 'center' }}>
              Filialdagi o'quvchilarni topish uchun yuqoridagi qidiruv maydonidan foydalaning.
            </p>
          </div>
        ) : loading && students.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
            <Loader2 size={40} className="animate-spin" color="var(--gold)" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {students.map((s, i) => (
              <div
                key={s.id}
                className="lux-card"
                onClick={() => navigate(`${s.id}`)}
                style={{
                  cursor: 'pointer', display: 'flex', flexDirection: 'column',
                  padding: '24px', transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)'
                }}
              >
                {/* Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                  <div style={{
                    width: '56px', height: '56px', borderRadius: '16px',
                    background: 'var(--bg-void)', border: '1px solid var(--border-highlight)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '18px', fontWeight: '800', color: 'var(--gold)',
                    boxShadow: 'var(--gold-glow)'
                  }}>
                    {s.image ? (
                      <img src={s.image} alt={s.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '15px' }} />
                    ) : getInitials(s.full_name)}
                  </div>
                  <div className="lux-nav-item active" style={{ padding: '4px 12px', fontSize: '10px', height: 'fit-content', borderRadius: '8px' }}>
                    ID #{s.id}
                  </div>
                </div>

                {/* Card Body */}
                <div style={{ flex: 1, marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '17px', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '4px' }}>{s.full_name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    <Phone size={14} style={{ opacity: 0.5 }} />
                    <span>{s.phone}</span>
                  </div>
                </div>

                {/* Card Footer - Tactical Visuals */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '16px', borderTop: 'var(--border-glass)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '1px' }}>Guruh</span>
                    <span style={{ fontSize: '12px', color: 'var(--gold)', fontWeight: '700' }}>{s.group?.name || "Yakkaxon"}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '1px' }}>Holat</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{
                        width: '6px', height: '6px', borderRadius: '50%',
                        background: s.status === 'regular' ? '#10b981' : 'var(--gold)',
                        boxShadow: s.status === 'regular' ? '0 0 10px #10b981' : '0 0 10px var(--gold)'
                      }}></div>
                      <span style={{
                        fontSize: '11px',
                        color: s.status === 'regular' ? '#10b981' : 'var(--gold)',
                        fontWeight: '700'
                      }}>
                        {s.status === 'low_income' ? 'Kam Ta\'minlangan' :
                          s.status === 'discount' ? 'Imtiyozli' :
                            s.status === 'negotiated' ? 'Kelishilgan' : 'Faol'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Hover Action */}
                <div style={{ position: 'absolute', bottom: '24px', right: '24px', opacity: 0 }} className="group-hover:opacity-100 transition-opacity">
                  <ArrowUpRight size={20} color="var(--gold)" />
                </div>
              </div>
            ))}

            {students.length === 0 && !loading && (
              <div className="col-span-full py-24 flex flex-col items-center justify-center text-center opacity-50">
                <User size={48} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
                <h3 style={{ fontSize: '16px' }}>O'quvchilar topilmadi</h3>
                <p style={{ fontSize: '12px' }}>Qidiruv so'rovini o'zgartirib ko'ring.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FAB FOR MOBILE */}
      {!isExtraBranch && canCreateStudent && (
        <button
          className="lg:hidden"
          onClick={() => navigate("add_to_global")}
          style={{
            position: 'fixed', bottom: '100px', right: '24px',
            width: '60px', height: '60px', borderRadius: '20px',
            background: 'var(--gold)', color: 'black', border: 'none',
            boxShadow: '0 10px 30px rgba(184, 134, 11, 0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100
          }}
        >
          <UserPlus size={24} />
        </button>
      )}
    </div>
  );
}
