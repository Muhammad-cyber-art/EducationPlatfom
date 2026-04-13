import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
    LayoutDashboard,
    Users,
    UserSquare2,
    Layers,
    Building2,
    X,
    User,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import api from "../../tokenUpdater/updater";
import { get_user_info } from "../Authorized/getRole";

export default function MobileBottomNav() {
    const fromToken = get_user_info();
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const currentBranchParam = searchParams.get("branch");
    const [showBranchModal, setShowBranchModal] = useState(false);

    // Fetch user data with accessible branches (same as sidebar)
    const { data: userMe } = useQuery({
        queryKey: ["user-me"],
        queryFn: () => api.get("/user/me/").then((res) => res.data),
        staleTime: 60 * 1000,
    });

    const userInfo =
        userMe && fromToken
            ? {
                ...fromToken,
                branch_id: userMe.branch?.id ?? fromToken.branch_id,
                branch_name: userMe.branch?.name ?? fromToken.branch_name,
                accessible_branches: Array.isArray(userMe.accessible_branches)
                    ? userMe.accessible_branches
                    : (fromToken.accessible_branches ?? []),
            }
            : fromToken;

    const getLinkWithBranch = (basePath) => {
        if (!currentBranchParam) return basePath;
        return `${basePath}?branch=${currentBranchParam}`;
    };

    const menuItems = [
        {
            name: "Asosiy",
            path: "/admin",
            icon: <LayoutDashboard size={18} />,
        },
        {
            name: "Guruhlar",
            path: "/admin/groups",
            icon: <Layers size={18} />
        },
        {
            name: "Mentorlar",
            path: "/admin/mentors",
            icon: <UserSquare2 size={18} />,
        },
        {
            name: "O'quvchilar",
            path: "/admin/all_students",
            icon: <Users size={18} />,
        },
        {
            name: "Profil",
            path: "/admin/profile",
            icon: <User size={18} />,
        },
    ];

    const hasExtraBranches = userInfo?.accessible_branches && userInfo.accessible_branches.length > 0;
    const currentPath = location.pathname;
    const activeBranchId = currentBranchParam ? Number(currentBranchParam) : userInfo?.branch_id || null;

    return (
        <>
            <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[var(--bg-panel)]/95 backdrop-blur-xl border-t border-[var(--border-glass)] flex items-center justify-between px-2 z-50">
                {menuItems.map((item) => {
                    const linkTo = getLinkWithBranch(item.path);
                    const isActive = location.pathname === item.path || (item.path !== "/admin" && location.pathname.startsWith(item.path));

                    return (
                        <NavLink
                            key={item.path}
                            to={linkTo}
                            className={({ isActive }) =>
                                `flex flex-col items-center justify-center gap-0.5 transition-all duration-300 px-2 py-1 rounded-xl
                ${isActive
                                    ? "text-[var(--gold)] scale-105"
                                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`
                            }
                        >
                            <div className={`${isActive ? "text-[var(--gold)] shadow-[0_0_10px_rgba(212,175,55,0.3)]" : ""}`}>
                                {item.icon}
                            </div>
                            <span className="text-[8px] font-bold tracking-tight">{item.name}</span>
                        </NavLink>
                    );
                })}

                {/* Filiallar tugmasi - faqat qo'shimcha filiallar bo'lsa */}
                {hasExtraBranches && (
                    <button
                        onClick={() => setShowBranchModal(true)}
                        className="flex flex-col items-center justify-center gap-0.5 transition-all duration-300 px-2 py-1 rounded-xl text-[var(--text-secondary)] hover:text-[var(--gold)]"
                    >
                        <div className="relative">
                            <Building2 size={18} />
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-[var(--gold)] text-black text-[7px] font-bold rounded-full flex items-center justify-center">
                                {userInfo.accessible_branches.length + 1}
                            </span>
                        </div>
                        <span className="text-[8px] font-bold tracking-tight">Filiallar</span>
                    </button>
                )}
            </div>

            {/* Filiallar Modal */}
            {showBranchModal && hasExtraBranches && (
                <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowBranchModal(false)}>
                    <div className="w-full md:w-auto md:min-w-[400px] max-w-md bg-[var(--bg-panel)] border-t md:border border-[var(--border-glass)] md:rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom md:slide-in-from-bottom-0 duration-300" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-[var(--border-glass)] bg-[var(--bg-void)]/40">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-[var(--gold)]/10 rounded-xl">
                                    <Building2 size={20} className="text-[var(--gold)]" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-[var(--text-primary)] uppercase tracking-tight">Filiallar</h3>
                                    <p className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-widest opacity-60">Ruxsat berilgan filiallar</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowBranchModal(false)}
                                className="p-2 hover:bg-[var(--bg-void)] rounded-xl transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-5 max-h-[60vh] overflow-y-auto">
                            <div className="space-y-2">
                                {/* Asosiy filial */}
                                <NavLink
                                    to={currentPath}
                                    onClick={() => setShowBranchModal(false)}
                                    className={`block p-4 rounded-2xl border transition-all duration-300 ${activeBranchId === userInfo?.branch_id || !currentBranchParam
                                        ? 'bg-[var(--gold)]/10 border-[var(--gold)]/30'
                                        : 'bg-[var(--bg-void)]/40 border-[var(--border-glass)] hover:border-[var(--border-glass)]'
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`p-2 rounded-xl ${activeBranchId === userInfo?.branch_id || !currentBranchParam
                                            ? 'bg-[var(--gold)] text-black'
                                            : 'bg-[var(--bg-panel)] text-[var(--gold)]'
                                            }`}>
                                            <Building2 size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1 flex items-center gap-2">
                                                {userInfo.branch_name}
                                                <span className="text-[8px] bg-[var(--gold)] text-black px-2 py-0.5 rounded font-black uppercase tracking-wider">Asosiy</span>
                                            </h4>
                                            <p className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-widest opacity-40">
                                                Asosiy filial
                                            </p>
                                        </div>
                                    </div>
                                </NavLink>

                                {/* Qo'shimcha filiallar */}
                                {userInfo.accessible_branches
                                    .filter(b => b.branch_id !== userInfo.branch_id)
                                    .map((branch) => (
                                        <NavLink
                                            key={branch.branch_id}
                                            to={`${currentPath}?branch=${branch.branch_id}`}
                                            onClick={() => setShowBranchModal(false)}
                                            className={`block p-4 rounded-2xl border transition-all duration-300 ${activeBranchId === branch.branch_id
                                                ? 'bg-[var(--gold)]/10 border-[var(--gold)]/30'
                                                : 'bg-[var(--bg-void)]/40 border-[var(--border-glass)] hover:border-[var(--border-glass)]'
                                                }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`p-2 rounded-xl ${activeBranchId === branch.branch_id
                                                    ? 'bg-[var(--gold)] text-black'
                                                    : 'bg-[var(--bg-panel)] text-[var(--gold)]'
                                                    }`}>
                                                    <Building2 size={18} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1">
                                                        {branch.branch_name}
                                                    </h4>
                                                    <p className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-widest opacity-60">
                                                        {branch.access_level === "admin"
                                                            ? "To'liq admin"
                                                            : branch.access_level === "edit"
                                                                ? "Tahrirlash"
                                                                : "Faqat ko'rish"}
                                                    </p>
                                                </div>
                                            </div>
                                        </NavLink>
                                    ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
