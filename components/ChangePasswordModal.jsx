import React, { useState } from 'react';
import { X, Key, ShieldCheck, AlertCircle } from 'lucide-react';

export default function ChangePasswordModal({ isOpen, user, onClose, onSave }) {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');

    if (!isOpen || !user) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        if (!newPassword || !confirmPassword) {
            setError('Vui lòng điền đầy đủ thông tin!');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Xác nhận mật khẩu mới không khớp!');
            return;
        }

        onSave(newPassword);
        setNewPassword('');
        setConfirmPassword('');
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <header className="bg-slate-900 text-white p-5 flex justify-between items-center">
                    <h3 className="font-extrabold text-lg flex items-center gap-2">
                        <Key size={20} className="text-indigo-400" /> Đổi mật khẩu
                    </h3>
                    <button 
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
                    >
                        <X size={20} />
                    </button>
                </header>

                <form onSubmit={handleSubmit} className="p-6">
                    <div className="mb-6 text-center">
                        <div className="bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                            <ShieldCheck size={32} className="text-indigo-600" />
                        </div>
                        <p className="text-slate-600 font-medium">Tài khoản: <strong className="text-indigo-700">@{user.username}</strong></p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-sm font-bold">
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Mật khẩu mới</label>
                            <input 
                                type="password" 
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 transition font-mono"
                                placeholder="Nhập mật khẩu mới..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Xác nhận mật khẩu mới</label>
                            <input 
                                type="password" 
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 transition font-mono"
                                placeholder="Nhập lại mật khẩu mới..."
                            />
                        </div>
                    </div>

                    <div className="mt-8 flex justify-end gap-3">
                        <button 
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition"
                        >
                            Hủy bỏ
                        </button>
                        <button 
                            type="submit"
                            className="px-6 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/30 flex items-center gap-2"
                        >
                            Lưu mật khẩu
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
