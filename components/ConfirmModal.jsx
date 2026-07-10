'use client';

import React from 'react';
import { AlertTriangle, Trash2, Info } from 'lucide-react';

export default function ConfirmModal({
    isOpen,
    message,
    onConfirm,
    onCancel,
    type = 'danger',
    title = 'Xác nhận',
    requirePassword = false,
    requireReason = false,
    reasonLabel = 'Lý do',
    reasonPlaceholder = 'Nhập lý do...',
    confirmText
}) {
    const [password, setPassword] = React.useState('');
    const [reason, setReason] = React.useState('');

    React.useEffect(() => {
        if (isOpen) {
            setPassword('');
            setReason('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const isDanger = type === 'danger';
    const isWarning = type === 'warning';

    const iconBg = isDanger ? 'bg-red-100' : isWarning ? 'bg-amber-100' : 'bg-blue-100';
    const iconColor = isDanger ? 'text-red-600' : isWarning ? 'text-amber-500' : 'text-blue-600';
    const confirmBg = isDanger
        ? 'bg-red-600 hover:bg-red-700 shadow-red-600/30'
        : isWarning
        ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30'
        : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30';

    const Icon = isDanger ? Trash2 : isWarning ? AlertTriangle : Info;

    return (
        <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
        >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header stripe */}
                <div className={`h-1.5 w-full ${isDanger ? 'bg-red-500' : isWarning ? 'bg-amber-400' : 'bg-blue-500'}`} />

                <div className="p-7 text-center">
                    <div className={`w-14 h-14 ${iconBg} rounded-full flex items-center justify-center mx-auto mb-4 ring-4 ${isDanger ? 'ring-red-50' : isWarning ? 'ring-amber-50' : 'ring-blue-50'}`}>
                        <Icon className={iconColor} size={26} strokeWidth={2.5} />
                    </div>
                    <h3 className="text-lg font-black text-slate-800 mb-2">{title}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">{message}</p>
                    
                    {requirePassword && (
                        <div className="mt-5 text-left">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Mật khẩu xác nhận</label>
                            <input 
                                type="password" 
                                name="cbpro-confirm-password"
                                autoComplete="new-password"
                                autoCorrect="off"
                                spellCheck={false}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Nhập mật khẩu của bạn..."
                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:border-red-500 focus:bg-white outline-none transition-colors"
                            />
                        </div>
                    )}

                    {requireReason && (
                        <div className="mt-5 text-left">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{reasonLabel}</label>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder={reasonPlaceholder}
                                rows={4}
                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:border-blue-500 focus:bg-white outline-none transition-colors resize-none"
                                autoFocus
                            />
                            <p className="mt-2 text-[11px] font-semibold text-slate-400">Bắt buộc nhập để admin/QS trưởng biết lý do xử lý.</p>
                        </div>
                    )}
                </div>

                <div className="px-6 pb-6 flex gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition text-sm"
                    >
                        Hủy bỏ
                    </button>
                    <button
                        type="button"
                        onClick={() => onConfirm(requireReason ? reason.trim() : (requirePassword ? password : null))}
                        disabled={(requirePassword && !password) || (requireReason && !reason.trim())}
                        className={`flex-1 py-3 rounded-xl font-bold text-white shadow-lg ${confirmBg} transition text-sm ${(requirePassword && !password) || (requireReason && !reason.trim()) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {confirmText || (isDanger ? 'Chuyển vào thùng rác' : 'Đồng ý')}
                    </button>
                </div>
            </div>
        </div>
    );
}
