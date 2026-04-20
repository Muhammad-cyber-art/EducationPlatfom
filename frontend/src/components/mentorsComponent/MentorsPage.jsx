import { useOutletContext, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { setSearchQuery } from "../../store/slices/mentorSlice";
import { useEffect, useState } from "react";
import React from "react";
import toast from "react-hot-toast";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import api from "../../tokenUpdater/updater";
import {
  Search, Loader2, Palette, X, Phone, UserPlus, ChevronRight, GraduationCap,
  ShieldCheck, Briefcase, Star, Sparkles, LayoutGrid, List, Users
} from "lucide-react";
import GoBackButton from "../sendback";
import { useCurrentBranch } from "../Authorized/useBranchId";
import { get_user_info } from "../Authorized/getRole";

// Fetcher function
const fetchMentorsData = async ({ pageParam = 1, queryKey }) => {
  const [_key, branchId, search] = queryKey;
  const res = await api.get(`/groups/nested_mentors/`, {
    params: {
      branch_id: branchId,
      search: search,
      page: pageParam,
      page_size: 5
    }
  });
  return res.data;
};

// --- ELITE MENTOR CARD ---
const MentorCard = React.memo(({ mentor, effectiveBranchId, readOnly, viewMode }) => {
  const navigate = useNavigate();
  const [colorCh, setColorCh] = useState(false);
  const [selectedColor, setSelectedColor] = useState(mentor.color || '#b8860b');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSelectedColor(mentor.color || '#b8860b');
  }, [mentor.color]);

  const saveNewColor = async (e) => {
    e.stopPropagation();
    setLoading(true);
    try {
      await api.patch(`/register/users/${mentor.id}/`, { color: selectedColor });
      toast.success("Rangi o'zgartirildi.");
      setColorCh(false);
    } catch (error) {
      toast.error("Xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  };

  const initials = `${mentor.first_name?.[0] || ''}${mentor.last_name?.[0] || ''}`.toUpperCase();

  if (viewMode === 'list') {
    return (
      <div
        onClick={() => !colorCh && navigate(`${mentor.id}?branch=${effectiveBranchId}`)}
        className="lux-card group !p-3 sm:!p-4 flex items-center justify-between gap-4 overflow-hidden cursor-pointer relative hover:border-[var(--gold)]/30 transition-all duration-300"
        style={{ borderColor: `${selectedColor}15`, background: `${selectedColor}05` }}
      >
        {/* Color Line Flag for List View */}
        <div
          className="absolute top-0 left-0 w-1 h-full opacity-60 group-hover:w-1.5 transition-all"
          style={{ background: selectedColor }}
        />
        <div className="flex items-center gap-4 sm:gap-6 flex-1 min-w-0">
          <div className="relative shrink-0">
            <div
              className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl overflow-hidden bg-[var(--bg-panel)] border border-[var(--border-glass)] p-0.5 shadow-lg"
              style={{ boxShadow: `0 8px 24px ${selectedColor}10` }}
            >
              <div className="w-full h-full rounded-[10px] sm:rounded-xl overflow-hidden bg-[var(--bg-void)] flex items-center justify-center">
                {mentor.image ? (
                  <img src={mentor.image} className="w-full h-full object-cover" alt="" />
                ) : (
                  <span className="text-xs sm:text-sm font-black" style={{ color: selectedColor }}>{initials}</span>
                )}
              </div>
            </div>
            <div
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--bg-panel)] ${mentor.is_active !== false ? 'bg-emerald-500' : 'bg-red-500'}`}
            />
          </div>

          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-black text-[var(--text-primary)] uppercase tracking-tight truncate">
              {mentor.first_name} {mentor.last_name}
            </h3>
            <p className="text-[8px] sm:text-[9px] font-black text-[var(--gold)] uppercase tracking-[0.2em] mt-0.5 opacity-80" style={{ color: selectedColor }}>
              {mentor.subject || 'Mentor'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-10 shrink-0">
          <div className="hidden sm:flex items-center gap-6">
            <div className="text-center">
              <p className="text-[10px] sm:text-[11px] font-black text-[var(--text-primary)]">{mentor.groups_count || 0}</p>
              <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-0.5">Gruhlar</p>
            </div>
            <div className="text-center border-l border-[var(--border-glass)] pl-6">
              <p className="text-[10px] sm:text-[11px] font-black text-[var(--text-primary)]">{mentor.students_count || 0}</p>
              <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-0.5">O'quvchilar</p>
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-muted)] group-hover:bg-[var(--gold)] group-hover:text-black transition-all">
            <ChevronRight size={14} className="sm:w-5 sm:h-5" />
          </div>
        </div>

        {/* Action button floating */}
        {!readOnly && (
          <button
            onClick={(e) => { e.stopPropagation(); setColorCh(!colorCh); }}
            className="absolute top-1 right-1 p-1.5 opacity-40 hover:opacity-100 text-[var(--text-muted)] transition-opacity"
          >
            <Palette size={12} />
          </button>
        )}

        {/* Color Overlay for compact view */}
        {colorCh && (
          <div className="absolute inset-0 z-30 bg-black/95 backdrop-blur-xl flex items-center justify-center p-2 gap-4 animate-in fade-in" onClick={e => e.stopPropagation()}>
            <input type="color" value={selectedColor} onChange={e => setSelectedColor(e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-none" />
            <div className="flex gap-2">
              <button onClick={saveNewColor} className="px-3 py-1 bg-[var(--gold)] text-black text-[9px] font-black rounded-lg">OK</button>
              <button onClick={() => setColorCh(false)} className="px-3 py-1 bg-white/10 text-white text-[9px] font-black rounded-lg">X</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() => !colorCh && navigate(`${mentor.id}?branch=${effectiveBranchId}`)}
      className="lux-card group !p-0 overflow-hidden cursor-pointer relative hover:border-[var(--gold)]/30 transition-all duration-500"
      style={{
        borderColor: `${selectedColor}25`,
        boxShadow: window.innerWidth > 1024 ? `0 10px 40px ${selectedColor}08` : 'none'
      }}
    >
      <div
        className="absolute top-0 right-0 w-48 h-48 bg-[var(--gold)]/5 blur-[80px] opacity-10 pointer-events-none"
      ></div>

      {/* Subtle Color Bar Accent */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] opacity-40 transition-opacity"
        style={{ background: selectedColor }}
      />

      {/* Premium Color Flag */}
      <div
        className="absolute top-0 left-8 w-7 h-11 z-10 shadow-lg origin-top"
        style={{
          background: selectedColor,
          clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 50% 85%, 0% 100%)',
          boxShadow: `0 4px 15px ${selectedColor}40`
        }}
      />

      <div className="p-4 sm:p-7">
        <div className="flex justify-between items-start mb-4 sm:mb-8">
          <div className="relative">
            <div
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-[22px] sm:rounded-[28px] overflow-hidden bg-[var(--bg-void)] border border-[var(--border-glass)] p-1 shadow-xl"
              style={{ boxShadow: `0 15px 40px ${selectedColor}15` }}
            >
              <div className="w-full h-full rounded-[18px] sm:rounded-[22px] overflow-hidden bg-[var(--bg-panel)] flex items-center justify-center relative">
                {mentor.image ? (
                  <img src={mentor.image} className="w-full h-full object-cover" alt="" />
                ) : (
                  <span className="text-xl sm:text-2xl font-bold tracking-tighter" style={{ color: selectedColor }}>{initials}</span>
                )}
              </div>
            </div>
            {/* Status Indicator */}
            <div
              className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 sm:w-5 sm:h-5 rounded-full border-[2.5px] sm:border-[3px] border-[var(--bg-panel)] shadow-lg ${mentor.is_active !== false ? 'bg-emerald-500' : 'bg-red-500'}`}
            />
          </div>

          <div className="flex flex-col items-end gap-3">
            <div
              className="px-3 py-1 rounded-full border text-[8px] font-black uppercase tracking-[0.2em] bg-[var(--bg-void)]/40"
              style={{ color: selectedColor, borderColor: `${selectedColor}30` }}
            >
              Lvl. {mentor.role === 'super_admin' ? '0' : '1'}
            </div>
            {!readOnly && (
              <button
                onClick={(e) => { e.stopPropagation(); setColorCh(!colorCh); }}
                className="p-2.5 rounded-xl bg-[var(--bg-panel)]/50 border border-[var(--border-glass)] text-[var(--text-muted)] hover:text-[var(--gold)] sm:opacity-0 sm:group-hover:opacity-100 transition-all flex items-center justify-center relative z-10 active:scale-95"
              >
                <Palette size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] uppercase tracking-tight transition-colors leading-tight">
              {mentor.first_name} <br className="hidden sm:block" /> {mentor.last_name}
            </h3>
            <div className="flex items-center gap-2 mt-1.5 sm:mt-2">
              <Star size={10} style={{ color: selectedColor, fill: selectedColor }} />
              <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] opacity-80" style={{ color: selectedColor }}>
                {mentor.subject || 'Mentor'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 py-4 sm:py-5 border-y border-[var(--border-glass)]">
            <div className="space-y-0.5 sm:space-y-1">
              <div className="flex items-center gap-1.5 opacity-60">
                <ShieldCheck size={12} className="text-[var(--gold)]" />
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-[var(--text-primary)]">Guruhlar</span>
              </div>
              <p className="text-sm font-black text-[var(--text-primary)] mt-1">{mentor.groups_count || 0}</p>
            </div>
            <div className="space-y-0.5 sm:space-y-1 border-l border-[var(--border-glass)] pl-3 sm:pl-4">
              <div className="flex items-center gap-1.5 opacity-60">
                <Users size={12} className="text-[var(--gold)]" />
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-[var(--text-primary)]">O'quvchilar</span>
              </div>
              <p className="text-sm font-black text-[var(--text-primary)] mt-1">{mentor.students_count || 0}</p>
            </div>
          </div>

          <div className="flex items-center justify-between group/action">
            <div className="flex items-center gap-2 text-[var(--text-muted)] font-bold text-[9px] sm:text-[10px] uppercase tracking-widest">
              <Briefcase size={12} className="opacity-50" />
              <span>Batafsil</span>
            </div>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-muted)] group-hover:bg-[var(--gold)] group-hover:text-black transition-all">
              <ChevronRight size={14} className="sm:w-4 sm:h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Color Picker Slide-up */}
      {
        colorCh && (
          <div
            className="absolute inset-0 z-20 bg-[var(--bg-panel)]/98 backdrop-blur-2xl p-8 flex flex-col items-center justify-center gap-6 animate-in slide-in-from-bottom duration-500"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <h4 className="text-[11px] font-black text-[var(--gold)] uppercase tracking-[0.3em] mb-1">Vizual ko'rinish</h4>
              <p className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-widest">O'qituvchi rangini tanlang</p>
            </div>
            <div className="relative group/picker">
              <input
                type="color"
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                className="w-20 h-20 rounded-[30px] bg-transparent border-none cursor-pointer p-0 shadow-2xl"
              />
              <div className="absolute inset-0 rounded-[30px] border-2 border-[var(--gold)] pointer-events-none opacity-30 group-hover/picker:opacity-100 transition-opacity" />
            </div>
            <div className="flex gap-2 sm:gap-3 w-full max-w-[180px]">
              <button onClick={saveNewColor} disabled={loading} className="lux-btn lux-btn-primary flex-1 !h-10 sm:!h-11 !text-[9px] sm:!text-[10px] !rounded-xl">
                {loading ? <Loader2 size={16} className="animate-spin" /> : "Tasdiqlash"}
              </button>
              <button onClick={() => { setColorCh(false); setSelectedColor(mentor.color); }} className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)] text-red-500 hover:bg-red-500/10 flex items-center justify-center transition-all">
                <X size={20} />
              </button>
            </div>
          </div>
        )
      }
    </div >
  );
});

// --- MAIN PAGE ---
export default function MentorsPage() {
  const { currentBranchName, currentBranchId, isLoading: branchLoading, hasAccess } = useCurrentBranch();
  const navigate = useNavigate();
  const { branchId: superAdminBranchId } = useOutletContext();
  const user_info = get_user_info();

  const dispatch = useDispatch();
  const searchTerm = useSelector(state => state.mentor.searchQuery);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [viewMode, setViewMode] = useState("grid"); // grid or list
  const { ref, inView } = useInView();

  const { data: userData = {} } = useQuery({
    queryKey: ['user-me'],
    queryFn: () => api.get('/user/me/').then(res => res.data),
    staleTime: Infinity,
  });

  const perms = userData.permissions || {};
  const userRole = (userData.role || user_info?.role || "").toLowerCase();
  const isSuperAdmin = userRole === "super_admin";
  const canCreateMentor = (isSuperAdmin || perms.teachers === true) && userRole !== "mentor";

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const effectiveBranchId = user_info.role === "super_admin" ? superAdminBranchId : currentBranchId;
  const canFetch = user_info.role === "super_admin" ? !!effectiveBranchId : (!branchLoading && hasAccess && !!effectiveBranchId);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isFetching,
    isError,
    error
  } = useInfiniteQuery({
    queryKey: ['mentors', effectiveBranchId, debouncedSearch],
    queryFn: fetchMentorsData,
    enabled: canFetch,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.next) {
        const url = new URL(lastPage.next);
        return url.searchParams.get('page');
      }
      return undefined;
    },
  });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    if (isError) {
      toast.error(error?.message || "O'qituvchilarni yuklashda xatolik yuz berdi!");
    }
  }, [isError, error]);

  const mentors = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap(page => page.results || []);
  }, [data]);

  return (
    <div className="p-3 sm:p-6 space-y-12">
      {/* Atmosphere Background Removed */}

      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10 pb-10 border-b border-[var(--border-glass)] relative">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <GoBackButton />
            <div className="px-3 py-1 bg-[var(--gold-dim)] rounded-full border border-[var(--gold)]/20">
              <span className="text-[10px] font-black text-[var(--gold)] tracking-[0.2em] uppercase">Faqat rasmiy xodimlar</span>
            </div>
          </div>
          <h1 className="gold-text !text-2xl sm:!text-4xl">O'qituvchilar Tarkibi</h1>
          <p className="text-[10px] sm:text-[11px] text-[var(--text-secondary)] font-bold uppercase tracking-[0.3em] sm:tracking-[0.4em] flex items-center gap-2 sm:gap-3">
            {currentBranchName || 'Boshqaruv bo\'limi'} <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] opacity-30"></span> {mentors.length} FAOL O'QITUVCHILAR
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 flex-1 max-w-2xl lg:pr-32">
          <div className="relative flex-1 group w-full">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--gold)]">
              {isLoading || isFetching ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
            </div>
            <input
              value={searchTerm}
              onChange={(e) => dispatch(setSearchQuery(e.target.value))}
              placeholder="Qidirish..."
              className="lux-input !pl-12 sm:!pl-14 !py-4 sm:!py-5 shadow-2xl"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {canCreateMentor && (
              <button
                onClick={() => navigate(`add-mentor?branch=${effectiveBranchId}`)}
                className="lux-btn lux-btn-primary !px-6 sm:!px-10 !h-[48px] sm:!h-[58px] flex-1 sm:flex-none shadow-xl"
              >
                <UserPlus size={18} />
                <span>Qo'shish</span>
              </button>
            )}
          </div>
        </div>

        {/* View Toggle Buttons - Positioned Top Right */}
        <div className="absolute top-0 right-0 h-fit bg-[var(--bg-panel)] p-1 rounded-xl border border-[var(--border-glass)] flex gap-1 shadow-lg z-10 transition-transform">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 sm:p-2.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-[var(--gold)] text-black' : 'text-[var(--text-muted)] hover:text-[var(--gold)]'}`}
            title="Grid View"
          >
            <LayoutGrid size={14} className="sm:w-4 sm:h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 sm:p-2.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-[var(--gold)] text-black' : 'text-[var(--text-muted)] hover:text-[var(--gold)]'}`}
            title="List View"
          >
            <List size={14} className="sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>

      {/* RENDER GRID OR LIST */}
      <div className="min-h-[500px]">
        {isLoading && !mentors.length ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4 opacity-50">
            <Loader2 className="animate-spin text-[var(--gold)]" size={56} />
            <p className="text-[10px] font-black tracking-[0.4em] uppercase">Ma'mulotlar tekshirilmoqda...</p>
          </div>
        ) : mentors.length > 0 ? (
          <div className={viewMode === 'grid'
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            : "grid grid-cols-1 md:grid-cols-2 gap-4"
          }>
            {mentors.map((mentor) => (
              <MentorCard
                key={mentor.id}
                mentor={mentor}
                effectiveBranchId={effectiveBranchId}
                readOnly={!canCreateMentor}
                viewMode={viewMode}
              />
            ))}
          </div>
        ) : (
          <div className="py-32 flex flex-col items-center justify-center text-center">
            <div className="w-28 h-28 rounded-[40px] bg-[var(--gold-dim)] border border-[var(--gold)]/10 flex items-center justify-center mb-10 text-[var(--gold)]">
              <GraduationCap size={56} />
            </div>
            <h2 className="text-3xl font-bold text-[var(--text-primary)] uppercase tracking-tight mb-4">O'qituvchilar topilmadi</h2>
            <p className="text-[var(--text-muted)] text-[11px] max-w-xs font-bold uppercase tracking-[0.2em] leading-relaxed mx-auto italic">
              Siz qidirayotgan ma'lumotlar bazada topilmadi yoki sizda ruxsat yo'q.
            </p>
          </div>
        )}

        {/* INFINITE SCROLL SENSOR */}
        <div ref={ref} className="py-10 flex justify-center">
          {isFetchingNextPage && (
            <div className="flex items-center gap-2 text-[var(--gold)]">
              <Loader2 size={24} className="animate-spin" />
              <span className="text-[10px] font-black uppercase tracking-widest">Yana yuklanmoqda...</span>
            </div>
          )}
        </div>
      </div >

      {/* Mobile Floating Action Button */}
      {
        canCreateMentor && (
          <button
            onClick={() => navigate(`add-mentor?branch=${effectiveBranchId}`)}
            className="lg:hidden fixed bottom-24 right-8 w-16 h-16 bg-[var(--gold)] text-black rounded-2xl shadow-[0_15px_40px_rgba(184,134,11,0.5)] flex items-center justify-center z-[110] active:scale-90 transition-transform"
          >
            <UserPlus size={28} />
          </button>
        )
      }
    </div >
  );
}