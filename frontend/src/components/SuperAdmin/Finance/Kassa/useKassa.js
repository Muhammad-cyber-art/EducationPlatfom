import { useEffect, useCallback, useMemo, useReducer } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../../tokenUpdater/updater";
import toast from "react-hot-toast";
import { get_user_info } from "../../../Authorized/getRole";

export const formatCurrency = (val) => {
    return Number(val).toLocaleString() + " UZS";
};

const getDateRange = (dateFilter) => {
    if (dateFilter) {
        return { date_gte: dateFilter, date_lte: dateFilter };
    }
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    return { date_gte: start, date_lte: end };
};

const initialState = {
    payments: [],
    withdrawals: [],
    loading: true,
    branches: [],
    selectedPayment: null,
    showDetailModal: false,
    showWithdrawModal: false,
    withdrawData: { amount: "", description: "" },
    isSubmitting: false,
    activeTab: "incomes",
    filters: {
        branch: "",
        method: "",
        search: "",
        date: ""
    }
};

function kassaReducer(state, action) {
    switch (action.type) {
        case 'SET_PAYMENTS':
            return { ...state, payments: typeof action.payload === 'function' ? action.payload(state.payments) : action.payload };
        case 'SET_WITHDRAWALS':
            return { ...state, withdrawals: action.payload };
        case 'SET_LOADING':
            return { ...state, loading: action.payload };
        case 'SET_BRANCHES':
            return { ...state, branches: action.payload };
        case 'SET_SELECTED_PAYMENT':
            return { ...state, selectedPayment: action.payload };
        case 'SET_SHOW_DETAIL_MODAL':
            return { ...state, showDetailModal: action.payload };
        case 'SET_SHOW_WITHDRAW_MODAL':
            return { ...state, showWithdrawModal: action.payload };
        case 'SET_WITHDRAW_DATA':
            return { ...state, withdrawData: typeof action.payload === 'function' ? action.payload(state.withdrawData) : action.payload };
        case 'SET_IS_SUBMITTING':
            return { ...state, isSubmitting: action.payload };
        case 'SET_ACTIVE_TAB':
            return { ...state, activeTab: action.payload };
        case 'SET_FILTERS':
            return { ...state, filters: typeof action.payload === 'function' ? action.payload(state.filters) : action.payload };
        case 'RESET_WITHDRAW_DATA':
            return { ...state, withdrawData: { amount: "", description: "" } };
        case 'VERIFY_PAYMENT_SUCCESS':
            return {
                ...state,
                payments: state.payments.map(p => (p.payment_details?.original_payment_id === action.payload || p.id === action.payload) ? { ...p, payment_details: { ...(p.payment_details || {}), is_verified: true } } : p)
            };
        default:
            return state;
    }
}

export const useKassa = () => {
    const navigate = useNavigate();
    const [state, dispatch] = useReducer(kassaReducer, initialState);

    const {
        payments,
        withdrawals,
        loading,
        branches,
        selectedPayment,
        showDetailModal,
        showWithdrawModal,
        withdrawData,
        isSubmitting,
        activeTab,
        filters
    } = state;

    const userInfo = useMemo(() => get_user_info(), []);

    const fetchKassaData = useCallback(async () => {
        try {
            dispatch({ type: 'SET_LOADING', payload: true });
            const { date_gte, date_lte } = getDateRange(filters.date);

            const params = {
                transaction_type: 'income',
                category: 'student_fee',
                search: filters.search || undefined,
                branch: filters.branch || undefined
            };

            if (filters.date) {
                params.date = filters.date;
            } else {
                params.date__gte = date_gte;
                params.date__lte = date_lte;
            }

            const payRes = await api.get("/finance/transactions/", { params });
            dispatch({ type: 'SET_PAYMENTS', payload: payRes.data.results || payRes.data });

            const transParams = {
                transaction_type: 'expense',
                branch: filters.branch || undefined
            };

            if (filters.date) {
                transParams.date = filters.date;
            } else {
                transParams.date__gte = date_gte;
                transParams.date__lte = date_lte;
            }

            const transRes = await api.get("/finance/transactions/", { params: transParams });
            dispatch({
                type: 'SET_WITHDRAWALS',
                payload: (transRes.data.results || transRes.data).filter(t => t.category === 'owner_withdrawal' || t.category === 'other')
            });
        } catch (error) {
            console.error("Error fetching kassa data:", error);
            toast.error("Ma'lumotlarni yuklashda xatolik.");
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    }, [filters.branch, filters.date, filters.method, filters.search]);

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const res = await api.get("/add_branch/branches/");
                dispatch({ type: 'SET_BRANCHES', payload: res.data.results || res.data });
            } catch (err) { console.error(err); }
        };
        fetchBranches();
    }, []);

    useEffect(() => {
        fetchKassaData();
    }, [fetchKassaData]);

    const handleAmountChange = useCallback((e) => {
        const val = e.target.value.replace(/\D/g, "");
        const formatted = val ? Number(val).toLocaleString() : "";
        dispatch({
            type: 'SET_WITHDRAW_DATA',
            payload: prev => ({ ...prev, amount: formatted })
        });
    }, []);

    const handleWithdraw = useCallback(async (e) => {
        e.preventDefault();
        const rawAmount = withdrawData.amount.replace(/,/g, "");

        if (!rawAmount || Number(rawAmount) <= 0) {
            return toast.error("Summani to'g'ri kiriting");
        }

        try {
            dispatch({ type: 'SET_IS_SUBMITTING', payload: true });
            await api.post("/finance/transactions/", {
                transaction_type: 'expense',
                category: 'owner_withdrawal',
                amount: rawAmount,
                title: "Super Admin pul oldi",
                description: withdrawData.description,
                branch: filters.branch || get_user_info()?.branch || 1,
                date: filters.date || new Date().toISOString().split('T')[0]
            });
            toast.success("Pul olish muvaffaqiyatli qayd etildi!");
            dispatch({ type: 'SET_SHOW_WITHDRAW_MODAL', payload: false });
            dispatch({ type: 'RESET_WITHDRAW_DATA' });
            fetchKassaData();
        } catch (error) {
            toast.error("Xatolik yuz berdi");
        } finally {
            dispatch({ type: 'SET_IS_SUBMITTING', payload: false });
        }
    }, [withdrawData.amount, withdrawData.description, filters.branch, filters.date, fetchKassaData]);

    const handleVerify = useCallback(async (paymentId) => {
        try {
            const res = await api.post(`/finance/student-payments/${paymentId}/verify/`);
            if (res.data.status === 'success') {
                toast.success("To'lov muvaffaqiyatli tasdiqlandi!");
                dispatch({ type: 'VERIFY_PAYMENT_SUCCESS', payload: paymentId });
            }
        } catch (error) {
            toast.error(error.response?.data?.detail || "Tasdiqlashda xatolik");
        }
    }, []);

    const totalToday = useMemo(() => payments.reduce((sum, p) => sum + Number(p.amount), 0), [payments]);
    const totalVerified = useMemo(() => payments.filter(p => p.payment_details?.is_verified).reduce((sum, p) => sum + Number(p.amount), 0), [payments]);
    const totalWithdrawn = useMemo(() => withdrawals.reduce((sum, w) => sum + Number(w.amount), 0), [withdrawals]);

    const clearFilters = useCallback(() => {
        dispatch({ type: 'SET_FILTERS', payload: { branch: "", method: "", search: "", date: "" } });
    }, []);

    const setToday = useCallback(() => {
        dispatch({
            type: 'SET_FILTERS',
            payload: prev => ({ ...prev, date: new Date().toISOString().split('T')[0] })
        });
    }, []);

    // Setters wrap dispatch to keep backward compatibility if they are used as standalone setters in the UI
    const setSelectedPayment = useCallback((val) => dispatch({ type: 'SET_SELECTED_PAYMENT', payload: val }), []);
    const setShowDetailModal = useCallback((val) => dispatch({ type: 'SET_SHOW_DETAIL_MODAL', payload: val }), []);
    const setShowWithdrawModal = useCallback((val) => dispatch({ type: 'SET_SHOW_WITHDRAW_MODAL', payload: val }), []);
    const setWithdrawData = useCallback((val) => dispatch({ type: 'SET_WITHDRAW_DATA', payload: val }), []);
    const setActiveTab = useCallback((val) => dispatch({ type: 'SET_ACTIVE_TAB', payload: val }), []);
    const setFilters = useCallback((val) => dispatch({ type: 'SET_FILTERS', payload: val }), []);

    return {
        navigate,
        payments,
        withdrawals,
        loading,
        branches,
        selectedPayment,
        setSelectedPayment,
        showDetailModal,
        setShowDetailModal,
        showWithdrawModal,
        setShowWithdrawModal,
        withdrawData,
        setWithdrawData,
        isSubmitting,
        activeTab,
        setActiveTab,
        filters,
        setFilters,
        userInfo,
        handleAmountChange,
        handleWithdraw,
        handleVerify,
        totalToday,
        totalVerified,
        totalWithdrawn,
        clearFilters,
        setToday,
        fetchKassaData
    };
};

