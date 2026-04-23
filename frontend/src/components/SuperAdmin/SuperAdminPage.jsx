import { Users, UserCheck, GraduationCap, Building2, ArrowUpRight, Send, Globe, Loader2, Sparkles, Activity, ShieldCheck, Zap, MessageSquare, UserPlus as UserPlusIcon, Heart, Download } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useOutletContext } from 'react-router-dom';
import api from '../../tokenUpdater/updater';
import toast from 'react-hot-toast';
import AbsentStudentsModal from '../Common/AbsentStudentsModal';
import { useState, useEffect } from 'react';
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
    <div className="animate-lux-fade space-y-10">
      {/* Atmosphere Background */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-[var(--gold)]/5 rounded-full blur-[140px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-[var(--gold)]/5 rounded-full blur-[120px]"></div>
      </div>

      {/* HEADER ACTION AREA */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[var(--border-glass)]">
        <div>
          <h1 className="text-4xl font-black text-[var(--text-primary)] tracking-tighter uppercase mb-2">Markaziy Boshqaruv</h1>
          <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-[0.4em] flex items-center gap-3">
            <ShieldCheck size={12} className="text-[var(--gold)]" /> Tizimning asosiy boshqaruv paneli
          </p>
        </div>
        <div className="px-4 py-2 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/20 text-[9px] font-black uppercase tracking-widest text-[var(--gold)]">
          Holat: To'liq boshqaruv
        </div>
      </div>

      {/* STATS MATRIX */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard onClick={() => navigate('admins')} title="Adminstratorlar" value={stats?.admins || 0} icon={<ShieldCheck size={20} />} trend="STAFF" delay="0" />
        <StatCard onClick={() => navigate('mentors')} title="Mentorlar" value={stats?.mentors || 0} icon={<UserCheck size={20} />} trend="STAFF" delay="100" />
        <StatCard onClick={() => navigate('all_students')} title="O'quvchilar" value={stats?.students || 0} icon={<Users size={20} />} trend="STUDENTS" delay="200" />
        <StatCard onClick={() => navigate('groups')} title="Guruhlar" value={stats?.groups || 0} icon={<Building2 size={20} />} trend="GROUPS" delay="300" />
      </div>

      {/* ATTENDANCE & BOT STATS MATRIX */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          className="lux-card p-6 flex flex-col justify-between border-emerald-500/20 col-span-2 lg:col-span-1 cursor-pointer hover:border-red-500/50 hover:scale-[1.02] transition-all"
          onClick={() => setShowAbsentModal(true)}
          title="Kelmaganlar ro'yxatini ko'rish"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-500">
              <Activity size={20} />
            </div>
            <div className="px-2 py-1 rounded-full text-[8px] font-black tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase">
              Bugun
            </div>
          </div>
          <div>
            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-[0.4em] mb-2">Davomat Ko'rsatkichi</p>
            <div className="flex items-end justify-between">
              <div>
                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest">Bugungi Kelmaganlar</h3>
              </div>
              <div className="text-right">
                <p className="text-4xl font-black text-red-500 italic font-mono drop-shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                  {stats?.attendance_today?.absent || 0}
                </p>
                <p className="text-[7px] font-black text-red-500/60 uppercase tracking-widest mt-1">Kelmaganlar soni</p>
              </div>
            </div>
            {/* Progress bar showing absence ratio */}
            <div className="w-full h-1.5 bg-[var(--bg-void)] rounded-full mt-4 overflow-hidden border border-[var(--border-glass)]">
              <div
                className="h-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] transition-all duration-1000"
                style={{ width: `${stats?.attendance_today?.total > 0 ? (stats?.attendance_today?.absent / stats?.attendance_today?.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
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
      </div>

      {/* BROADCAST CENTER */}
      <div className="lux-card !p-8 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--gold)]/5 blur-[80px] -translate-y-1/2 translate-x-1/2 rounded-full" />

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 relative z-10">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--gold)] shadow-inner group-hover:scale-110 transition-transform duration-500">
              <Zap size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tight italic">Tezkor xabar yuborish</h3>
              <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] mt-1">Telegram bot orqali barchaga xabar yuborish</p>
            </div>
          </div>

          <div
            onClick={() => setIsGlobal(!isGlobal)}
            className={`flex items-center gap-3 px-5 py-3 rounded-xl border transition-all cursor-pointer select-none active:scale-95
              ${isGlobal ? "bg-[var(--gold-dim)] border-[var(--gold)]/30 text-[var(--gold)]" : "bg-[var(--bg-void)]/60 border-[var(--border-glass)] text-[var(--text-secondary)]"}`}
          >
            <Globe size={14} className={isGlobal ? "animate-spin-slow" : "opacity-40"} />
            <span className="text-[10px] font-black uppercase tracking-widest">{isGlobal ? "Barchaga xabar yozish" : "Kimlarga xabar yuborilsin?"}</span>
          </div>
        </div>

        <div className="relative z-10">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={isGlobal ? "BARCHAGA XABAR YOZING..." : "USHBU FILIALGA XABAR YOZING..."}
            className="w-full bg-[var(--bg-void)]/40 border border-[var(--border-glass)] focus:border-[var(--gold)]/50 rounded-2xl p-6 text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-all min-h-[160px] resize-none shadow-inner uppercase tracking-wide"
          />
          <div className="flex justify-end mt-6">
            <button
              onClick={handleSendMessage}
              disabled={loading || !message.trim()}
              className="lux-btn !h-14 !px-10 !bg-[var(--gold)] !text-black !border-none !rounded-xl shadow-[0_0_30px_rgba(184,134,11,0.3)] hover:shadow-[0_0_40px_rgba(184,134,11,0.5)] transition-all flex items-center gap-4 relative overflow-hidden group/btn"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300" />
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              <span className="text-[11px] font-black uppercase tracking-[0.2em] relative z-10">{loading ? "Yuborilmoqda..." : "Xabarni yuborish"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* <div className="lux-card !p-8 flex items-center justify-between border-dashed border-[var(--border-glass)] bg-transparent opacity-60">
        <div className="flex flex-col gap-2">
          <h4 className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-[0.4em]">Umumiy tahlillar</h4>
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map(i => <div key={i} className="w-8 h-8 rounded-full border-2 border-[var(--bg-panel)] bg-[var(--gold-dim)]" />)}
            </div>
            <p className="text-[9px] font-bold text-[var(--text-secondary)]">Filiallar faoliyati</p>
          </div>
        </div>
        <Activity size={24} className="text-[var(--gold)] opacity-20" />
      </div> */}

      {/* ABSENT STUDENTS MODAL */}
      <AbsentStudentsModal
        isOpen={showAbsentModal}
        onClose={() => setShowAbsentModal(false)}
        branchId={branchId}
      />
    </div>
  );
};

const StatCard = ({ onClick, title, value, icon, trend, delay, variant = "default", actionButton }) => {
  return (
    <div
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
      className={`lux-card group relative p-6 cursor-pointer hover:border-[var(--gold)]/40 animate-in slide-in-from-bottom-4 duration-700 overflow-hidden ${variant === "gold" ? "border-[var(--gold)]/20" : ""}`}
    >
      <div className={`absolute top-0 left-0 w-1 h-full bg-[var(--gold)] transition-opacity ${variant === "gold" ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`} />
      <div className="flex items-center justify-between mb-8">
        <div className={`p-3 bg-[var(--bg-void)]/60 rounded-xl border border-[var(--border-glass)] shadow-inner group-hover:scale-110 transition-transform duration-500 ${variant === "gold" ? "text-[var(--gold)] border-[var(--gold)]/20" : "text-[var(--gold)]"}`}>
          {icon}
        </div>
        <div className="flex items-center gap-2">
          {actionButton}
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[8px] font-black tracking-widest border ${variant === "gold" ? "bg-[var(--gold-dim)] text-[var(--gold)] border-[var(--gold)]/20" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"}`}>
            <ArrowUpRight size={10} /> {trend}{!isNaN(trend) ? "%" : ""}
          </div>
        </div>
      </div>
      <div>
        <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-[0.4em] mb-2 group-hover:translate-x-1 transition-transform">{variant === "gold" ? "Bot Statistikasi" : "Statistika"}</p>
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest">{title}</h3>
          {value !== undefined && <span className="text-xl font-black text-[var(--gold)] italic">{value}</span>}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;