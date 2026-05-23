import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useReducer, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import api from "../../tokenUpdater/updater";
import toast from "react-hot-toast";

// Hooks
import { useCurrentBranch } from "../Authorized/useBranchId";
import { useStudentProfile } from "./Student/useStudentProfile";
import { useStudentMutations } from "./Student/useStudentMutations";

// Sub-components
import StudentHeader from "./Student/StudentHeader";
import StudentProfileHeader from "./Student/StudentProfileHeader";
import StudentEditForm from "./Student/StudentEditForm";
import StudentDossier from "./Student/StudentDossier";
import StudentGroupsSection from "./Student/StudentGroupsSection";
import StudentHistorySection from "./Student/StudentHistorySection";
import StudentModals from "./Student/StudentModals";
import UnenrollSelectModal from "./Student/UnenrollSelectModal";
import JoinGroupModal from "./Student/Modals/JoinGroupModal";
import { Loader2 } from "lucide-react";

const initialState = {
    isModalOpen: false,
    isTransferModalOpen: false,
    showGroupMenu: false,
    isEditing: false,
    editData: {
        full_name: "", phone: "", parent_name: "", parent_phone: "",
        address: "", notes: "", group: null, image: null,
        status: "", custom_fee: "", telegram_id: "", parent_telegram_id: ""
    },
    previewImage: null,
    transferFromGroup: null,
    isEditPaymentModalOpen: false,
    isCustomPaymentModalOpen: false,
    isMergeModalOpen: false,
    selectedPayment: null,
    isConfirmPaymentModalOpen: false,
    confirmPaymentData: null,
    isUnenrollSelectModalOpen: false,
    isJoinGroupModalOpen: false
};

function reducer(state, action) {
    switch (action.type) {
        case 'TOGGLE_MODAL': return { ...state, isModalOpen: action.payload };
        case 'TOGGLE_TRANSFER_MODAL': return { ...state, isTransferModalOpen: action.payload, transferFromGroup: action.group || null };
        case 'TOGGLE_MENU': return { ...state, showGroupMenu: action.payload ?? !state.showGroupMenu };
        case 'SET_EDITING': return { ...state, isEditing: action.payload, previewImage: null };
        case 'SET_EDIT_DATA': return { ...state, editData: action.payload };
        case 'UPDATE_EDIT_FIELD': return { ...state, editData: { ...state.editData, ...action.payload } };
        case 'SET_PREVIEW': return { ...state, previewImage: action.payload };
        case 'TOGGLE_EDIT_PAYMENT': return { ...state, isEditPaymentModalOpen: action.payload, selectedPayment: action.payment };
        case 'TOGGLE_CUSTOM_PAYMENT': return { ...state, isCustomPaymentModalOpen: action.payload };
        case 'TOGGLE_MERGE_MODAL': return { ...state, isMergeModalOpen: action.payload };
        case 'TOGGLE_CONFIRM_PAYMENT': return { ...state, isConfirmPaymentModalOpen: action.payload, confirmPaymentData: action.data || null };
        case 'TOGGLE_UNENROLL_SELECT_MODAL': return { ...state, isUnenrollSelectModalOpen: action.payload };
        case 'TOGGLE_JOIN_GROUP_MODAL': return { ...state, isJoinGroupModalOpen: action.payload };
        default: return state;
    }
}

export default function StudentProfilePage() {
    const { student_id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const branchID = useCurrentBranch();
    const [state, dispatch] = useReducer(reducer, initialState);

    // Data & Mutations
    const {
        studentData, paymentsAllGroups, branchGroups, transfers,
        studentLoading, permissions, userRole
    } = useStudentProfile(student_id, branchID.currentBranchId, dispatch);

    const mutations = useStudentMutations(student_id, dispatch, navigate);
    const { editMutation, paymentMutation, editPaymentMutation, customPaymentMutation, unenrollMutation, archiveMutation, mergeMutation } = mutations;

    // Derived Data
    const groups = studentData?.groups || [];
    const primaryGroup = groups[0] || {};
    const paymentsArray = Array.isArray(paymentsAllGroups) ? paymentsAllGroups : [];
    const primaryPayment = paymentsArray.find(p => p.group === primaryGroup.id) || {};

    const payments = useMemo(() => {
        return paymentsArray.flatMap(gp => {
            const groupInfo = groups.find(g => g.id === gp.group);
            const history = gp.payment_history || [];
            return [
                { ...gp, group_name: groupInfo?.name || "Eski guruh" },
                ...history.map(h => ({ ...h, group_name: groupInfo?.name || "Eski guruh" }))
            ];
        }).sort((a, b) => new Date(b.month) - new Date(a.month));
    }, [paymentsArray, groups]);

    const extraTransactions = useMemo(() => {
        return paymentsArray.flatMap(gp => {
            const groupInfo = groups.find(g => g.id === gp.group);
            return (gp.extra_transactions || []).map(t => ({ ...t, group_name: groupInfo?.name || "Eski guruh" }));
        });
    }, [paymentsArray, groups]);

    // Handlers
    const handleSaveEdit = () => editMutation.mutate(state.editData);

    const handlePaymentConfirm = (paymentId, amount = null, ignore_refund = false) => {
        const idToConfirm = paymentId || primaryPayment?.id;
        if (idToConfirm) {
            const pData = paymentsArray.find(p => p.id === idToConfirm) || primaryPayment;
            const g = groups.find(gr => gr.id === pData?.group) || primaryGroup;
            
            // To'liq oylik narxi
            const fullAmount = (studentData?.status === 'negotiated' || studentData?.status === 'low_income') 
                ? (studentData?.custom_fee || g?.monthly_price) 
                : g?.monthly_price;

            const remainingAmount = pData?.is_partial
                ? (pData?.remaining_amount ?? Math.max(0, Number(pData?.amount || 0) - Number(pData?.paid_amount || 0)))
                : null;

            dispatch({
                type: 'TOGGLE_CONFIRM_PAYMENT',
                payload: true,
                data: {
                    id: idToConfirm,
                    accruedAmount: amount || pData?.amount || 0,
                    fullAmount: fullAmount,
                    remainingAmount,
                    paidAmount: pData?.paid_amount || 0,
                    isPartial: !!pData?.is_partial,
                    ignore_refund,
                    studentName: studentData?.full_name,
                    month: pData?.month,
                    refundAmount: pData?.refund_amount || 0
                }
            });
        } else {
            toast.error("Joriy oy uchun to'lov ma'lumoti topilmadi.");
        }
    };

    const executePaymentConfirm = (paymentDetails) => {
        const { id } = state.confirmPaymentData || {};
        if (id) {
            paymentMutation.mutate({
                id,
                ...paymentDetails,
            });
        }
    };

    const handleDeleteHistory = async (paymentId) => {
        if (userRole !== 'super_admin') return toast.error("Faqat SuperAdmin o'chira oladi");
        if (!window.confirm("Ushbu oy uchun to'lov ma'lumotlarini o'chirmoqchimisiz?")) return;
        try {
            await api.delete(`/finance/student-payments/${paymentId}/`);
            toast.success("Muvaffaqiyatli o'chirildi");
            queryClient.invalidateQueries(['payments-all']);
        } catch (err) { toast.error("Xatolik!"); }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            dispatch({ type: 'UPDATE_EDIT_FIELD', payload: { image: file } });
            dispatch({ type: 'SET_PREVIEW', payload: URL.createObjectURL(file) });
        }
    };

    if (studentLoading && !studentData.full_name) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-[var(--gold)]" size={40} />
            </div>
        );
    }

    const { isEditing, editData, showGroupMenu, previewImage } = state;

    return (
        <div className="p-3 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 sm:space-y-8 lg:space-y-12 bg-[var(--bg-void)]/20 min-h-screen">
            <StudentHeader
                {...{ studentData, isEditing, userRole, handleSaveEdit, dispatch, archiveMutation, student_id }}
                canEditStudent={permissions.canEditStudent}
            />

            <StudentProfileHeader
                {...{ studentData, isEditing, editData, previewImage, primaryPayment, student_id, dispatch, handleImageChange }}
            />

            {isEditing ? (
                <div className="max-w-4xl mx-auto">
                    <StudentEditForm {...{ editData, branchGroups, editMutation, dispatch, handleSaveEdit }} />
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8 xl:gap-10 items-start">
                    {/* Left Sidebar: Dossier */}
                    <div className="xl:col-span-4 xl:sticky xl:top-6">
                        <StudentDossier
                            {...{ studentData, student_id, dispatch }}
                            canConfirmPayment={permissions.canConfirmPayment}
                        />
                    </div>

                    {/* Right Content: Groups & History */}
                    <div className="xl:col-span-8 space-y-6 lg:space-y-8">
                        <StudentGroupsSection
                            {...{ studentData, groups, paymentsAllGroups, showGroupMenu, dispatch, unenrollMutation, handlePaymentConfirm, navigate }}
                            canConfirmPayment={permissions.canConfirmPayment}
                        />

                        <StudentHistorySection
                            {...{ payments, extraTransactions, transfers, userRole, handlePaymentConfirm, handleDeleteHistory, dispatch }}
                            canConfirmPayment={permissions.canConfirmPayment}
                        />
                    </div>
                </div>
            )}

            <StudentModals
                {...{ state, studentData, primaryGroup, paymentMutation, editPaymentMutation, customPaymentMutation, mergeMutation, handlePaymentConfirm, executePaymentConfirm, dispatch, queryClient }}
                userData={permissions.userData}
            />

            <UnenrollSelectModal
                isOpen={state.isUnenrollSelectModalOpen}
                onClose={() => dispatch({ type: 'TOGGLE_UNENROLL_SELECT_MODAL', payload: false })}
                studentData={studentData}
                onUnenroll={(gid) => unenrollMutation.mutate(gid)}
                onArchive={(reason) => archiveMutation.mutate(reason)}
            />

            <JoinGroupModal
                isOpen={state.isJoinGroupModalOpen}
                onClose={() => dispatch({ type: 'TOGGLE_JOIN_GROUP_MODAL', payload: false })}
                student={studentData}
                currentBranchId={branchID.currentBranchId}
                api={api}
                onSuccess={() => {
                    queryClient.invalidateQueries(['student']);
                    queryClient.invalidateQueries(['payments-all']);
                }}
            />
        </div>
    );
}
