import React from "react";
import GoBackButton from "../../sendback";
import { Save, X, Edit3, Layers, Trash2 } from "lucide-react";

const StudentHeader = ({
    isEditing,
    canEditStudent,
    userRole,
    handleSaveEdit,
    dispatch,
}) => {
    const isSuperOrAdmin = userRole === 'admin' || userRole === 'super_admin';

    return (
        <div className="flex items-center justify-between gap-4 w-full mb-2">
            <div className="-ml-1 sm:-ml-2 scale-90 sm:scale-100 origin-left">
                <GoBackButton />
            </div>

            <div className="flex items-center gap-2 shrink-0">
                {canEditStudent && (
                    <div className="flex items-center gap-1.5 bg-[var(--bg-panel)] p-1.5 rounded-xl border border-[var(--border-glass)] shadow-sm">
                        {isEditing ? (
                            <>
                                <button 
                                    onClick={handleSaveEdit} 
                                    className="p-2 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-all hover:scale-105 active:scale-95 flex items-center justify-center" 
                                    title="Saqlash"
                                >
                                    <Save size={18} className="text-emerald-600 dark:text-emerald-400" />
                                </button>
                                <button 
                                    onClick={() => dispatch({ type: 'SET_EDITING', payload: false })} 
                                    className="p-2 text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-all hover:scale-105 active:scale-95 flex items-center justify-center" 
                                    title="Bekor qilish"
                                >
                                    <X size={18} className="text-rose-600 dark:text-rose-400" />
                                </button>
                            </>
                        ) : (
                            <>
                                <button 
                                    onClick={() => dispatch({ type: 'SET_EDITING', payload: true })} 
                                    className="p-2 text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg transition-all hover:scale-105 active:scale-95 flex items-center justify-center" 
                                    title="Tahrirlash"
                                >
                                    <Edit3 size={18} className="text-blue-600 dark:text-blue-400" />
                                </button>
                                
                                {isSuperOrAdmin && (
                                    <button 
                                        onClick={() => dispatch({ type: 'TOGGLE_MERGE_MODAL', payload: true })} 
                                        className="p-2 text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg transition-all hover:scale-105 active:scale-95 flex items-center justify-center" 
                                        title="Birlashtirish"
                                    >
                                        <Layers size={18} className="text-amber-600 dark:text-amber-400" />
                                    </button>
                                )}
                                
                                <button
                                    onClick={() => { 
                                        dispatch({ type: 'TOGGLE_UNENROLL_SELECT_MODAL', payload: true });
                                    }}
                                    className="p-2 text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
                                    title="O'chirish"
                                >
                                    <Trash2 size={18} className="text-rose-600 dark:text-rose-400" />
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentHeader;
