import { Users, UserCheck, Building2, ShieldCheck, MessageSquare, Download, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useOutletContext } from 'react-router-dom';
import api from '../../tokenUpdater/updater';
import toast from 'react-hot-toast';
import AbsentStudentsModal from '../Common/AbsentStudentsModal';
import { useState } from 'react';
import { BotConnectionsChart, AbsenteesChart, StudentGrowthChart } from './charts/AnalyticsCharts';
import { AttendanceCard, BroadcastSection, StatCard } from './cards/DashboardCards';

const SuperAdminDashboard = () => {
    const navigate = useNavigate();
    const { branchId } = useOutletContext() || {};
    const [message, setMessage] = useState("");
    const [isGlobal, setIsGlobal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [downloadingBotList, setDownloadingBotList] = useState(false);
    const [showAbsentModal, setShowAbsentModal] = useState(false);

    const handleDownloadBotUnregistered = async (e) => {
        e.stopPropagation(); // Card bosilishini to'xtatamiz
        try {
            setDownloadingBotList(true);
            const response = await api.get('/bot/export-unregistered-students/', {
                params: { branch_id: branchId },
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'botdan_otmaganlar.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success("Excel yuklandi.");
        } catch (err) {
            toast.error("Xatolik yuz berdi.");
        } finally {
            setDownloadingBotList(false);
        }
    };

    const { data: botStats, isLoading: botStatsLoading } = useQuery({
        queryKey: ['bot-stats', branchId],
        queryFn: () => api.get(`/bot/statistics/?branch_id=${branchId}`).then(res => res.data),
        enabled: !!branchId,
    });

    const { data: branchFinance, isLoading: financeLoading } = useQuery({
        queryKey: ['branch-finance', branchId],
        queryFn: () => api.get(`/finance/statistics/branch-finance/${branchId}/`).then(res => res.data),
        enabled: !!branchId,
    });



    const { data: growthData, isLoading: growthLoading } = useQuery({
        queryKey: ['growth-statistics', branchId],
        queryFn: () => api.get(`/groups/students/growth_statistics/?branch_id=${branchId}`).then(res => res.data),
        enabled: !!branchId,
    });

    const stats = branchFinance?.stats;

    const handleSendMessage = async () => {
        if (!message.trim()) {
            toast.error("Xabar matnini kiriting.");
            return;
        }

        setLoading(true);
        try {
            await api.post('/bot/broadcast/', {
                message: message,
                branch_id: isGlobal ? null : branchId,
                send_to_all_branches: isGlobal
            });
            toast.success(isGlobal ? "Xabar barchaga yuborildi." : "Xabar yuborildi.");
            setMessage("");
        } catch (err) {
            toast.error("Xabarni yuborishda xatolik.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-lux-fade space-y-4 md:space-y-10">
            {/* Atmosphere Background */}
            <div className="fixed inset-0 pointer-events-none -z-10">
                <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-[var(--gold)]/5 rounded-full blur-[140px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-[var(--gold)]/5 rounded-full blur-[120px]"></div>
            </div>

            {/* HEADER ACTION AREA */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 md:gap-6 pb-4 md:pb-6 border-b border-[var(--border-glass)]">
                <div>
                    <h1 className="text-2xl md:text-4xl font-black text-[var(--text-primary)] tracking-tighter capitalize mb-1">Markaziy Boshqaruv</h1>
                    <p className="text-[9px] md:text-[10px] text-[var(--text-muted)] font-black capitalize tracking-[0.3em] flex items-center gap-2">
                        <ShieldCheck size={11} className="text-[var(--gold)]" /> Tizimning asosiy boshqaruv paneli
                    </p>
                </div>
                <div className="hidden md:block px-4 py-2 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/20 text-[9px] font-black capitalize tracking-widest text-[var(--gold)]">
                    Holat: To'liq boshqaruv
                </div>
            </div>

            {/* STATS MATRIX */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                <StatCard onClick={() => navigate('admins')} title="Adminstratorlar" value={stats?.admins || 0} icon={<ShieldCheck size={16} />} trend="STAFF" delay="0" />
                <StatCard onClick={() => navigate('mentors')} title="Mentorlar" value={stats?.mentors || 0} icon={<UserCheck size={16} />} trend="STAFF" delay="100" />
                <StatCard onClick={() => navigate('all_students')} title="O'quvchilar" value={stats?.students || 0} icon={<Users size={16} />} trend="STUDENTS" delay="200" />
                <StatCard onClick={() => navigate('groups')} title="Guruhlar" value={stats?.groups || 0} icon={<Building2 size={16} />} trend="GROUPS" delay="300" />
            </div>

            {/* ATTENDANCE, BOT STATS & BROADCAST MATRIX */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-6">
                <AttendanceCard
                    absentCount={stats?.attendance_today?.absent || 0}
                    totalCount={stats?.attendance_today?.total || 0}
                    onClick={() => setShowAbsentModal(true)}
                />
                <StatCard
                    title="Bot Ulanmalari"
                    value={botStats?.total_bot_users || 0}
                    icon={<MessageSquare size={20} />}
                    trend="BOT"
                    delay="400"
                    variant="gold"
                    actionButton={
                        <button
                            onClick={handleDownloadBotUnregistered}
                            disabled={downloadingBotList}
                            className="p-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white rounded-lg transition-all"
                            title="Ro'yxatdan o'tmaganlarni yuklash"
                        >
                            {downloadingBotList ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                        </button>
                    }
                />
                <BroadcastSection
                    message={message}
                    setMessage={setMessage}
                    isGlobal={isGlobal}
                    setIsGlobal={setIsGlobal}
                    onSend={handleSendMessage}
                    loading={loading}
                />
            </div>

            {/* PIE CHARTS - 2 column on mobile */}
            <div className="grid grid-cols-2 lg:grid-cols-2 gap-3 md:gap-6">
                <BotConnectionsChart botStats={botStats} />
                <AbsenteesChart stats={stats} />
            </div>



            {/* GROWTH CHART */}
            <StudentGrowthChart data={growthData} />

            {/* ABSENT STUDENTS MODAL */}
            <AbsentStudentsModal
                isOpen={showAbsentModal}
                onClose={() => setShowAbsentModal(false)}
                branchId={branchId}
            />
        </div>
    );
};

export default SuperAdminDashboard;