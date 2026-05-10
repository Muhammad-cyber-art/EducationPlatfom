import React from "react";
import { ArrowLeft, Wallet, PlusCircle, TrendingDown, Verified, MinusCircle, Circle } from "lucide-react";
import { formatCurrency } from "./useKassa";

const KassaHeader = ({ navigate, totalToday, totalVerified, totalWithdrawn, onWithdraw, isSuperAdmin }) => (
    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 p-6 bg-[var(--bg-panel)]/40 border border-[var(--border-glass)] rounded-[2.5rem] shadow-2xl backdrop-blur-xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--gold)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>

        <div className="flex items-center gap-6 relative z-10">
            <button
                onClick={() => navigate(-1)}
                className="w-14 h-14 flex items-center justify-center bg-[var(--bg-void)] border border-[var(--gold)]/20 rounded-[1.25rem] text-[var(--gold)] hover:border-[var(--gold)] hover:bg-[var(--gold)] hover:text-black hover:scale-110 active:scale-95 transition-all duration-300 shadow-lg"
            >
                <ArrowLeft size={24} strokeWidth={2.5} />
            </button>
            <div>
                <div className="flex items-center gap-3">
                    <Wallet className="text-[var(--gold)]" size={28} />
                    <h1 className="text-3xl font-black text-white tracking-tighter capitalize drop-shadow-sm">
                        Kassa Tizimi
                    </h1>
                </div>
                <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-[0.4em] mt-2 flex items-center gap-3">
                    <Circle size={8} className="fill-emerald-500 text-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                    Jonli Moliyaviy Tushumlar
                </p>
            </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10 w-full xl:w-auto">
            <div className="px-6 py-4 bg-[var(--bg-void)]/60 border border-[var(--gold)]/20 rounded-[2rem] group/total">
                <div className="flex items-center gap-2 mb-1.5 opacity-70">
                    <PlusCircle size={10} className="text-[var(--gold)]" />
                    <p className="text-[8px] font-black text-[var(--gold)] uppercase tracking-widest">Umumiy Kirim</p>
                </div>
                <span className="text-lg font-black text-white tabular-nums tracking-tighter">{formatCurrency(totalToday)}</span>
            </div>

            <div className="px-6 py-4 bg-red-500/5 border border-red-500/20 rounded-[2rem] group/withdraw">
                <div className="flex items-center gap-2 mb-1.5 opacity-70">
                    <TrendingDown size={10} className="text-red-500" />
                    <p className="text-[8px] font-black text-red-500 uppercase tracking-widest">Olingan</p>
                </div>
                <span className="text-lg font-black text-red-500 tabular-nums tracking-tighter">{formatCurrency(totalWithdrawn)}</span>
            </div>

            <div className="px-6 py-4 bg-emerald-500/5 border border-emerald-500/20 rounded-[2rem] group/verified">
                <div className="flex items-center gap-2 mb-1.5 opacity-70">
                    <Verified size={10} className="text-emerald-500" />
                    <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Tasdiqlangan</p>
                </div>
                <span className="text-lg font-black text-emerald-500 tabular-nums tracking-tighter">{formatCurrency(totalVerified)}</span>
            </div>
        </div>

        {isSuperAdmin && (
            <button
                onClick={onWithdraw}
                className="relative z-10 px-6 xl:px-8 h-12 xl:h-14 bg-red-600 hover:bg-red-500 text-white font-black text-[10px] xl:text-xs uppercase tracking-widest rounded-2xl transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 shrink-0"
            >
                <MinusCircle size={18} />
                Pul Olish
            </button>
        )}
    </div>
);

export default KassaHeader;
