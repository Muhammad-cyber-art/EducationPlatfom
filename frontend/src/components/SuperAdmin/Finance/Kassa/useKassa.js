import { useState, useEffect, useCallback, useMemo } from "react";
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

export const useKassa = () => {
    const navigate = useNavigate();
    const [payments, setPayments] = useState([]);
    const [withdrawals, setWithdrawals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [branches, setBranches] = useState([]);
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [withdrawData, setWithdrawData] = useState({ amount: "", description: "" });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState("incomes");

    const [filters, setFilters] = useState({
        branch: "",
        method: "",
        search: "",
        date: ""
    });

    const userInfo = useMemo(() => get_user_info(), []);

    const fetchKassaData = useCallback(async () => {
        try {
            setLoading(true);
            const { date_gte, date_lte } = getDateRange(filters.date);

            const params = {
                is_paid: true,
                payment_method: filters.method || undefined,
                search: filters.search || undefined,
                student__branch: filters.branch || undefined
            };

            if (filters.date) {
                params.paid_at__date = filters.date;
            } else {
                params.paid_at__date__gte = date_gte;
                params.paid_at__date__lte = date_lte;
            }

            const payRes = await api.get("/finance/student-payments/", { params });
            setPayments(payRes.data.results || payRes.data);

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
            setWithdrawals((transRes.data.results || transRes.data).filter(t => t.category === 'owner_withdrawal' || t.category === 'other'));
        } catch (error) {
            console.error("Error fetching kassa data:", error);
            toast.error("Ma'lumotlarni yuklashda xatolik.");
        } finally {
            setLoading(false);
        }
    }, [filters.branch, filters.date, filters.method, filters.search]);

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const res = await api.get("/add_branch/branches/");
                setBranches(res.data.results || res.data);
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
        setWithdrawData(prev => ({ ...prev, amount: formatted }));
    }, []);

    const handleWithdraw = useCallback(async (e) => {
        e.preventDefault();
        const rawAmount = withdrawData.amount.replace(/,/g, "");

        if (!rawAmount || Number(rawAmount) <= 0) {
            return toast.error("Summani to'g'ri kiriting");
        }

        try {
            setIsSubmitting(true);
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
            setShowWithdrawModal(false);
            setWithdrawData({ amount: "", description: "" });
            fetchKassaData();
        } catch (error) {
            toast.error("Xatolik yuz berdi");
        } finally {
            setIsSubmitting(false);
        }
    }, [withdrawData.amount, withdrawData.description, filters.branch, filters.date, fetchKassaData]);

    const handleVerify = useCallback(async (paymentId) => {
        try {
            const res = await api.post(`/finance/student-payments/${paymentId}/verify/`);
            if (res.data.status === 'success') {
                toast.success("To'lov muvaffaqiyatli tasdiqlandi!");
                setPayments(prev => prev.map(p => p.id === paymentId ? { ...p, is_verified: true } : p));
            }
        } catch (error) {
            toast.error(error.response?.data?.detail || "Tasdiqlashda xatolik");
        }
    }, []);

    const totalToday = useMemo(() => payments.reduce((sum, p) => sum + Number(p.amount), 0), [payments]);
    const totalVerified = useMemo(() => payments.filter(p => p.is_verified).reduce((sum, p) => sum + Number(p.amount), 0), [payments]);
    const totalWithdrawn = useMemo(() => withdrawals.reduce((sum, w) => sum + Number(w.amount), 0), [withdrawals]);

    const clearFilters = useCallback(() => {
        setFilters({ branch: "", method: "", search: "", date: "" });
    }, []);

    const setToday = useCallback(() => {
        setFilters(prev => ({ ...prev, date: new Date().toISOString().split('T')[0] }));
    }, []);

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
