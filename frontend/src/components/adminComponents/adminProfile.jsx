import React, { useReducer, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Loader2, ShieldCheck, ChevronRight, CreditCard } from "lucide-react";

// Hooks
import { useAdminProfile } from "./AdminProfile/useAdminProfile";
import { useAdminActions } from "./AdminProfile/useAdminActions";

// Components
import AdminHeader from "./AdminProfile/AdminHeader";
import AdminHero from "./AdminProfile/AdminHero";
import AdminEditForm from "./AdminProfile/AdminEditForm";
import AdminDetailsGrid from "./AdminProfile/AdminDetailsGrid";
import AdminBranches from "./AdminProfile/AdminBranches";
import AdminModals from "./AdminProfile/AdminModals";

const initialState = {
    isPermModalOpen: false,
    isEditModalOpen: false,
    isTransferModalOpen: false,
    editForm: { first_name: "", last_name: "", phone_number: "", username: "", password: "", is_active: true },
    permissions: {},
    showPassword: false,
};

function reducer(state, action) {
    switch (action.type) {
        case 'TOGGLE_PERM_MODAL': return { ...state, isPermModalOpen: action.payload };
        case 'TOGGLE_EDIT_MODAL': return { ...state, isEditModalOpen: action.payload };
        case 'TOGGLE_TRANSFER_MODAL': return { ...state, isTransferModalOpen: action.payload };
        case 'SET_EDIT_FORM': return { ...state, editForm: action.payload };
        case 'UPDATE_EDIT_FIELD': return { ...state, editForm: { ...state.editForm, ...action.payload } };
        case 'SET_PERMISSIONS': return { ...state, permissions: action.payload };
        case 'TOGGLE_PERMISSION_KEY':
            return { ...state, permissions: { ...state.permissions, [action.key]: !state.permissions[action.key] } };
        case 'TOGGLE_SHOW_PASSWORD': return { ...state, showPassword: !state.showPassword };
        default: return state;
    }
}

const AdminProfile = () => {
    const navigate = useNavigate();
    const { admin_id } = useParams();
    const queryClient = useQueryClient();
    const [state, dispatch] = useReducer(reducer, initialState);

    const { admin, staffBranches, loading, error, user_info, refetchBranches } = useAdminProfile(admin_id, dispatch);
    const { archiveMutation, updateMutation, permMutation, removeBranchMutation, handleEditOpen, LogOut } = useAdminActions(admin_id, admin, dispatch, navigate, refetchBranches);

    useEffect(() => {
        if (error) {
            toast.error("Ruxsat rad etildi.");
            navigate(-1);
        }
    }, [error, navigate]);

    if (loading || !admin) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 size={32} className="text-[var(--gold)] animate-spin" />
            </div>
        );
    }

    return (
        <div className="w-full min-h-screen relative pb-20 animate-lux-fade font-sans selection:bg-[var(--gold)]/20 text-[var(--text-primary)]">
            {/* Atmosphere & Background */}
            <div className="fixed inset-0 pointer-events-none -z-10 bg-[var(--bg-void)]">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[var(--gold)]/5 rounded-full blur-[100px] opacity-60" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] opacity-40" />
            </div>

            <AdminHeader
                {...{ admin_id, user_info, dispatch, handleEditOpen, archiveMutation, updateMutation, LogOut }}
                isEditModalOpen={state.isEditModalOpen}
                editForm={state.editForm}
            />

            <div className="max-w-5xl mx-auto px-4 md:px-8 pt-6 md:pt-10 space-y-6 md:space-y-8">
                {state.isEditModalOpen ? (
                    <AdminEditForm
                        {...{ updateMutation, dispatch }}
                        editForm={state.editForm}
                        showPassword={state.showPassword}
                    />
                ) : (
                    <>
                        <AdminHero admin={admin} />

                        {/* Permissions Compact Button */}
                        {user_info.role === "super_admin" && (
                            <button
                                onClick={() => dispatch({ type: 'TOGGLE_PERM_MODAL', payload: true })}
                                className="w-full group relative overflow-hidden p-1 rounded-2xl transition-all active:scale-[0.99] focus:outline-none"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 opacity-10 group-hover:opacity-20 transition-opacity duration-500" />
                                <div className="relative bg-[var(--bg-panel)]/80 backdrop-blur-md border border-indigo-500/30 group-hover:border-indigo-500/60 rounded-xl px-4 py-3 md:px-6 md:py-4 flex items-center justify-between transition-all shadow-lg shadow-indigo-500/5">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl group-hover:bg-indigo-500 group-hover:text-white transition-colors duration-300">
                                            <ShieldCheck size={20} />
                                        </div>
                                        <div className="text-left">
                                            <h3 className="text-[10px] md:text-xs font-black text-[var(--text-primary)] capitalize tracking-widest group-hover:text-indigo-300 transition-colors">Ruxsatlar Tizimi</h3>
                                            <p className="text-[8px] md:text-[9px] text-[var(--text-muted)] capitalize tracking-wider hidden sm:block">Xodimning tizimdagi huquqlarini boshqarish</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-indigo-400/60 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all">
                                        <span className="text-[9px] font-black capitalize tracking-widest hidden sm:inline-block">Tahrirlash</span>
                                        <ChevronRight size={16} />
                                    </div>
                                </div>
                            </button>
                        )}

                        <AdminDetailsGrid admin={admin} />

                        {/* MOLIYA DAFTARI LINK */}
                        {!admin_id && user_info?.role === "admin" && state.permissions?.pay_slip !== false && (
                            <div className="pt-2">
                                <button
                                    onClick={() => navigate('/admin/finance')}
                                    className="w-full lux-card hover:transform-none! p-5 flex items-center justify-between group border-[var(--gold)]/20 shadow-xl bg-[var(--gold)]/5 active:scale-95 transition-all"
                                >
                                    <div className="flex items-center gap-5">
                                        <div className="w-12 h-12 rounded-2xl bg-[var(--gold)] text-black flex items-center justify-center shadow-[0_0_20px_rgba(184,134,11,0.3)] group-hover:scale-110 transition-transform">
                                            <CreditCard size={22} />
                                        </div>
                                        <div className="text-left">
                                            <h4 className="text-xs font-black text-[var(--gold)] capitalize tracking-[0.2em]">Moliya Daftari</h4>
                                            <p className="text-[9px] font-bold text-[var(--text-muted)] capitalize tracking-[0.2em] mt-1">Oylik hisob-kitoblar va to'lovlar tarixi</p>
                                        </div>
                                    </div>
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-white/10 group-hover:border-[var(--gold)] group-hover:text-[var(--gold)] transition-all">
                                        <ChevronRight size={18} />
                                    </div>
                                </button>
                            </div>
                        )}

                        <AdminBranches {...{ admin, staffBranches, removeBranchMutation }} />
                    </>
                )}
            </div>

            <AdminModals {...{ state, admin, dispatch, queryClient, permMutation, toast }} />
        </div>
    );
};

export default AdminProfile;