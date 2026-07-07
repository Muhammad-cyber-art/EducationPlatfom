import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { UserX, Globe, Search, Loader2, Download, CheckCircle, PhoneCall } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../tokenUpdater/updater';
import toast from 'react-hot-toast';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

const AbsentStudentsModal = ({ isOpen, onClose, branchId }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const handleDownloadExcel = async () => {
    if (!branchId) return;
    try {
      setDownloading(true);
      const response = await api.get(`/finance/statistics/absent-students/${branchId}/`, {
        params: { export: 'excel', search: searchTerm },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const today = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `kelmaganlar_${today}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Excel yuklandi.");
    } catch (err) {
      console.error("Excel download error:", err);
      toast.error("Excel yuklashda xatolik.");
    } finally {
      setDownloading(false);
    }
  };

  const fetchStudents = useCallback(async (pageNum, searchStr, isNewSearch = false) => {
    if (!branchId) return;
    try {
      setLoading(true);
      const res = await api.get(`/finance/statistics/absent-students/${branchId}/`, {
        params: {
          page: pageNum,
          search: searchStr
        }
      });

      const newResults = res.data.results || [];
      if (isNewSearch) {
        setData(newResults);
      } else {
        setData(prev => [...prev, ...newResults]);
      }

      setHasMore(res.data.next !== null);
    } catch (err) {
      console.error("Error fetching absent students:", err);
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    if (isOpen) {
      setPage(1);
      setData([]);
      setHasMore(true);
      setSearchTerm('');
      fetchStudents(1, '', true);
    }
  }, [isOpen, fetchStudents]);

  // Handle search with debounce
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      setPage(1);
      fetchStudents(1, searchTerm, true);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, isOpen, fetchStudents]);

  const handleScroll = (e) => {
    const { scrollTop, clientHeight, scrollHeight } = e.target;
    // Load more when reaching bottom
    if (scrollHeight - scrollTop <= clientHeight * 1.2 && !loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchStudents(nextPage, searchTerm, false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", bounce: 0, duration: 0.4 }}
        className="bg-[var(--bg-panel)] border border-[var(--border-glass)] shadow-2xl rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col relative z-[99999] overflow-hidden"
      >
        {/* Header - Changed from gold to rose/red theme for absent context */}
        <div className="p-4 sm:px-6 sm:py-5 border-b border-[var(--border-glass)] flex justify-between items-center bg-[var(--bg-panel)] relative overflow-hidden">
          {/* Decorative background gradient */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          
          <div className="flex items-center gap-3 relative z-10">
            <div className="p-2.5 bg-rose-500/10 rounded-xl border border-rose-500/20 text-rose-500">
              <UserX size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black capitalize tracking-tight text-[var(--text-primary)]">Kelmagan O'quvchilar</h3>
              <p className="text-[10px] font-bold text-rose-500/80 uppercase tracking-widest mt-0.5">Nazorat • Bugun</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 relative z-10">
            <button
              onClick={handleDownloadExcel}
              disabled={downloading || data.length === 0}
              title="Excel yuklab olish"
              className="px-3 py-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl hover:bg-emerald-500 hover:text-white transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-widest">Excel</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all active:scale-95"
            >
              <Globe size={18} className="rotate-45" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-4 sm:px-6 py-3 border-b border-[var(--border-glass)] bg-[var(--bg-void)]/30 relative z-10">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--text-muted)] group-focus-within:text-rose-500 transition-colors">
              <Search size={16} />
            </div>
            <input
              type="text"
              placeholder="O'quvchi ismi, familiyasi yoki guruh nomi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] focus:border-rose-500/50 focus:ring-2 focus:ring-rose-500/10 rounded-xl py-2.5 pl-10 pr-10 text-xs sm:text-sm font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-all"
            />
            {loading && searchTerm && (
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-rose-500">
                <Loader2 size={14} className="animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* List Content */}
        <div
          className="p-4 sm:px-6 sm:py-5 flex-1 overflow-y-auto custom-scrollbar bg-[var(--bg-void)]/20 relative"
          onScroll={handleScroll}
        >
          {data.length > 0 ? (
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 md:grid-cols-2 gap-3"
            >
              {data.map((student, idx) => (
                <motion.div 
                  key={`${student.id}-${idx}`} 
                  variants={itemVariants}
                  className="p-4 bg-[var(--bg-panel)] hover:bg-rose-500/5 transition-all border border-[var(--border-glass)] hover:border-rose-500/30 rounded-2xl flex flex-col justify-between group relative overflow-hidden"
                >
                  {/* Subtle left border accent indicating absence */}
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500/50 group-hover:bg-rose-500 transition-colors" />
                  
                  <div className="flex items-start justify-between gap-2 pl-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-bold text-[var(--text-primary)] truncate" title={student.name}>
                          {student.name}
                        </h4>
                        <span className="shrink-0 px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-500 text-[9px] font-black uppercase tracking-widest border border-rose-500/20">
                          Kelmagan
                        </span>
                      </div>
                      <span className="text-xs text-[var(--text-muted)] font-medium truncate flex items-center gap-1.5" title={student.group}>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-[var(--border-glass)] group-hover:bg-rose-500/50 transition-colors" />
                        {student.group}
                      </span>
                    </div>

                    {/* Phone Call Action */}
                    {student.phone ? (
                      <a 
                        href={`tel:${student.phone}`}
                        className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20 hover:bg-blue-500 hover:text-white transition-all hover:scale-105 active:scale-95 shadow-sm"
                        title="Qo'ng'iroq qilish"
                      >
                        <PhoneCall size={18} />
                      </a>
                    ) : (
                      <div className="shrink-0 w-10 h-10 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-muted)]/50 cursor-not-allowed">
                        <PhoneCall size={18} />
                      </div>
                    )}
                  </div>
                  
                  {student.phone && (
                     <div className="mt-3 pl-2">
                        <span className="text-[10px] font-mono text-[var(--text-secondary)] bg-[var(--bg-void)] px-2 py-1 rounded-lg border border-[var(--border-glass)]">
                           {student.phone}
                        </span>
                     </div>
                  )}
                </motion.div>
              ))}
            </motion.div>
          ) : !loading ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="h-full flex flex-col items-center justify-center text-center py-10"
            >
              <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mb-4 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
                <CheckCircle size={36} strokeWidth={2.5} />
              </div>
              <h3 className="text-lg font-black text-[var(--text-primary)] mb-1.5">Barchasi joyida!</h3>
              <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium max-w-[250px] mx-auto leading-relaxed">
                {searchTerm 
                  ? "Qidiruvingiz bo'yicha hech qanday kelmagan o'quvchi topilmadi." 
                  : "Bugungi barcha darslarda davomat to'liq. Barcha o'quvchilar ishtirok etmoqda."}
              </p>
            </motion.div>
          ) : null}

          {loading && data.length > 0 && (
            <div className="py-4 flex justify-center text-rose-500">
              <Loader2 size={20} className="animate-spin" />
            </div>
          )}
          {loading && data.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-panel)]/50 backdrop-blur-sm z-10">
              <Loader2 size={32} className="animate-spin text-rose-500" />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:px-6 border-t border-[var(--border-glass)] flex justify-between items-center bg-[var(--bg-panel)] z-10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            Jami kelmaganlar: <span className="text-rose-500 text-xs">{data.length}</span>
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-[var(--bg-void)] border border-[var(--border-glass)] hover:bg-[var(--text-primary)] hover:text-[var(--bg-panel)] rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all active:scale-95"
          >
            Yopish
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

export default AbsentStudentsModal;
