import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    data: null,
    selfData: null,
    loading: true,
    recalculating: false,
    payModal: false,
    selectedHistoryItem: null,
    editModal: false,
    editLoading: false,
    editForm: {
        fixed_salary: "",
        commission_percentage: "",
        per_student_amount: "",
        salary_type: "fixed",
        karta: ""
    },
    // StaffPayments states
    activeBranch: localStorage.getItem("activeBID") || null,
    activeTab: "admin",
    addStaffModal: false,
    branches: [],
    staffData: [],
    staffSearchQuery: "",
    staffRefreshing: false,
    staffLoading: false,
    refundProcessing: false
};

const financeSlice = createSlice({
    name: 'finance',
    initialState,
    reducers: {
        setData: (state, action) => {
            state.data = action.payload;
        },
        setSelfData: (state, action) => {
            state.selfData = action.payload;
        },
        setLoading: (state, action) => {
            state.loading = action.payload;
        },
        setRecalculating: (state, action) => {
            state.recalculating = action.payload;
        },
        setPayModal: (state, action) => {
            state.payModal = action.payload;
        },
        setSelectedHistoryItem: (state, action) => {
            state.selectedHistoryItem = action.payload;
        },
        setEditModal: (state, action) => {
            state.editModal = action.payload;
        },
        setEditLoading: (state, action) => {
            state.editLoading = action.payload;
        },
        setEditForm: (state, action) => {
            state.editForm = action.payload;
        },
        updateEditForm: (state, action) => {
            state.editForm = { ...state.editForm, ...action.payload };
        },
        setActiveBranch: (state, action) => {
            state.activeBranch = action.payload;
            localStorage.setItem("activeBID", action.payload);
        },
        setActiveTab: (state, action) => {
            state.activeTab = action.payload;
        },
        setAddStaffModal: (state, action) => {
            state.addStaffModal = action.payload;
        },
        setBranches: (state, action) => {
            state.branches = action.payload;
        },
        setStaffData: (state, action) => {
            state.staffData = action.payload;
        },
        setStaffSearchQuery: (state, action) => {
            state.staffSearchQuery = action.payload;
        },
        setStaffRefreshing: (state, action) => {
            state.staffRefreshing = action.payload;
        },
        setStaffLoading: (state, action) => {
            state.staffLoading = action.payload;
        },
        setRefundProcessing: (state, action) => {
            state.refundProcessing = action.payload;
        },
        resetFinanceState: () => initialState
    }
});

export const {
    setData,
    setSelfData,
    setLoading,
    setRecalculating,
    setPayModal,
    setSelectedHistoryItem,
    setEditModal,
    setEditLoading,
    setEditForm,
    updateEditForm,
    setActiveBranch,
    setActiveTab,
    setAddStaffModal,
    setBranches,
    setStaffData,
    setStaffSearchQuery,
    setStaffRefreshing,
    setStaffLoading,
    setRefundProcessing,
    resetFinanceState
} = financeSlice.actions;

export default financeSlice.reducer;
