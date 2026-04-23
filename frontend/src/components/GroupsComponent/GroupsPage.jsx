import { useEffect, useState, useMemo } from "react";
import React from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { setSearchQuery, setTab } from "../../store/slices/mentorSlice";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import api from "../../tokenUpdater/updater";
import toast from "react-hot-toast";
import {
  LayoutGrid, CalendarDays, Clock,
  Search, Loader2, Plus, Kanban, Palette, X, Users, ChevronRight, Hash,
  ArrowUpRight, Filter, Check
} from "lucide-react";
import GoBackButton from "../sendback";
import { useCurrentBranch } from "../Authorized/useBranchId";
import { get_user_info } from "../Authorized/getRole";

// Fetcher function
const fetchGroupsData = async ({ pageParam = 1, queryKey }) => {
  const [_key, branchId, search] = queryKey;
  let url = `/groups/groups/`;
  let params = [`page=${pageParam}`, `page_size=5`];
  if (branchId) params.push(`branch_id=${branchId}`);
  if (search) params.push(`search=${search}`);

  const finalUrl = `${url}?${params.join("&")}`;
  const res = await api.get(finalUrl);
  return res.data;
};

// --- LUXURY GROUP CARD COMPONENT ---
const GroupCard = React.memo(({ group, readOnly, currentBranchId }) => {
  const navigate = useNavigate();
  const [colorCh, setColorCh] = useState(false);
  const [selectedColor, setSelectedColor] = useState(group.color || '#b8860b');
  const [loading, setLoading] = useState(false);

  const saveNewColor = async (e) => {
    e.stopPropagation();
    setLoading(true);
    try {
      await api.patch(`/groups/groups/${group.id}/`, { color: selectedColor });
      toast.success("Rangi o'zgartirildi.");
      setColorCh(false);
    } catch (error) {
      toast.error("Xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={() => !colorCh && navigate(`${group.id}?branch=${currentBranchId}`)}
      className="lux-card-static !p-0 overflow-hidden cursor-pointer relative"
      style={{ borderTop: `2px solid ${selectedColor}` }}
    >
      {/* Premium Color Flag */}
      <div
        className="absolute top-0 left-6 w-8 h-12 z-10 shadow-lg"
        style={{
          background: selectedColor,
          clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 50% 85%, 0% 100%)',
          boxShadow: `0 4px 15px ${selectedColor}40`
        }}
      />
      {group.today_attendance_confirmed ? (
        <div className="absolute top-4 right-4 z-10 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 shadow-sm flex items-center gap-1" title="Bugungi davomat tasdiqlangan">
          <Check size={10} className="text-emerald-500" strokeWidth={3} />
          <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Qilindi</span>
        </div>
      ) : (
        <div className="absolute top-4 right-4 z-10 px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20 shadow-sm flex items-center gap-1" title="Bugungi davomat olinmagan">
          <X size={10} className="text-red-500" strokeWidth={3} />
          <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">Olinmagan</span>
        </div>
      )}
      <div className="p-4 sm:p-6">
        <div className="flex justify-between items-start mb-4 sm:mb-6">
          <div
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center border border-[var(--border-glass)] bg-[var(--bg-void)]/40 text-[var(--gold)]"
            style={{ color: selectedColor, boxShadow: `0 8px 30px ${selectedColor}20` }}
          >
            <Users size={20} className="sm:w-6 sm:h-6" />
          </div>
          {!readOnly && (
            <button
              onClick={(e) => { e.stopPropagation(); setColorCh(!colorCh); }}
              className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl transition-all border ${colorCh ? 'bg-[var(--gold)] text-black border-transparent shadow-lg' : 'bg-[var(--bg-panel)]/50 text-[var(--text-secondary)] border-[var(--border-glass)] hover:text-[var(--gold)]'}`}
            >
              <Palette size={14} className="sm:w-4 sm:h-4" />
            </button>
          )}
        </div>

        <div className="space-y-4 sm:space-y-5">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] uppercase tracking-tight transition-colors line-clamp-1">
              {group.name}
            </h3>
            <p className="text-[9px] sm:text-[10px] font-black text-[var(--text-gold)] uppercase tracking-[0.2em] mt-1 opacity-70">
              {group.subject_name || group.subject || 'Kurs nomi'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 py-4 sm:py-5 border-y border-[var(--border-glass)]">
            <div>
              <p className="text-[8px] sm:text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1 sm:mb-1.5">O'qituvchi</p>
              <p className="text-[11px] sm:text-[12px] font-bold text-[var(--text-primary)] truncate">{group.mentor?.full_name || 'Tayinlanmagan'}</p>
            </div>
            <div className="text-right">
              <p className="text-[8px] sm:text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1 sm:mb-1.5">O'quvchilar</p>
              <div className="flex items-center justify-end gap-1.5">
                <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></div>
                <p className="text-[11px] sm:text-[12px] font-bold text-[var(--text-primary)]">{group.students_count || 0} ta</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="p-1 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-glass)] shrink-0">
                  <Clock size={10} className="sm:w-3 sm:h-3 text-[var(--gold)]" />
                </div>
                <span className="text-[10px] font-bold text-[var(--text-secondary)] truncate">{group.dars_vaqti || '--:--'}</span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="p-1 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-glass)] shrink-0">
                  <CalendarDays size={10} className="sm:w-3 sm:h-3 text-[var(--gold)]" />
                </div>
                <span className="text-[10px] font-bold text-[var(--text-secondary)] truncate">{group.days === 'even' ? "Juft" : group.days === 'everyday' ? 'Har kun' : 'Toq'}</span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5">
              {group.computed_status === 'active' && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                  <div className="w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981]"></div>
                  <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Faol</span>
                </div>
              )}
              {group.computed_status === 'waiting' && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20">
                  <div className="w-1 h-1 rounded-full bg-amber-500 shadow-[0_0_5px_#f59e0b]"></div>
                  <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest">Kutilmoqda</span>
                </div>
              )}
              {group.computed_status === 'activating_soon' && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 animate-pulse">
                  <div className="w-1 h-1 rounded-full bg-blue-500 shadow-[0_0_5px_#3b82f6]"></div>
                  <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest">Yaqinda</span>
                </div>
              )}
              {group.computed_status === 'inactive' && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-500/10 border border-red-500/20">
                  <div className="w-1 h-1 rounded-full bg-red-500/50"></div>
                  <span className="text-[8px] font-black text-red-500/50 uppercase tracking-widest">Nofaol</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hover Indication Removed */}

      {/* Color Picker Slide-up */}
      {colorCh && (
        <div
          className="absolute inset-0 z-20 bg-[var(--bg-panel)] p-8 flex flex-col items-center justify-center gap-6 animate-in slide-in-from-bottom duration-500"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center">
            <h4 className="text-[11px] font-black text-[var(--gold)] uppercase tracking-[0.3em] mb-1">Vizual ko'rinish</h4>
            <p className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-widest">Guruh rangini tanlang</p>
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
          <div className="flex gap-3 w-full max-w-[180px]">
            <button onClick={saveNewColor} disabled={loading} className="lux-btn lux-btn-primary flex-1 !h-11 !text-[10px] !rounded-xl">
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Tasdiqlash"}
            </button>
            <button onClick={() => { setColorCh(false); setSelectedColor(group.color); }} className="w-11 h-11 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)] text-red-500 hover:bg-red-500/10 flex items-center justify-center transition-all">
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

// --- MAIN PAGE ---
export default function GroupsListPage() {
  const { currentBranchId, currentBranchName, isLoading: branchLoading, hasAccess } = useCurrentBranch();
  const navigate = useNavigate();
  const { branchId: superAdminBranchId } = useOutletContext();
  const user_info = get_user_info();

  const dispatch = useDispatch();
  const searchTerm = useSelector(state => state.mentor.searchQuery);
  const activeTab = useSelector(state => state.mentor.activeTab);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { ref, inView } = useInView();

  const { data: userData = {} } = useQuery({
    queryKey: ['user-me'],
    queryFn: () => api.get('/user/me/').then(res => res.data),
    staleTime: Infinity,
  });

  const perms = userData.permissions || {};
  const isSuperAdmin = user_info?.role === "super_admin";
  const isMentor = user_info?.role === "mentor" || userData?.role === "mentor";
  const canCreateGroup = (isSuperAdmin || perms.groups === true) && !isMentor;

  useEffect(() => {
    const searchTimer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(searchTimer);
  }, [searchTerm]);

  const effectiveBranchId = user_info?.role === "super_admin" ? superAdminBranchId : currentBranchId;
  const canFetch = user_info?.role === "super_admin" ? !!superAdminBranchId : (!branchLoading && hasAccess);

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
    queryKey: ['groups', effectiveBranchId, debouncedSearch],
    queryFn: fetchGroupsData,
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
      toast.error(error?.message || "Guruhlarni yuklashda xatolik yuz berdi!");
    }
  }, [isError, error]);

  const groupsArr = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap(page => page.results || []);
  }, [data]);

  const filteredData = useMemo(() => {
    return groupsArr.filter((group) => {
      if (activeTab === "all") return true;
      return group.days === activeTab;
    });
  }, [groupsArr, activeTab]);

  return (
    <div className="p-3 sm:p-6 space-y-10">
      {/* Atmosphere Background Removed */}

      {/* HEADER & SEARCH */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 pb-8 border-b border-[var(--border-glass)]">
        <div>
          <h1 className="gold-text">O'quv Guruhlari</h1>
          <p className="text-[11px] text-[var(--text-secondary)] font-bold uppercase tracking-[0.3em] mt-3">
            {currentBranchName || 'Asosiy Boshqarma'} • {filteredData.length} FAOL GURUHLAR
          </p>
        </div>

        <div className="flex flex-1 max-w-2xl items-center gap-4">
          <div className="relative flex-1 group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--gold)]">
              {isLoading || isFetching ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => dispatch(setSearchQuery(e.target.value))}
              placeholder="Guruh yoki fan bo'yicha qidirish..."
              className="lux-input !pl-12 !py-4"
            />
          </div>

          {canCreateGroup && (
            <button
              onClick={() => navigate(`addgroup?branch=${currentBranchId}`)}
              className="lux-btn lux-btn-primary hidden sm:flex shrink-0 !px-8 !h-[54px]"
            >
              <Plus size={18} />
              <span>Guruh yaratish</span>
            </button>
          )}
        </div>
      </div>

      {/* TABS PROTOCOL */}
      <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
        {[
          { id: "all", label: "BARCHA", icon: Kanban },
          { id: "odd", label: "TOQ KUNLAR", icon: LayoutGrid },
          { id: "even", label: "JUFT KUNLAR", icon: LayoutGrid },
          { id: "everyday", label: "HAR KUNI", icon: Clock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => dispatch(setTab(tab.id))}
              className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap border
                ${isActive
                  ? "bg-[var(--gold)] text-black border-transparent shadow-[0_10px_30px_rgba(184,134,11,0.25)]"
                  : "bg-[var(--bg-panel)]/40 text-[var(--text-secondary)] border-[var(--border-glass)] hover:border-[var(--gold)]/40"}`}
            >
              <Icon size={16} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* CONTENT AREA */}
      <div className="min-h-[500px]">
        {isLoading && !filteredData.length ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4 opacity-50">
            <Loader2 className="animate-spin text-[var(--gold)]" size={48} />
            <p className="text-[10px] font-black tracking-[0.3em] uppercase">Ma'lumotlar yuklanmoqda...</p>
          </div>
        ) : filteredData.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4 sm:gap-8">
            {filteredData.map((item) => (
              <GroupCard key={item.id} group={item} readOnly={!canCreateGroup} currentBranchId={effectiveBranchId} />
            ))}
          </div>
        ) : (
          <div className="py-24 flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 rounded-3xl bg-[var(--gold-dim)] border border-[var(--gold)]/20 flex items-center justify-center mb-8 text-[var(--gold)]">
              <Kanban size={48} />
            </div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)] uppercase tracking-tight mb-3">Faol guruhlar topilmadi</h2>
            <p className="text-[var(--text-muted)] text-[11px] max-w-xs font-bold uppercase tracking-widest leading-relaxed">
              Ushbu filtr bo'yicha {currentBranchName || 'bazada'} hech qanday guruh topilmadi.
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
      </div>

      {/* Mobile FAB */}
      {canCreateGroup && (
        <button
          onClick={() => navigate(`addgroup?branch=${currentBranchId}`)}
          className="lg:hidden fixed bottom-24 right-6 w-16 h-16 bg-[var(--gold)] text-black rounded-2xl shadow-[0_15px_40px_rgba(184,134,11,0.4)] flex items-center justify-center z-[110] active:scale-90 transition-transform"
        >
          <Plus size={28} />
        </button>
      )}
    </div>
  );
}