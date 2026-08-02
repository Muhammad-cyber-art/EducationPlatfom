import React from "react";
import { ArrowLeft, Wallet, PlusCircle, TrendingDown, Verified, MinusCircle, Circle } from "lucide-react";
import { formatCurrency } from "./useKassa";
import ThemeToggle from "../../../ThemeToggle";

const KassaHeader = ({ navigate, totalToday, totalVerified, totalWithdrawn, onWithdraw, isSuperAdmin }) => (
    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 p-5 bg-[var(--bg-panel)]/40 border border-[#333] rounded-2xl shadow-xl backdrop-blur-xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--gold)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>

        <div className="flex items-center gap-6 relative z-10">
            <button
                onClick={() => navigate(-1)}
                className="w-12 h-12 flex items-center justify-center bg-[var(--bg-void)] border border-[var(--gold)]/20 rounded-xl text-[var(--gold)] hover:border-[var(--gold)] hover:bg-[var(--gold)] hover:text-black hover:scale-105 active:scale-95 transition-all duration-300 shadow-lg"
            >
                <ArrowLeft size={22} strokeWidth={2.5} />
            </button>
            <div>
                <div className="flex items-center gap-3">
                    <Wallet className="text-[var(--gold)]" size={24} />
                    <h1 className="text-2xl font-black text-white tracking-tight capitalize drop-shadow-sm">
                        Kassa Tizimi
                    </h1>
                </div>
                <p className="text-[9px] text-[var(--text-muted)] font-black uppercase tracking-[0.3em] mt-1.5 flex items-center gap-2">
                    <Circle size={6} className="fill-emerald-500 text-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                    Jonli Moliyaviy Tushumlar
                </p>
            </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 relative z-10 w-full xl:w-auto">
            <div className="px-5 py-3 bg-[var(--bg-void)]/60 border border-[var(--gold)]/20 rounded-xl group/total">
                <div className="flex items-center gap-2 mb-1 opacity-70">
                    <PlusCircle size={10} className="text-[var(--gold)]" />
                    <p className="text-[8px] font-black text-[var(--gold)] uppercase tracking-widest">Umumiy Kirim</p>
                </div>
                <span className="text-base font-black text-white tabular-nums tracking-tighter">{formatCurrency(totalToday)}</span>
            </div>

            <div className="px-5 py-3 bg-red-500/5 border border-red-500/20 rounded-xl group/withdraw">
                <div className="flex items-center gap-2 mb-1 opacity-70">
                    <TrendingDown size={10} className="text-red-500" />
                    <p className="text-[8px] font-black text-red-500 uppercase tracking-widest">Olingan</p>
                </div>
                <span className="text-base font-black text-red-500 tabular-nums tracking-tighter">{formatCurrency(totalWithdrawn)}</span>
            </div>

            <div className="px-5 py-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl group/verified">
                <div className="flex items-center gap-2 mb-1 opacity-70">
                    <Verified size={10} className="text-emerald-500" />
                    <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Tasdiqlangan</p>
                </div>
                <span className="text-base font-black text-emerald-500 tabular-nums tracking-tighter">{formatCurrency(totalVerified)}</span>
            </div>
        </div>

        <div className="relative z-10 flex items-center gap-3 shrink-0">
            {isSuperAdmin && (
                <button
                    onClick={onWithdraw}
                    className="px-6 xl:px-8 h-12 bg-red-600 hover:bg-red-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3 shrink-0"
                >
                    <MinusCircle size={16} />
                    Pul Olish
                </button>
            )}
            <ThemeToggle />
        </div>
    </div>
);

export default KassaHeader;
