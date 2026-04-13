import { Outlet, useNavigate, useLocation } from "react-router-dom";
import ThemeToggle from "../ThemeToggle";
import SideBar from "./sidebarmenu";
import { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import api from "../../tokenUpdater/updater";
import toast from "react-hot-toast";
import { GlobalContext } from "../../GlobalContext";
import { get_user_info } from "../Authorized/getRole";
import { Bell, FileDown } from "lucide-react";
import MobileBottomNav from "../Navigation/MobileBottomNav";
import {
  fetchAdminMe,
  setAfterSix,
  toggleNotification,
  setNotificationOpen,
  setDownloading
} from "../../store/slices/adminSlice";

export default function AdminPanel() {
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const {
    user: admin,
    hasPermission,
    isDownloading,
    isNotificationOpen,
    isAfterSix
  } = useSelector((state) => state.admin);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    dispatch(fetchAdminMe());

    const checkTime = () => {
      const hours = new Date().getHours();
      dispatch(setAfterSix(hours >= 18));
    };
    checkTime();
    const timer = setInterval(checkTime, 60000);
    return () => clearInterval(timer);
  }, [dispatch]);

  const handleExportExcel = async () => {
    dispatch(setDownloading(true));
    try {
      const today = new Date();
      const formattedDate = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
      const response = await api.get('/reports/', {
        params: { date: formattedDate },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${formattedDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Hisobot muvaffaqiyatli yuklandi.");
    } catch (error) {
      toast.error("Hisobotni yuklashda xatolik yuz berdi.");
    } finally {
      dispatch(setDownloading(false));
    }
  };

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === "/admin") return "Asosiy";
    if (path.includes("groups")) return "Guruhlar";
    if (path.includes("mentors")) return "O'qituvchilar";
    if (path.includes("all_students")) return "O'quvchilar ro'yxati";
    if (path.includes("archive")) return "Arxiv";
    if (path.includes("profile")) return "Profil sozalamalari";
    return "Boshqaruv paneli";
  };

  return (
    <div className="layout-container">
      <SideBar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lux-content">
        <header className="lux-header py-4 px-4 h-16 flex items-center justify-between border-b border-[var(--border-glass)]">
          <div className="flex items-center gap-4 flex-1">
            <h2 className="m-0 text-base text-[var(--text-primary)] font-semibold tracking-tight">
              {getPageTitle()}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <div className="flex items-center">
              <ThemeToggle custom />
            </div>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch(toggleNotification());
                }}
                className="w-9 h-9 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] flex items-center justify-center cursor-pointer relative text-[var(--text-secondary)] hover:text-[var(--gold)] transition-all"
              >
                <Bell size={16} />
                {isAfterSix && (
                  <div className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-[var(--gold)]"></div>
                )}
              </button>

              {isNotificationOpen && (
                <div
                  className="absolute top-12 right-0 w-72 lux-card !bg-[var(--bg-panel)]/95 !shadow-2xl border border-[var(--border-glass)] z-[100] animate-in fade-in zoom-in-95 duration-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-4 border-b border-[var(--border-glass)] bg-[var(--bg-void)]/50">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-primary)]">Bildirishnomalar</h4>
                  </div>
                  <div className="p-2 space-y-1">
                    {isAfterSix ? (
                      <button
                        onClick={() => {
                          handleExportExcel();
                          dispatch(setNotificationOpen(false));
                        }}
                        className="w-full flex items-center gap-3 p-3 hover:bg-[var(--gold-dim)] rounded-xl transition-all group text-left"
                      >
                        <div className="p-2 rounded-lg bg-[var(--gold-dim)] text-[var(--gold)] group-hover:bg-[var(--gold)] group-hover:text-black transition-colors">
                          <FileDown size={14} />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-[var(--text-primary)]">Hisobot tayyor</p>
                          <p className="text-[9px] text-[var(--text-muted)] font-medium">Hisobotni yuklab olishingiz mumkin</p>
                        </div>
                      </button>
                    ) : (
                      <div className="p-8 text-center">
                        <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest italic">Yangi xabarlar yo'q</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {hasPermission && isAfterSix && (
              <button
                onClick={handleExportExcel}
                disabled={isDownloading}
                className="lux-btn lux-btn-primary h-9 px-4 hidden sm:flex items-center gap-2"
              >
                <FileDown size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest">Hisobot</span>
              </button>
            )}
          </div>
        </header>

        <main className="lux-scroll animate-lux-fade" onClick={() => dispatch(setNotificationOpen(false))}>
          <GlobalContext.Provider value={{ admin }}>
            <div className="w-full mx-auto px-0">
              <div className="py-2 sm:py-6">
                <Outlet />
              </div>
            </div>
          </GlobalContext.Provider>
        </main>

        <MobileBottomNav />
      </div>
    </div>
  );
}
