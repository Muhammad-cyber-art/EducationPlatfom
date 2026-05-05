import { useState, useEffect } from'react';
import { useParams } from'react-router-dom';
import api from'../../../../tokenUpdater/updater';
import toast from'react-hot-toast';

export const useBranchFinance = () => {
 const { b_id } = useParams();
 const [loading, setLoading] = useState(true);
 const [data, setData] = useState(null);
 const [error, setError] = useState(null);

 const fetchBranchFinance = async () => {
 try {
 setLoading(true);
 const response = await api.get(`/finance/statistics/branch-finance/${b_id}/`);
 setData(response.data);
 setError(null);
 } catch (err) {
 setError("Xatolik: Tizimga ulanishda muammo yuz berdi.");
 toast.error("Ma'lumotlarni yuklashda xatolik.");
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchBranchFinance();
 }, [b_id]);

 const formatNumber = (num) => {
 if (!num) return'0';
 return Math.floor(num).toLocaleString();
 };

 const progressPercentage = data?.finance?.expected_income > 0
 ? ((data.finance.received_income / data.finance.expected_income) * 100).toFixed(1)
 : 0;

 return {
 loading,
 data,
 error,
 fetchBranchFinance,
 formatNumber,
 progressPercentage,
 stats: data?.stats,
 finance: data?.finance,
 branch: data?.branch,
 groups: data?.groups
 };
};
