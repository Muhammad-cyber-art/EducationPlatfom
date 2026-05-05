import React, { useState, useEffect } from'react';
import { useNavigate, useOutletContext, useLocation, useParams } from'react-router-dom';
import { useQuery, useQueryClient } from'@tanstack/react-query';
import { get_user_info } from'../Authorized/getRole';
import { useCurrentBranch } from'../Authorized/useBranchId';
import {
 ArrowLeft, CreditCard,
 User,
 Phone,
 FileText,
 Users,
 Camera,
 X,
 Plus,
 MapPin,
 Calendar,
 Search,
 CheckCircle2
} from'lucide-react';
import AmountInput from'../Common/AmountInput';
import api from'../../tokenUpdater/updater';
import toast from'react-hot-toast';
import { safeArray } from'../../utils/safeArray';

const StudentAdd = () => {
 const location = useLocation();
 const navigate = useNavigate();
 const queryClient = useQueryClient();
 const outletCtx = useOutletContext() || {};
 const { branchId } = outletCtx;
 const { currentBranchId } = useCurrentBranch();
 // useParams orqali group_id ni to'g'ri olamiz (split xato berishi mumkin)
 const params = useParams();
 const paramGroupId = Number(params.group_id);
 const hasGroupId = !isNaN(paramGroupId) && paramGroupId > 0;

 const [formData, setFormData] = useState({
 group: hasGroupId ? paramGroupId :'',
 full_name:'',
 phone:'',
 birth_date:'',
 parent_name:'',
 parent_phone:'',
 address:'',
 notes:'',
 image: null,
 status:'regular',
 custom_fee:'',
 branch_id: currentBranchId || branchId,
 create_payment: true
 });

 const [preview, setPreview] = useState(null);
 const [loading, setLoading] = useState(false);
 const [searchResults, setSearchResults] = useState([]);
 const [searching, setSearching] = useState(false);
 const user_info = get_user_info();

 const { data: userData = {} } = useQuery({
 queryKey: ['user-me'],
 queryFn: () => api.get('/user/me/').then(res => res.data),
 staleTime: Infinity,
 });

 const perms = userData.permissions || {};
 const isSuperAdmin = user_info?.role ==="super_admin";

 useEffect(() => {
 if (userData.id && perms.students === false && !isSuperAdmin) {
 toast.error("Sizda o'quvchi qo'shish ruxsati yo'q!");
 navigate(-1);
 }
 }, [userData.id, perms.students, isSuperAdmin, navigate]);

 useEffect(() => {
 setFormData(prev => ({ ...prev, branch_id: currentBranchId || branchId }));
 }, [currentBranchId, branchId]);

 const [groups, setGroups] = useState([]);

 useEffect(() => {
 if (!hasGroupId && (currentBranchId || branchId)) {
 api.get(`/groups/nested_groups/`)
 .then(res => setGroups(safeArray(res.data)))
 .catch(err => console.error("Error loading groups", err));
 }
 }, [hasGroupId, currentBranchId, branchId]);

 const handleChange = (e) => {
 const { name, value } = e.target;
 setFormData((prev) => ({ ...prev, [name]: value }));
 };

 // Debounced search logic for existing students
 useEffect(() => {
 const searchTrigger = async () => {
 const { phone, full_name } = formData;
 const cleanPhone = phone.replace(/\D/g,'');

 // Agar telefon > 7 ta raqam yoki Ism > 3 ta harf bo'lsa qidiramiz
 if (cleanPhone.length >= 7 || full_name.trim().length >= 3) {
 const query = cleanPhone.length >= 7 ? phone : full_name;
 setSearching(true);
 try {
 const response = await api.get(`/groups/students/search/?q=${encodeURIComponent(query)}`);
 setSearchResults(safeArray(response.data));
 } catch (error) {
 console.error("Qidiruvda xatolik:", error);
 } finally {
 setSearching(false);
 }
 } else {
 setSearchResults([]);
 }
 };

 const timer = setTimeout(() => {
 searchTrigger();
 }, 600);

 return () => clearTimeout(timer);
 }, [formData.phone, formData.full_name]);

 const [enrollmentToggles, setEnrollmentToggles] = useState({});

 useEffect(() => {
 // SearchResults o'zgarganda togglar holatini initialize qilib olamiz (default: true)
 const newToggles = { ...enrollmentToggles };
 searchResults.forEach(st => {
 if (newToggles[st.id] === undefined) newToggles[st.id] = true;
 });
 setEnrollmentToggles(newToggles);
 }, [searchResults]);

 const searchStudent = async (query) => {
 // Bu funksiya endi yuqoridagi useEffect ichida debounced holda ishlaydi
 };

 const handleEnrollExisting = async (studentId) => {
 if (!hasGroupId && !formData.group) return toast.error("Guruhni tanlang!");
 const groupId = hasGroupId ? paramGroupId : formData.group;
 const shouldCreatePayment = enrollmentToggles[studentId] !== false;

 setLoading(true);
 try {
 const response = await api.post(`/groups/groups/${groupId}/enroll-student/`, {
 student_id: studentId,
 create_payment: shouldCreatePayment
 });
 if (response.status === 201 || response.status === 200) {
 toast.success("O'quvchi guruhga biriktirildi!");
 // ✅ Guruh keshini to'liq o'chirib, sahifaga qaytganda fresh data yuklansin
 queryClient.removeQueries({ queryKey: ['group-detail', String(groupId)] });
 queryClient.removeQueries({ queryKey: ['group-detail', groupId] });
 navigate(-1);
 } else {
 toast.error(response.data?.detail ||"Noma'lum xatolik");
 }
 } catch (error) {
 const errMsg = error.response?.data?.detail ||"Biriktirishda xatolik yuz berdi";
 toast.error(errMsg);
 } finally {
 setLoading(false);
 }
 };

 const handleImageChange = (e) => {
 const file = e.target.files[0];
 if (file) {
 setFormData((prev) => ({ ...prev, image: file }));
 setPreview(URL.createObjectURL(file));
 }
 };

 const removeImage = () => {
 setFormData((prev) => ({ ...prev, image: null }));
 setPreview(null);
 };

 const handleSubmit = async (e) => {
 e.preventDefault();
 if (!formData.group && !hasGroupId) return toast.error("Guruhni tanlang!");

 setLoading(true);
 const data = new FormData();
 Object.keys(formData).forEach(key => {
 if (key ==='image') {
 if (formData[key]) data.append('image', formData[key]);
 } else {
 data.append(key, formData[key]);
 }
 });

 try {
 const response = await api.post('/groups/students/', data, {
 headers: {'Content-Type':'multipart/form-data' }
 });
 if (response.status === 201 || response.status === 200) {
 toast.success("O'quvchi muvaffaqiyatli qo'shildi!");
 // ✅ Guruh keshini to'liq o'chirib, sahifaga qaytganda fresh data yuklansin
 if (paramGroupId) {
 queryClient.removeQueries({ queryKey: ['group-detail', String(paramGroupId)] });
 queryClient.removeQueries({ queryKey: ['group-detail', paramGroupId] });
 }
 navigate(-1);
 }
 } catch (err) {
 console.error('Student qo\'shishda xato:', err);
 const errMsg = err?.response?.data?.detail
 || err?.response?.data?.phone?.[0]
 || err?.response?.data?.full_name?.[0]
 || JSON.stringify(err?.response?.data ||'')
 ||'Xatolik yuz berdi!';
 toast.error(errMsg);
 setLoading(false);
 }
 };

 return (
 <div className="animate-lux-fade">
 {/* ATMOSPHERE */}
 <div className="fixed inset-0 pointer-events-none -z-10">
 <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[var(--gold)]/5 rounded-full blur-[140px]"></div>
 </div>

 <div className="max-w-[1400px] mx-auto">
 <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
 {/* IDENTITY COLUMN */}
 <div className="lg:col-span-4 space-y-6">
 <div className="lux-card">
 <div className="flex items-center gap-4 mb-2">
 <button
 type="button"
 onClick={() => navigate(-1)}
 className="p-3 bg-[var(--gold-dim)] text-[var(--gold)] rounded-xl border border-[var(--gold)]/20 hover:scale-105 active:scale-95 transition-all outline-none"
 >
 <ArrowLeft size={18} />
 </button>
 <div className="h-0.5 w-12 bg-[var(--gold)] opacity-30"></div>
 </div>
 <h1 className="gold-text !text-4xl">YANGI <br /> O'QUVCHI</h1>
 <p className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-[0.4em] mt-3">
 {hasGroupId ? `GURUH ID: #${paramGroupId}` :"GURUH TANLANMAGAN"}
 </p>
 </div>

 {/* MEDIA ASSET */}
 <div className="lux-card flex flex-col items-center py-10">
 <div className="relative group">
 <div className="w-48 h-48 bg-[var(--bg-void)] border-2 border-dashed border-[var(--border-glass)] rounded-3xl flex items-center justify-center overflow-hidden transition-all group-hover:border-[var(--gold)]/50 group-hover:shadow-[0_0_40px_rgba(184,134,11,0.15)]">
 {preview ? (
 <img src={preview} className="w-full h-full object-cover" alt="" />
 ) : (
 <div className="text-center opacity-40">
 <Camera size={48} className="mx-auto mb-4" />
 <span className="text-[10px] font-black capitalize tracking-widest">RASM YUKLASH</span>
 </div>
 )}
 <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 opacity-0 cursor-pointer" />
 </div>
 {preview && (
 <button type="button" onClick={removeImage} className="absolute -top-3 -right-3 w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center shadow-2xl hover:scale-110 active:scale-90 transition-all">
 <X size={18} className="text-white" />
 </button>
 )}
 </div>
 <p className="mt-6 text-[11px] font-bold text-[var(--text-secondary)] capitalize tracking-[0.2em]">O'quvchi rasmi</p>
 </div>

 {/* INTELLIGENCE NOTES */}
 <div className="lux-card lg:mt-6">
 <div className="flex items-center gap-3 mb-5 border-b border-[var(--border-glass)] pb-4">
 <FileText size={18} className="text-[var(--gold)]" />
 <h2 className="!text-white capitalize tracking-widest text-sm">QO'SHIMCHA MA'LUMOTLAR</h2>
 </div>
 <textarea
 name="notes"
 value={formData.notes}
 onChange={handleChange}
 placeholder="O'quvchi haqida qo'shimcha izohlar..."
 className="lux-input !h-32 !bg-[var(--bg-void)]/30 !resize-none !text-xs !leading-relaxed"
 ></textarea>
 </div>
 </div>

 {/* DATA COLUMN */}
 <div className="lg:col-span-8 space-y-6">
 {/* PERSONAL DATA */}
 <div className="lux-card">
 <div className="flex items-center gap-4 mb-10 border-b border-[var(--border-glass)] pb-6">
 <div className="w-12 h-12 bg-[var(--gold-dim)] border border-[var(--gold)]/20 rounded-2xl flex items-center justify-center text-[var(--gold)]">
 <User size={24} />
 </div>
 <div>
 <h2 className="!text-white !text-lg capitalize font-black">Shaxsiy ma'lumotlar</h2>
 <p className="text-[10px] text-[var(--text-muted)] font-black capitalize tracking-widest mt-1">ASOSIY MA'LUMOTLAR</p>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
 {!hasGroupId && (
 <div className="md:col-span-2">
 <label className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-3 block">Guruhni tanlang *</label>
 <select name="group" value={formData.group} onChange={handleChange} required className="lux-input !bg-[var(--bg-void)]">
 <option value="">GURUHLAR YUKLANMOQDA...</option>
 {groups.map(g => (
 <option key={g.id} value={g.id}>{g.name} — {g.subject}</option>
 ))}
 </select>
 </div>
 )}

 <div className="md:col-span-2 space-y-2">
 <label className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-1.5 block">To'liq ism-sharifi *</label>
 <div className="lux-input-group">
 <User size={16} />
 <input name="full_name" value={formData.full_name} onChange={handleChange} required placeholder="ALISHER NAVOIY" className="lux-input !bg-[var(--bg-void)] capitalize font-bold" />
 </div>
 </div>

 <div className="lux-input-group relative">
 <Phone size={16} />
 <input name="phone" value={formData.phone} onChange={handleChange} required placeholder="+998 90 123 45 67" className="lux-input !bg-[var(--bg-void)]" />
 {searching && (
 <div className="absolute right-4 top-1/2 -translate-y-1/2">
 <div className="w-4 h-4 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin"></div>
 </div>
 )}
 </div>

 {/* SEARCH RESULTS */}
 {searchResults.length > 0 && (
 <div className="md:col-span-2 space-y-3 bg-[var(--bg-void)]/80 p-4 rounded-2xl border border-[var(--gold)]/20 animate-in fade-in slide-in-from-top-2">
 <p className="text-[10px] font-black text-[var(--gold)] capitalize tracking-widest flex items-center gap-2">
 <Search size={12} /> Tizimda o'xshash o'quvchilar topildi:
 </p>
 <p className="text-[9px] text-[var(--text-muted)] leading-relaxed">
 Loyiha mantiqidan kelib chiqib: Agar bu o'quvchi allaqachon mavjud bo'lsa, <b>"Biriktirish"</b> ni bosing.
 Agar ismi o'xshash boshqa inson bo'lsa, pastdagi <b>"O'QUVCHINI SAQLASH"</b> tugmasi orqali yangi rekord yarating.
 </p>
 {searchResults.map(student => {
 const cleanPhoneInput = formData.phone.replace(/\D/g,'');
 const cleanStudentPhone = student.phone?.replace(/\D/g,'') ||'';
 const isPhoneExact = cleanPhoneInput.length >= 7 && cleanStudentPhone.includes(cleanPhoneInput);
 const isNameSimilar = student.full_name?.toLowerCase().includes(formData.full_name.toLowerCase()) ||
 formData.full_name.toLowerCase().includes(student.full_name?.toLowerCase());

 return (
 <div key={student.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${isPhoneExact ?'bg-amber-500/5 border-amber-500/20' :'bg-white/5 border-white/5'}`}>
 <div className="flex items-center gap-3">
 <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isPhoneExact ?'bg-amber-500/20 text-amber-500' :'bg-[var(--gold)]/10 text-[var(--gold)]'}`}>
 <User size={20} />
 </div>
 <div>
 <div className="flex items-center gap-2">
 <p className="text-sm font-bold text-white">{student.full_name}</p>
 {isPhoneExact && !isNameSimilar && formData.full_name && (
 <span className="px-2 py-0.5 bg-red-500/20 text-red-500 text-[8px] font-black rounded capitalize flex items-center gap-1">
 <X size={8} /> Ism farqli!
 </span>
 )}
 </div>
 <div className="flex items-center gap-2">
 <p className="text-[10px] text-[var(--text-muted)]">{student.phone}</p>
 {isPhoneExact && (
 <span className="text-[8px] text-amber-500 font-bold capitalize tracking-tighter decoration-amber-500/50 underline underline-offset-2">Telefon mos keldi</span>
 )}
 </div>
 </div>
 </div>

 <div className="flex items-center gap-3">
 <div className="flex items-center gap-2 pr-2 border-r border-white/10 group/switch">
 <span className={`text-[8px] font-bold capitalize transition-colors ${enrollmentToggles[student.id] ?'text-amber-500' :'text-[var(--text-muted)]'}`}> Billing </span>
 <label className="relative inline-flex items-center cursor-pointer">
 <input
 type="checkbox"
 className="sr-only peer"
 checked={enrollmentToggles[student.id] !== false}
 onChange={(e) => setEnrollmentToggles(prev => ({ ...prev, [student.id]: e.target.checked }))}
 />
 <div className="w-9 h-5 bg-white/10 rounded-full peer peer-checked:bg-amber-500/80 transition-all after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4 shadow-xl"></div>
 </label>
 </div>

 <button
 type="button"
 onClick={() => handleEnrollExisting(student.id)}
 className={`px-4 py-2 rounded-lg text-[10px] font-black capitalize hover:scale-105 active:scale-95 transition-all flex items-center gap-2 ${isPhoneExact ?'bg-amber-500 text-black' :'bg-[var(--gold)] text-black'}`}
 >
 <CheckCircle2 size={14} /> Biriktirish
 </button>
 </div>
 </div>
 );
 })}
 </div>
 )}

 <div className="space-y-2">
 <label className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-1.5 block">Tug'ilgan sana</label>
 <div className="lux-input-group">
 <Calendar size={16} />
 <input name="birth_date" value={formData.birth_date} onChange={handleChange} type="date" className="lux-input !bg-[var(--bg-void)]" />
 </div>
 </div>
 </div>
 </div>

 {/* BOG'LANISH PROTOCOLS */}
 <div className="lux-card">
 <div className="flex items-center gap-4 mb-10 border-b border-[var(--border-glass)] pb-6">
 <div className="w-12 h-12 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-center text-purple-500">
 <Users size={24} />
 </div>
 <div>
 <h2 className="!text-white !text-lg capitalize font-black">Ota-ona ma'lumotlari</h2>
 <p className="text-[10px] text-[var(--text-muted)] font-black capitalize tracking-widest mt-1">BOG'LANISH UCHUN</p>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
 <div className="space-y-2">
 <label className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-1.5 block">Ota-onasi (F.I.SH)</label>
 <div className="lux-input-group">
 <User size={16} />
 <input name="parent_name" value={formData.parent_name} onChange={handleChange} placeholder="OTASI YOKI ONASI" className="lux-input !bg-[var(--bg-void)] capitalize" />
 </div>
 </div>
 <div className="space-y-2">
 <label className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-1.5 block">Qo'shimcha telefon</label>
 <div className="lux-input-group">
 <Phone size={16} />
 <input name="parent_phone" value={formData.parent_phone} onChange={handleChange} placeholder="+998 9X XXX XX XX" className="lux-input !bg-[var(--bg-void)]" />
 </div>
 </div>
 <div className="md:col-span-2 space-y-2">
 <label className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-1.5 block">Yashash manzili</label>
 <div className="lux-input-group">
 <MapPin size={16} />
 <input name="address" value={formData.address} onChange={handleChange} placeholder="MANZILNI KIRITING" className="lux-input !bg-[var(--bg-void)]" />
 </div>
 </div>
 </div>
 </div>

 {/* FINANCIAL STRATEGY */}
 <div className="lux-card">
 <div className="flex items-center gap-4 mb-10 border-b border-[var(--border-glass)] pb-6">
 <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-500">
 <CreditCard size={24} />
 </div>
 <div>
 <h2 className="!text-white !text-lg capitalize font-black">To'lov va Status</h2>
 <p className="text-[10px] text-[var(--text-muted)] font-black capitalize tracking-widest mt-1">MOLIYAVIY STRATEGIYA</p>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
 <div>
 <label className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-3 block">O'quvchi holati</label>
 <select name="status" value={formData.status} onChange={handleChange} className="lux-input !bg-[var(--bg-void)]">
 <option value="regular">ODDIY</option>
 <option value="discount">IMTIYOZLI</option>
 <option value="low_income">KAM TA'MINLANGAN</option>
 <option value="negotiated">KELISHILGAN NARX</option>
 </select>
 </div>
 <div>
 <label className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-3 block">Individual narx</label>
 <AmountInput
 name="custom_fee"
 value={formData.custom_fee}
 onChange={handleChange}
 placeholder="Ixtiyoriy summa"
 className="lux-input !bg-[var(--bg-void)] pr-12"
 />
 </div>
 {/* CREATE PAYMENT TOGGLE */}
 <div className="md:col-span-2 pt-2">
 <label className="flex items-center gap-3 cursor-pointer group">
 <div className="relative">
 <input
 type="checkbox"
 className="sr-only peer"
 checked={formData.create_payment}
 onChange={(e) => setFormData(prev => ({ ...prev, create_payment: e.target.checked }))}
 />
 <div className="w-12 h-6 bg-white/10 rounded-full peer-checked:bg-[var(--gold)] transition-all"></div>
 <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-all peer-checked:translate-x-6"></div>
 </div>
 <div>
 <span className="text-[11px] font-black capitalize tracking-widest text-white group-hover:text-[var(--gold)] transition-colors">
 Oylik to'lov varaqasi yaratilsin
 </span>
 <p className="text-[9px] text-[var(--text-muted)] capitalize font-bold mt-0.5">
 {formData.create_payment ?"Ushbu oy uchun avtomatik Billing yoqilgan" :"Faqat guruhga qo'shiladi, Billing (to'lov) yaratilmaydi"}
 </p>
 </div>
 </label>
 </div>
 </div>
 </div>

 {/* SUBMIT PROTOCOL */}
 <div className="flex justify-end gap-5 pt-10 pb-20">
 <button
 type="button"
 onClick={() => navigate(-1)}
 className="lux-btn !px-10 !border-[var(--border-glass)] !text-[var(--text-secondary)] hover:!text-white font-black capitalize text-[10px]"
 >
 BEKOR QILISH
 </button>
 <button
 type="submit"
 disabled={loading}
 className="lux-btn lux-btn-primary !px-16 !h-16 shadow-[0_10px_40px_rgba(184,134,11,0.2)] text-[11px] font-black capitalize tracking-widest"
 >
 {loading ?"SAQLANMOQDA..." :"O'QUVCHINI SAQLASH"}
 {!loading && <Plus size={18} className="ml-2" />}
 </button>
 </div>
 </div>
 </form>
 </div>
 </div>
 );
};

export default StudentAdd;