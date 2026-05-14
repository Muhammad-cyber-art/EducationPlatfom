import React, { useEffect, useMemo, useState } from"react";
import { useNavigate, useParams } from"react-router-dom";
import { useDispatch } from'react-redux';
import toast from"react-hot-toast";
import api from"../../../tokenUpdater/updater";
import { get_user_info } from"../../Authorized/getRole";

// Store actions
import {
 setPayModal,
 setSelectedHistoryItem,
 setEditModal,
 updateEditForm,
 resetFinanceState
} from'../../../store/slices/financeSlice';

// Hooks
import { useStaffPayments } from"./StaffPayments/useStaffPayments";

// Components
import PaymentHeader from"./StaffPayments/PaymentHeader";
import PaymentSidebar from"./StaffPayments/PaymentSidebar";
import PaymentStats from"./StaffPayments/PaymentStats";
import PaymentHistory from"./StaffPayments/PaymentHistory";
import KpiTable from"./StaffPayments/KpiTable";
import AdvanceHistory from"./StaffPayments/AdvanceHistory";
import DebtorsModal from"./StaffPayments/DebtorsModal";
import EditProfileModal from"./StaffPayments/EditProfileModal";
import StaffPaymentModal from"./StaffPaymentModal";
import StaffAdvanceModal from"./StaffAdvanceModal";

const StaffPaymentDetails = () => {
 const navigate = useNavigate();
 const dispatch = useDispatch();
 const { staff_id } = useParams();
 const user_info = get_user_info();
 const isSuperAdmin = user_info?.role ==="super_admin";

 const {
 financeState,
 fetchAllData,
 handleRecalculate,
 handleUpdate,
 handleDelete,
 handleDeleteHistory,
 handleDeleteAdvance
 } = useStaffPayments(staff_id);

 const {
 data,
 loading,
 recalculating,
 payModal,
 selectedHistoryItem,
 editModal,
 editLoading,
 editForm
 } = financeState;

 const [selectedGroupForDebtors, setSelectedGroupForDebtors] = useState(null);

 const isPercentageType = data?.salary_type ==='percentage';
 const isStudentCountType = data?.salary_type ==='student_count';


 const studentCountSummary = useMemo(() => {
 if (!data) return {};
 const groups = data?.mentor_groups || [];
 return groups.reduce((acc, group) => {
 acc.groups += 1;
 acc.totalStudents += Number(group.students_count || 0);
 acc.paidStudents += Number(group.paid_students_count || 0);
 acc.paidIncome += Number(group.monthly_income || 0);
 acc.expectedIncome += Number(group.expected_income || 0);
 acc.mentorSharePaid += Number(group.mentor_share_paid || 0);
 acc.mentorShareExpected += Number(group.mentor_share_expected || 0);
 return acc;
 }, {
 groups: 0, totalStudents: 0, paidStudents: 0, paidIncome: 0, expectedIncome: 0, mentorSharePaid: 0, mentorShareExpected: 0
 });
 }, [data]);

 const liveBaseSalary = useMemo(() => {
 if (!data) return 0;
 
 
 
 return isPercentageType
 ? (data.calculated_commission || 0)
 : isStudentCountType
 ? (data.calculated_per_student || 0)
 : (data.salary_base || 0);
 }, [data, isPercentageType, isStudentCountType]);

 const finalTotalAmount = useMemo(() => {
 if (!data) return 0;
 const bonus = Number(data.bonus || 0);
 const deductions = Number(data.deductions || 0);
 const advances = Number(data.total_advances || 0);
 if (data.is_paid) return data.total_amount;
 return liveBaseSalary + bonus - deductions - advances;
 }, [data, liveBaseSalary]);

 const formatCurrency = (amount) => {
 if (!amount && amount !== 0) return"0 UZS";
 return new Intl.NumberFormat('uz-UZ').format(amount) +" UZS";
 };

 useEffect(() => {
 fetchAllData();
 window.scrollTo(0, 0);
 return () => { dispatch(resetFinanceState()); };
 }, [fetchAllData, staff_id, dispatch]);

 if (loading || !data) {
 return (
 <div className="min-h-screen bg-[var(--bg-void)] flex items-center justify-center">
 <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[var(--gold)]"></div>
 </div>
 );
 }

 return (
 <div className="min-h-screen bg-[var(--bg-void)] text-[var(--text-secondary)] font-sans selection:bg-[var(--gold)]/30 overflow-x-hidden">
 <div className="relative z-10 p-3 md:p-5 max-w-[1400px] mx-auto">
 <PaymentHeader
 {...{ navigate, data, isPercentageType, isStudentCountType, handleRecalculate, recalculating, isSuperAdmin, dispatch, setEditModal, setSelectedHistoryItem, handleDelete }}
 />

 <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
 <PaymentSidebar {...{ data, isPercentageType, isStudentCountType, formatCurrency }} />

 <div className="lg:col-span-9 space-y-4">
 {/* 1. Stats Cards - Asosiy statistika */}
 <PaymentStats {...{ data, isPercentageType, isStudentCountType, formatCurrency, studentCountSummary, finalTotalAmount, isSuperAdmin }} />
 
 {/* 2. Payment History - To'lov tarixi */}
 <PaymentHistory {...{ data, staff_id, formatCurrency, isSuperAdmin, handleDeleteHistory, dispatch, setPayModal, setSelectedHistoryItem }} />
 
 {/* 3. KPI Table - Guruhlar va o'quvchilar */}
 {data.salary_type !== 'fixed' && (
 <KpiTable {...{ data, isPercentageType, isStudentCountType, formatCurrency, setSelectedGroupForDebtors }} />
 )}
 
 {/* 4. Advance History - Avanslar */}
 <AdvanceHistory {...{ data, formatCurrency, isSuperAdmin, handleDeleteAdvance }} />
 
 </div>
 </div>
 </div>

 <StaffAdvanceModal
 isOpen={selectedHistoryItem ==='advance'}
 onClose={() => dispatch(setSelectedHistoryItem(null))}
 staffName={`${data.employee_first_name} ${data.employee_last_name}`}
 onConfirm={async (amount, description) => {
 try {
 await api.post(`/finance/employee-payments/${staff_id}/add-advance/`, { amount, description });
 toast.success("Avans qo'shildi!");
 dispatch(setSelectedHistoryItem(null));
 fetchAllData();
 } catch (e) { toast.error(e.response?.data?.detail ||"Xatolik"); }
 }}
 />

 <StaffPaymentModal
 isOpen={payModal}
 onClose={() => { dispatch(setPayModal(false)); dispatch(setSelectedHistoryItem(null)); }}
 info={selectedHistoryItem || data}
 amount={selectedHistoryItem ? (selectedHistoryItem.salary_type ==='percentage' && !selectedHistoryItem.is_paid ? (selectedHistoryItem.calculated_commission || 0) : (selectedHistoryItem.total_amount || selectedHistoryItem.salary_base)) : (!data.is_paid ? (liveBaseSalary - (data.total_advances || 0)) : (data.total_amount || data.salary_base))}
 incomeType={data?.salary_type}
 onConfirm={async (bonus, deduction) => {
 const targetId = selectedHistoryItem ? selectedHistoryItem.id : staff_id;
 try {
 await api.post(`/finance/employee-payments/${targetId}/confirm/`, { bonus, deductions: deduction });
 toast.success("To'lov tasdiqlandi!");
 dispatch(setPayModal(false));
 dispatch(setSelectedHistoryItem(null));
 fetchAllData();
 } catch (e) { toast.error("To'lovda xatolik"); }
 }}
 />

 <EditProfileModal isOpen={editModal} {...{ editLoading, editForm, dispatch, updateEditForm, handleUpdate, onClose: () => dispatch(setEditModal(false)) }} />
 <DebtorsModal group={selectedGroupForDebtors} onClose={() => setSelectedGroupForDebtors(null)} formatCurrency={formatCurrency} />
 </div>
 );
};

export default StaffPaymentDetails;