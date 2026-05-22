'use client';

import React, { useState } from 'react';
import { Building2, ShieldAlert } from 'lucide-react';

export default function LoginForm({ onLogin, usersList }) {
    const [form, setForm] = useState({ username: '', password: '' });
    const [error, setError] = useState('');
    const [promptUser, setPromptUser] = useState(null);
    const [promptPassword, setPromptPassword] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        const user = usersList.find(u => u.username === form.username && u.password === form.password);
        if (user) {
            if (user.isLocked) {
                setError('Tài khoản đã bị khóa.');
                return;
            }
            onLogin(user);
        } else {
            setError('Sai tài khoản hoặc mật khẩu.');
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full animate-in zoom-in duration-300">
                <div className="text-center mb-6">
                    <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <Building2 size={32} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-wide">CB Pro</h1>
                    <p className="text-slate-500 mt-2 text-sm">Hệ Thống Quản Lý Nội Bộ</p>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-200">
                            {error}
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-black text-slate-900 mb-1.5 uppercase tracking-tight">Tài khoản nhân viên</label>
                        <input 
                            type="text" 
                            value={form.username} 
                            onChange={(e) => setForm({ ...form, username: e.target.value })} 
                            className="w-full p-4 border-2 border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-50/50 transition font-bold text-slate-900 placeholder:text-slate-400" 
                            placeholder="Nhập username..."
                            required 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-black text-slate-900 mb-1.5 uppercase tracking-tight">Mật khẩu truy cập</label>
                        <input 
                            type="password" 
                            value={form.password} 
                            onChange={(e) => setForm({ ...form, password: e.target.value })} 
                            className="w-full p-4 border-2 border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-50/50 transition font-bold text-slate-900 placeholder:text-slate-400" 
                            placeholder="••••••••"
                            required 
                        />
                    </div>
                    <button 
                        type="submit" 
                        className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg shadow-lg hover:bg-blue-700 transition transform active:scale-95"
                    >
                        Đăng Nhập
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t">
                    <p className="text-xs font-semibold text-slate-400 mb-3 text-center uppercase tracking-widest">Đăng nhập nhanh</p>
                    <div className="grid grid-cols-2 gap-2">
                        {usersList.slice(0, 4).map(u => (
                            <button 
                                key={u.id} 
                                onClick={() => {
                                    setPromptUser(u);
                                    setPromptPassword('');
                                    setError('');
                                }} 
                                className="text-xs font-bold p-2.5 border-2 border-slate-200 rounded-lg text-slate-700 hover:border-blue-500 hover:bg-blue-50 transition flex items-center justify-center gap-1"
                            >
                                <ShieldAlert size={14} className="text-blue-500" /> {u.role}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {promptUser && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Đăng nhập {promptUser.role}</h3>
                        <p className="text-sm text-slate-500 mb-4">Nhập mật khẩu cho tài khoản <span className="font-bold text-slate-700">{promptUser.username}</span></p>
                        
                        <input 
                            type="password"
                            autoFocus
                            value={promptPassword}
                            onChange={(e) => setPromptPassword(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    if (promptPassword === promptUser.password) {
                                        onLogin(promptUser);
                                    } else {
                                        setError('Sai mật khẩu!');
                                        setPromptUser(null);
                                    }
                                }
                            }}
                            className="w-full p-4 border-2 border-slate-200 rounded-xl outline-none focus:border-blue-600 mb-4 font-black text-lg text-slate-900 tracking-widest placeholder:text-slate-400 placeholder:font-normal placeholder:text-base placeholder:tracking-normal"
                            placeholder="Mật khẩu..."
                        />
                        
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setPromptUser(null)}
                                className="flex-1 py-2 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition"
                            >
                                Hủy
                            </button>
                            <button 
                                onClick={() => {
                                    if (promptPassword === promptUser.password) {
                                        onLogin(promptUser);
                                    } else {
                                        setError('Sai mật khẩu!');
                                        setPromptUser(null);
                                    }
                                }}
                                className="flex-1 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition"
                            >
                                Xác nhận
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
