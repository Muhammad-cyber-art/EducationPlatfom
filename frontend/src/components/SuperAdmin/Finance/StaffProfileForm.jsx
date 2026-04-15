import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, UserPlus, Loader2, CreditCard, Banknote, User, CheckCircle2, AlertCircle, Users, Percent, DollarSign } from 'lucide-react';
import api from '../../../tokenUpdater/updater';
import AmountInput from '../../Common/AmountInput';

const StaffProfileForm = ({ isOpen, onClose, onSuccess, branch }) => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [existingProfiles, setExistingProfiles] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [selectedRole, setSelectedRole] = useState('admin');
  const [salaryType, setSalaryType] = useState('fixed'); // 'fixed' yoki 'percentage'

  const [formData, setFormData] = useState({
    user: '',
    salary_type: 'fixed',
    fixed_salary: '',
    commission_percentage: '',
    per_student_amount: '',
    karta: ''
  });

  // Role o'zgarganda xodimlarni qayta yuklash
  useEffect(() => {
    if (isOpen && selectedRole) {
      fetchUsers();
      fetchExistingProfiles();
      // User selectionni reset qilish
      setFormData(prev => ({
        ...prev,
        user: '',
        // Admin uchun default fixed, mentor uchun percentage
        salary_type: selectedRole === 'admin' ? 'fixed' : 'percentage'
      }));
      setSalaryType(selectedRole === 'admin' ? 'fixed' : 'percentage');
    }
  }, [isOpen, selectedRole]);

  // Salary type o'zgarganda formData'ni yangilash
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      salary_type: salaryType,
      // Reset other salary fields based on type
      ...(salaryType === 'fixed' ? { commission_percentage: '0', per_student_amount: '0' } : 
         salaryType === 'percentage' ? { fixed_salary: '0', per_student_amount: '0' } :
         { fixed_salary: '0', commission_percentage: '0' })
    }));
  }, [salaryType]);

  const fetchExistingProfiles = async () => {
    try {
      const response = await api.get('/finance/staff-profiles/');
      setExistingProfiles(response.data);
    } catch (err) {
      console.error('Profillarni yuklashda xatolik:', err);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    setError('');
    try {
      const response = await api.get(`/register/users/?branch=${branch}&role=${selectedRole}`);
      setUsers(response.data);
    } catch (err) {
      setError('Xodimlarni yuklashda xatolik');
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Profili mavjud bo'lmagan userlarni filtrlash
  const availableUsers = users.filter(user =>
    !existingProfiles.some(profile => profile.user === user.id)
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validatsiya
    if (salaryType === 'fixed' && !formData.fixed_salary) {
      setError('Belgilangan maoshni kiriting');
      setLoading(false);
      return;
    }

    if (salaryType === 'percentage' && !formData.commission_percentage) {
      setError('Komissiya foizini kiriting');
      setLoading(false);
      return;
    }

    if (salaryType === 'percentage' && (formData.commission_percentage < 0 || formData.commission_percentage > 100)) {
      setError('Foiz 0 dan 100 gacha bo\'lishi kerak');
      setLoading(false);
      return;
    }

    if (salaryType === 'student_count' && !formData.per_student_amount) {
      setError('Har bir o\'quvchi uchun summani kiriting');
      setLoading(false);
      return;
    }

    try {
      const submitData = {
        user: formData.user,
        salary_type: salaryType,
        fixed_salary: salaryType === 'fixed' ? formData.fixed_salary : 0,
        commission_percentage: salaryType === 'percentage' ? formData.commission_percentage : 0,
        per_student_amount: salaryType === 'student_count' ? formData.per_student_amount : 0,
        karta: formData.karta
      };

      await api.post('/finance/staff-profiles/', submitData);

      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        handleClose();
      }, 1500);

    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      user: '',
      salary_type: 'fixed',
      fixed_salary: '',
      commission_percentage: '',
      per_student_amount: '',
      karta: ''
    });
    setSelectedRole('admin');
    setSalaryType('fixed');
    setError('');
    setSuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">

      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-[2.5rem] shadow-2xl scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[var(--gold)]/20 animate-in zoom-in-95 duration-200">


        <div className="sticky top-0 z-10 h-1.5 w-full bg-gradient-to-r from-[var(--gold)]/50 via-[var(--gold)] to-[var(--gold)]/50"></div>

        <div className="p-4 md:p-5">
          <button
            onClick={handleClose}
            disabled={loading}
            className="absolute top-3 right-3 text-[var(--text-muted)] hover:text-[var(--gold)] transition-colors p-1.5 hover:bg-[var(--gold)]/10 rounded-xl"
          >
            <X size={18} />
          </button>

          <div className="flex justify-center mb-3">
            <div className="relative">
              <div className="absolute inset-0 bg-[var(--gold)] blur-2xl opacity-20 animate-pulse"></div>
              <div className="relative bg-[var(--gold)]/10 p-3 rounded-[1.5rem] border border-[var(--gold)]/20">
                <UserPlus size={28} className="text-[var(--gold)]" />
              </div>
            </div>
          </div>

          <div className="text-center mb-4">
            <h2 className="text-lg font-black text-[var(--text-primary)] mb-1 tracking-tight uppercase">Yangi Xodim Profili</h2>
            <p className="text-[9px] text-[var(--text-muted)] leading-relaxed uppercase tracking-widest opacity-60">
              Xodim uchun moliyaviy profil yarating
            </p>
          </div>

          {success ? (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 mb-4 text-center">
              <CheckCircle2 className="mx-auto mb-3 text-emerald-400" size={40} />
              <p className="text-emerald-300 font-bold uppercase tracking-wide text-sm">Profil muvaffaqiyatli yaratildi!</p>
            </div>
          ) : (
            <div className="space-y-4">

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3">
                  <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
                  <p className="text-xs text-red-300 font-bold">{error}</p>
                </div>
              )}

              {/* Role Selector */}
              <div>
                <label className="flex items-center gap-2 text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2 px-1">
                  <Users size={12} className="text-[var(--gold)]" />
                  Lavozim Turi
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedRole('admin')}
                    disabled={loading}
                    className={`relative overflow-hidden rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-widest transition-all ${selectedRole === 'admin'
                      ? 'bg-[var(--gold)] text-black shadow-[0_0_20px_rgba(184,134,11,0.3)] scale-[1.02]'
                      : 'bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--text-secondary)] hover:border-[var(--gold)]/50 hover:text-[var(--gold)]'
                      }`}
                  >
                    <div className="relative z-10 flex items-center justify-center gap-2">
                      <span>Admin</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRole('mentor')}
                    disabled={loading}
                    className={`relative overflow-hidden rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-widest transition-all ${selectedRole === 'mentor'
                      ? 'bg-[var(--gold)] text-black shadow-[0_0_20px_rgba(184,134,11,0.3)] scale-[1.02]'
                      : 'bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--text-secondary)] hover:border-[var(--gold)]/50 hover:text-[var(--gold)]'
                      }`}
                  >
                    <div className="relative z-10 flex items-center justify-center gap-2">
                      <span>Mentor</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* User Selection */}
              <div>
                <label className="flex items-center gap-2 text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2 px-1">
                  <User size={12} className="text-[var(--gold)]" />
                  Xodimni Tanlang
                </label>
                <div className="relative group">
                  <select
                    className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--text-primary)] rounded-xl px-4 py-3.5 text-xs font-bold uppercase tracking-wide focus:outline-none focus:border-[var(--gold)]/50 transition-all disabled:opacity-50 hover:border-[var(--gold)]/30 appearance-none cursor-pointer shadow-inner"
                    value={formData.user}
                    onChange={(e) => setFormData({ ...formData, user: e.target.value })}
                    required
                    disabled={loadingUsers || loading}
                  >
                    <option disabled className="bg-[var(--bg-panel)]" value="">
                      {loadingUsers ? '... YuKLANMOQDA' : 'XODIMNI TANLANG'}
                    </option>
                    {availableUsers.map((user) => (
                      <option className="bg-[var(--bg-panel)]" key={user.id} value={user.id}>
                        {user.first_name} {user.last_name} ({user.username})
                      </option>
                    ))}
                  </select>
                </div>
                {availableUsers.length === 0 && !loadingUsers && (
                  <p className="text-[10px] text-amber-500 mt-2 flex items-center gap-2 font-bold uppercase tracking-wide">
                    <AlertCircle size={12} />
                    Barcha {selectedRole === 'admin' ? 'adminlar' : 'mentorlar'}ga profil yaratilgan
                  </p>
                )}
              </div>

              {/* Salary Type Selector */}
              <div>
                <label className="flex items-center gap-2 text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2 px-1">
                  <Banknote size={12} className="text-[var(--gold)]" />
                  Maosh Turi
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSalaryType('fixed')}
                    disabled={loading}
                    className={`relative overflow-hidden rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${salaryType === 'fixed'
                      ? 'bg-[var(--bg-panel)] text-[var(--gold)] border border-[var(--gold)] shadow-[inset_0_0_20px_rgba(184,134,11,0.1)]'
                      : 'bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                  >
                    <div className="relative z-10 flex items-center justify-center gap-2">
                      <DollarSign size={14} />
                      <span>Belgilangan</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSalaryType('percentage')}
                    disabled={loading}
                    className={`relative overflow-hidden rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${salaryType === 'percentage'
                      ? 'bg-[var(--bg-panel)] text-[var(--gold)] border border-[var(--gold)] shadow-[inset_0_0_20px_rgba(184,134,11,0.1)]'
                      : 'bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                  >
                    <div className="relative z-10 flex items-center justify-center gap-2">
                      <Percent size={14} />
                      <span>Foiz Asosida</span>
                    </div>
                  </button>

                  {selectedRole === 'mentor' && (
                    <button
                      type="button"
                      onClick={() => setSalaryType('student_count')}
                      disabled={loading}
                      className={`relative overflow-hidden rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${salaryType === 'student_count'
                        ? 'bg-[var(--bg-panel)] text-[var(--gold)] border border-[var(--gold)] shadow-[inset_0_0_20px_rgba(184,134,11,0.1)]'
                        : 'bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                        }`}
                    >
                      <div className="relative z-10 flex items-center justify-center gap-2">
                        <Users size={14} />
                        <span>O'quvchi Boshi</span>
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {/* Salary Input - Conditional */}
              <div className="grid grid-cols-1 gap-5">
                {salaryType === 'fixed' ? (
                  <div>
                    <label className="flex items-center gap-2 text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2 px-1">
                      <Banknote size={12} className="text-[var(--gold)]" />
                      Belgilangan Oylik Maosh (UZS)
                    </label>
                    <AmountInput
                      value={formData.fixed_salary}
                      onChange={(e) => setFormData({ ...formData, fixed_salary: e.target.value })}
                      placeholder="Masalan: 5 000 000"
                      required
                      className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--text-primary)] rounded-xl px-4 py-3.5 text-xs font-black focus:outline-none focus:border-[var(--gold)]/50 transition-all placeholder:[var(--text-muted)]/50 disabled:opacity-50 shadow-inner uppercase tracking-wide italic"
                    />
                    <p className="text-[9px] text-[var(--text-muted)] mt-2 font-bold uppercase tracking-wide opacity-60">
                      💡 Har oylik bir xil summa to'lanadi
                    </p>
                  </div>
                ) : salaryType === 'percentage' ? (
                  <div>
                    <label className="flex items-center gap-2 text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2 px-1">
                      <Percent size={12} className="text-[var(--gold)]" />
                      Komissiya Foizi (%)
                    </label>
                    <input
                      type="number"
                      value={formData.commission_percentage}
                      onChange={(e) => setFormData({ ...formData, commission_percentage: e.target.value })}
                      placeholder="Masalan: 40"
                      required
                      min="0"
                      max="100"
                      step="0.1"
                      disabled={loading}
                      className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--text-primary)] rounded-xl px-4 py-3.5 text-xs font-bold focus:outline-none focus:border-[var(--gold)]/50 transition-all placeholder:[var(--text-muted)]/50 disabled:opacity-50 shadow-inner uppercase tracking-wide"
                    />
                    <p className="text-[9px] text-[var(--text-muted)] mt-2 font-bold uppercase tracking-wide opacity-60">
                      💡 Guruh daromadidan foiz hisoblanadi (0-100%)
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="flex items-center gap-2 text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2 px-1">
                      <Users size={12} className="text-[var(--gold)]" />
                      Har bir o'quvchi uchun (UZS)
                    </label>
                    <AmountInput
                      value={formData.per_student_amount}
                      onChange={(e) => setFormData({ ...formData, per_student_amount: e.target.value })}
                      placeholder="Masalan: 50 000"
                      required
                      className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--text-primary)] rounded-xl px-4 py-3.5 text-xs font-black focus:outline-none focus:border-[var(--gold)]/50 transition-all placeholder:[var(--text-muted)]/50 disabled:opacity-50 shadow-inner uppercase tracking-wide italic"
                    />
                    <p className="text-[9px] text-[var(--text-muted)] mt-2 font-bold uppercase tracking-wide opacity-60">
                      💡 Guruhdagi har bir o'quvchi uchun summa to'lanadi
                    </p>
                  </div>
                )}
              </div>

              {/* Karta */}
              <div>
                <label className="flex items-center gap-2 text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2 px-1">
                  <CreditCard size={12} className="text-[var(--gold)]" />
                  Karta Raqami
                </label>
                <input
                  type="text"
                  value={formData.karta}
                  onChange={(e) => setFormData({ ...formData, karta: e.target.value })}
                  placeholder="8600 **** **** ****"
                  maxLength="19"
                  disabled={loading}
                  className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--text-primary)] rounded-xl px-4 py-3.5 text-xs font-bold focus:outline-none focus:border-[var(--gold)]/50 transition-all placeholder:[var(--text-muted)]/50 disabled:opacity-50 shadow-inner tracking-widest font-mono"
                />
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading || loadingUsers || !formData.user || availableUsers.length === 0}
                  className="w-full flex items-center justify-center gap-3 bg-[var(--gold)] hover:bg-[var(--gold)]/90 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black text-[11px] uppercase tracking-widest py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(184,134,11,0.3)] active:scale-[0.97]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Saqlanmoqda...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      Profilni Yaratish
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="w-full bg-transparent hover:bg-[var(--bg-panel)] text-[var(--text-muted)] hover:text-[var(--text-primary)] font-black text-[9px] uppercase tracking-[0.2em] py-2.5 rounded-xl transition-all border border-transparent hover:border-[var(--border-glass)]"
                >
                  Bekor qilish
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default StaffProfileForm;