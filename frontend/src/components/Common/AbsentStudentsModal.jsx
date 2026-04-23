import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Activity, Globe, Search, Loader2, Phone, Download } from 'lucide-react';
import api from '../../tokenUpdater/updater';
import toast from 'react-hot-toast';

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
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-[var(--bg-panel)] border border-[var(--border-glass)] shadow-2xl rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col relative z-[99999] overflow-hidden">

                {/* Header */}
                <div className="p-4 sm:px-6 sm:py-5 border-b border-[var(--border-glass)] flex justify-between items-center bg-[var(--bg-panel)]">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-[var(--gold)]/10 rounded-xl border border-[var(--gold)]/20 text-[var(--gold)]">
                            <Activity size={20} />
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-[var(--text-primary)]">Bugun Kelmaganlar</h3>
                            <p className="text-[9px] font-black text-[var(--gold)]/80 uppercase tracking-widest mt-0.5">Davomat Nazorati</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDownloadExcel}
                            disabled={downloading || data.length === 0}
                            title="Excel yuklab olish"
                            className="p-2.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl hover:bg-emerald-500 hover:text-white transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                            <span className="hidden sm:inline text-[9px] font-black uppercase tracking-widest">Excel</span>
                        </button>

                        <button
                            onClick={onClose}
                            className="p-2 text-[var(--text-muted)] hover:text-[var(--gold)] hover:bg-[var(--gold)]/10 rounded-xl transition-all active:scale-95"
                        >
                            <Globe size={18} className="rotate-45" />
                        </button>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="px-4 sm:px-6 py-3 border-b border-[var(--border-glass)] bg-[var(--bg-void)]/30">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--text-muted)]">
                            <Search size={14} />
                        </div>
                        <input
                            type="text"
                            placeholder="Ismi, familiyasi yoki guruhni qidirish..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] focus:border-[var(--gold)]/50 rounded-xl py-2.5 pl-10 pr-3 text-[11px] sm:text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-all uppercase tracking-wider"
                        />
                    </div>
                </div>

                {/* List Content */}
                <div
                    className="p-4 sm:px-6 sm:py-4 flex-1 overflow-y-auto space-y-2 custom-scrollbar bg-[var(--bg-void)]/10"
                    onScroll={handleScroll}
                >
                    {data.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
                            {data.map((student, idx) => (
                                <div key={`${student.id}-${idx}`} className="p-3 bg-[var(--bg-void)]/40 hover:bg-[var(--gold)]/5 transition-all border border-[var(--border-glass)] hover:border-[var(--gold)]/30 rounded-xl flex flex-col group">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--gold)] flex items-center justify-center font-black text-xs group-hover:bg-[var(--gold)]/10 transition-colors">
                                                {student.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-tight">{student.name}</p>
                                                <p className="text-[8px] text-[var(--text-muted)] font-black uppercase tracking-widest mt-0.5">{student.group}</p>
                                            </div>
                                        </div>
                                    </div>
                                    {student.phone && (
                                        <div className="mt-2.5 inline-flex items-center gap-1.5 px-2 py-1 bg-[var(--bg-panel)]/50 rounded-lg border border-[var(--border-glass)] text-[9px] font-black text-[var(--text-secondary)] self-start">
                                            <Phone size={10} className="text-[var(--gold)]" />
                                            <a href={`tel:${student.phone}`} className="hover:text-[var(--text-primary)] transition-colors">{student.phone}</a>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : !loading ? (
                        <div className="text-center py-20 opacity-50 flex flex-col items-center">
                            <Activity size={48} className="text-[var(--text-muted)] mb-4 opacity-50" />
                            <p className="text-xs sm:text-sm font-black uppercase tracking-widest text-[var(--text-primary)] mb-1">Ma'lumot topilmadi</p>
                            <p className="text-[10px] sm:text-xs text-[var(--text-muted)] font-medium">Barchasi joyida, yo'qlar yo'q ro'yxatida yozishgan bo'lsa topishingiz mumkin.</p>
                        </div>
                    ) : null}

                    {loading && (
                        <div className="py-6 flex justify-center text-[var(--gold)]">
                            <Loader2 size={24} className="animate-spin" />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 sm:px-6 border-t border-[var(--border-glass)] flex justify-between items-center bg-[var(--bg-panel)]">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                        Topilgan: <span className="text-[var(--gold)]">{data.length}</span>
                    </p>
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-[var(--bg-void)] border border-[var(--border-glass)] hover:bg-[var(--gold)]/10 hover:text-[var(--gold)] hover:border-[var(--gold)]/30 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                    >
                        Yopish
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default AbsentStudentsModal;
