import { useState } from"react";
import { useNavigate } from"react-router-dom";
import api from"../../tokenUpdater/updater";
import toast from"react-hot-toast";
import { Palette, Check, X, Phone, User as UserIcon, Shield, ChevronRight } from"lucide-react";

export default function AdminCard({ data }) {
 const navigate = useNavigate();
 const [colorCh, setColorCH] = useState(false);
 const [selectedColor, setSelectedColor] = useState(data.color ||'#b8860b');
 const [loading, setLoading] = useState(false);

 const handleColorChange = (e) => {
 setSelectedColor(e.target.value);
 };

 const saveNewColor = async () => {
 setLoading(true);
 try {
 const response = await api.patch(`/register/users/${data.id}/`, {
 color: selectedColor
 });
 if (response.status === 200) {
 setColorCH(false);
 toast.success("Rang muvaffaqiyatli o'zgartirildi!");
 }
 } catch (error) {
 console.error("Error:", error);
 setSelectedColor(data.color);
 toast.error("Rangni o'zgartirishda xatolik!");
 } finally {
 setLoading(false);
 }
 };

 return (
 <div
 className="lux-card !p-0 overflow-hidden group transition-all duration-500 hover:shadow-2xl hover:shadow-[var(--gold)]/10 border-b-4 relative"
 style={{ borderBottomColor: `${selectedColor}40` }}
 >
 {/* Premium Color Flag */}
 <div
 className="absolute top-0 right-10 w-8 h-12 z-10 shadow-lg transition-transform group-hover:h-14 duration-500 origin-top"
 style={{
 background: selectedColor,
 clipPath:'polygon(0% 0%, 100% 0%, 100% 100%, 50% 85%, 0% 100%)',
 boxShadow: `0 4px 15px ${selectedColor}40`
 }}
 />
 <div className="p-5 md:p-7">
 <div
 onClick={() => !colorCh && navigate(`${data.id}`)}
 className={`flex flex-col sm:flex-row items-center sm:items-start lg:items-center gap-5 md:gap-7 transition-all duration-500 ${colorCh ?'opacity-20 blur-sm scale-95' :'opacity-100 cursor-pointer'}`}
 >
 {/* Avatar - Larger & More Premium */}
 <div className="relative shrink-0">
 <div
 style={{ boxShadow: `0 15px 35px ${selectedColor}20` }}
 className="w-20 h-20 md:w-24 md:h-24 rounded-[2rem] overflow-hidden bg-[var(--bg-void)] border-2 border-[var(--border-glass)] p-1.5 group-hover:border-[var(--gold)]/50 transition-all duration-700 transform group-hover:rotate-3"
 >
 <div className="w-full h-full bg-[var(--bg-panel)] rounded-[1.8rem] overflow-hidden flex items-center justify-center border border-[var(--border-glass)] shadow-inner">
 {data.image ? (
 <img src={data.image} className="w-full h-full object-cover" alt="avatar" />
 ) : (
 <span className="text-2xl md:text-3xl font-black text-[var(--gold)]">
 {data.first_name?.[0]}{data.last_name?.[0]}
 </span>
 )}
 </div>
 </div>
 <div
 className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-4 border-[var(--bg-void)] shadow-lg"
 style={{ background: selectedColor }}
 />
 </div>

 {/* Content - Full Visibility */}
 <div className="flex-1 text-center sm:text-left min-w-0">
 <div className="space-y-1 md:space-y-1.5">
 <h3 className="text-lg md:text-xl lg:text-2xl font-black text-[var(--text-primary)] capitalize tracking-tight leading-tight">
 {data.first_name} {data.last_name}
 </h3>
 <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/20">
 <Shield size={10} className="text-[var(--gold)]" />
 <span className="text-[9px] md:text-[10px] font-black text-[var(--gold)] capitalize tracking-[0.2em]">
 {data.role?.replace('_','') ||"Administrator"}
 </span>
 </div>
 </div>

 <div className="mt-4 flex flex-col sm:flex-row items-center gap-3 sm:gap-6 text-[var(--text-muted)]">
 <div className="flex items-center gap-2 bg-[var(--bg-panel)]/50 px-3 py-1.5 rounded-xl border border-[var(--border-glass)]">
 <Phone size={12} className="text-[var(--gold)]/60" />
 <span className="text-[11px] md:text-xs font-bold tracking-widest">{data.phone_number ||"ALOQA YO'Q"}</span>
 </div>
 </div>
 </div>

 {/* Quick Profile Arrow */}
 <div className="hidden sm:flex shrink-0 items-center h-full">
 <div className="p-3 rounded-2xl bg-[var(--bg-panel)]/50 border border-[var(--border-glass)] text-[var(--text-muted)] group-hover:text-[var(--gold)] group-hover:border-[var(--gold)]/30 transition-all transform group-hover:translate-x-1">
 <ChevronRight size={18} />
 </div>
 </div>
 </div>

 {/* Bottom Color Trigger - Floating Absolute */}
 <button
 onClick={(e) => { e.stopPropagation(); setColorCH(true); }}
 className="absolute top-4 right-4 p-2.5 rounded-xl bg-[var(--bg-panel)]/80 backdrop-blur-md border border-[var(--border-glass)] text-[var(--text-secondary)] hover:text-[var(--gold)] hover:border-[var(--gold)]/40 transition-all opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0"
 >
 <Palette size={16} />
 </button>
 </div>

 {/* Color Selection Overlay */}
 {colorCh && (
 <div
 className="absolute inset-0 z-20 bg-[var(--bg-void)]/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-500"
 >
 <div className="mb-6 text-center">
 <p className="text-[10px] font-black text-[var(--gold)] capitalize tracking-[0.5em] mb-2">Rangni Tanlash</p>
 <div className="w-12 h-1 bg-[var(--gold)]/20 mx-auto rounded-full" />
 </div>

 <div className="flex flex-col items-center gap-6 w-full max-w-[240px]">
 <div className="relative group/picker cursor-pointer">
 <input
 type="color"
 value={selectedColor}
 onChange={handleColorChange}
 className="w-20 h-20 cursor-pointer bg-transparent border-none rounded-[2rem] overflow-hidden p-0 shadow-2xl transition-transform hover:scale-110"
 style={{ boxShadow: `0 0 30px ${selectedColor}40` }}
 />
 <div className="absolute inset-0 rounded-[2rem] border-4 border-white/20 pointer-events-none" />
 </div>

 <div className="flex gap-3 w-full">
 <button
 onClick={saveNewColor}
 disabled={loading}
 className="lux-btn lux-btn-primary flex-1 !h-12 !rounded-2xl !text-[11px] capitalize font-black"
 >
 {loading ? <div className="border-2 border-black/30 border-t-black rounded-full animate-spin w-4 h-4" /> :"TASDIQLASH"}
 </button>
 <button
 onClick={() => { setColorCH(false); setSelectedColor(data.color); }}
 className="w-12 h-12 flex items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all transform active:scale-90"
 >
 <X size={20} />
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}