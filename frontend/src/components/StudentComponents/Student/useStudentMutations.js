import { useMutation, useQueryClient } from"@tanstack/react-query";
import api from"../../../tokenUpdater/updater";
import toast from"react-hot-toast";

export const useStudentMutations = (student_id, dispatch, navigate) => {
 const queryClient = useQueryClient();

 const editMutation = useMutation({
 mutationFn: async (data) => {
 const formData = new FormData();
 Object.keys(data).forEach(key => {
 if (key ==='image') {
 if (data[key] instanceof File) formData.append('image', data[key]);
 } else if (data[key] !== null && data[key] !== undefined && data[key] !=="") {
 formData.append(key, data[key]);
 }
 });
 return await api.patch(`groups/students/${student_id}/`, formData, {
 headers: {'Content-Type':'multipart/form-data' }
 });
 },
 onSuccess: () => {
 queryClient.invalidateQueries(['student']);
 dispatch({ type:'SET_EDITING', payload: false });
 toast.success("Profil tahrirlandi.");
 }
 });

 const paymentMutation = useMutation({
   mutationFn: async ({ id, amount, ignore_refund, payment_method, receipt_image, notes, is_receiptless, pay_full_month }) => {
     const formData = new FormData();
     if (amount) formData.append('amount', amount);
     if (ignore_refund !== undefined) formData.append('ignore_refund', ignore_refund);
     if (payment_method) formData.append('payment_method', payment_method);
     if (receipt_image) formData.append('receipt_image', receipt_image);
     if (notes) formData.append('notes', notes);
     if (is_receiptless !== undefined) formData.append('is_receiptless', is_receiptless);
     if (pay_full_month !== undefined) formData.append('pay_full_month', pay_full_month);
     return await api.post(`/finance/student-payments/${id}/confirm/`, formData, {
       headers: { 'Content-Type': 'multipart/form-data' }
     });
  },
 onSuccess: () => {
 queryClient.invalidateQueries(['payments-all']);
 dispatch({ type:'TOGGLE_MODAL', payload: false });
 toast.success("To'lov tasdiqlandi.");
 }
 });

 const editPaymentMutation = useMutation({
 mutationFn: async ({ id, amount, month }) => {
 return await api.patch(`/finance/student-payments/${id}/`, { amount, month });
 },
 onSuccess: () => {
 queryClient.invalidateQueries(['payments-all']);
 dispatch({ type:'TOGGLE_EDIT_PAYMENT', payload: false });
 toast.success("To'lov tahrirlandi.");
 }
 });

 const customPaymentMutation = useMutation({
 mutationFn: async (data) => {
 return await api.post(`/finance/student-payments/custom-payment/`, {
 student: student_id,
 ...data
 });
 },
 onSuccess: () => {
 queryClient.invalidateQueries(['payments-all']);
 dispatch({ type:'TOGGLE_CUSTOM_PAYMENT', payload: false });
 toast.success("To'lov qabul qilindi.");
 }
 });

 const unenrollMutation = useMutation({
 mutationFn: async (groupId) => await api.post(`groups/groups/${groupId}/unenroll-student/`, { student_id }),
 onSuccess: (res) => {
 queryClient.invalidateQueries(['student']);
 toast.success(res.data.status ||"O'quvchi guruhdan chiqarildi.");
 if (res.data.status?.includes("oxirgi guruh") || res.data.status?.includes("kutish zaliga")) {
 navigate(-1);
 }
 }
 });

 const archiveMutation = useMutation({
 mutationFn: async (reason) => await api.delete(`groups/students/${student_id}/`, { data: { reason } }),
 onSuccess: () => {
 toast.success("O'quvchi tizimdan butkul o'chirildi.");
 navigate(-1);
 }
 });

 const mergeMutation = useMutation({
 mutationFn: async (duplicateId) => await api.post(`groups/students/${student_id}/merge/`, { duplicate_id: duplicateId }),
 onSuccess: (res) => {
 queryClient.invalidateQueries(['student']);
 queryClient.invalidateQueries(['payments-all']);
 dispatch({ type:'TOGGLE_MERGE_MODAL', payload: false });
 toast.success(res.data.message ||"Muvaffaqiyatli birlashtirildi.");
 },
 onError: (err) => {
 toast.error(err.response?.data?.error ||"Birlashtirishda xatolik yuz berdi");
 }
 });

 return {
 editMutation,
 paymentMutation,
 editPaymentMutation,
 customPaymentMutation,
 unenrollMutation,
 archiveMutation,
 mergeMutation
 };
};
