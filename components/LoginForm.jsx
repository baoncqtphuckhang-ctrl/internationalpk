'use client';

import React, { useState } from 'react';
import { Building2, ShieldAlert, Lock, User, ArrowRight, Eye, EyeOff } from 'lucide-react';

export default function LoginForm({ onLogin, usersList }) {
    const [form, setForm] = useState({ username: '', password: '' });
    const [error, setError] = useState('');
    const [promptUser, setPromptUser] = useState(null);
    const [promptPassword, setPromptPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showPromptPassword, setShowPromptPassword] = useState(false);

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
        <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 relative overflow-hidden font-sans">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-blue-600/20 blur-[120px]" />
                <div className="absolute top-[60%] -right-[10%] w-[50%] h-[60%] rounded-full bg-indigo-600/20 blur-[120px]" />
            </div>

            <div className="relative bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-8 md:p-10 max-w-md w-full animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="text-center mb-10">
                    <div className="bg-gradient-to-br from-blue-500 to-indigo-600 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(59,130,246,0.5)] transform hover:rotate-6 transition-transform duration-500">
                        <Building2 size={40} className="text-white" strokeWidth={1.5} />
                    </div>
                    <h1 className="text-4xl font-black text-white tracking-tight">CB Pro</h1>
                    <p className="text-blue-200/70 mt-2 text-sm font-medium tracking-wide">Hệ Thống Quản Lý Nội Bộ</p>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                        <div className="p-4 bg-red-500/10 text-red-400 text-sm font-medium rounded-2xl border border-red-500/20 flex items-center justify-center animate-in shake">
                            {error}
                        </div>
                    )}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-widest pl-1">Tài khoản nhân viên</label>
                        <div className="relative group">
                            <User className="absolute left-4 top-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={20} />
                            <input 
                                type="text" 
                                value={form.username} 
                                onChange={(e) => setForm({ ...form, username: e.target.value })} 
                                className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all font-medium text-white placeholder:text-slate-600" 
                                placeholder="Nhập username..."
                                required 
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-widest pl-1">Mật khẩu truy cập</label>
                        <div className="relative group">
                            <Lock className="absolute left-4 top-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={20} />
                            <input 
                                type={showPassword ? "text" : "password"} 
                                value={form.password} 
                                onChange={(e) => setForm({ ...form, password: e.target.value })} 
                                className={`w-full pl-12 pr-12 py-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all font-medium text-white placeholder:text-slate-600 ${!showPassword && form.password ? 'tracking-wider' : ''}`} 
                                placeholder="••••••••"
                                required 
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-4 text-slate-500 hover:text-blue-400 transition-colors"
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>
                    <button 
                        type="submit" 
                        className="w-full group mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-4 rounded-2xl shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] transition-all duration-300 transform active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        Đăng Nhập
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </form>

                <div className="mt-10 pt-8 border-t border-white/10 relative">
                    <p className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#060c23] px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest rounded-full border border-white/5">
                        Đăng nhập nhanh
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        {usersList.slice(0, 4).map(u => (
                            <button 
                                key={u.id} 
                                onClick={() => {
                                    setPromptUser(u);
                                    setPromptPassword('');
                                    setShowPromptPassword(false);
                                    setError('');
                                }} 
                                className="group flex items-center justify-center gap-2 text-xs font-bold p-3.5 bg-white/5 border border-white/5 rounded-2xl text-slate-300 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                            >
                                <ShieldAlert size={16} className="text-indigo-400 group-hover:scale-110 transition-transform" /> {u.role}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {promptUser && (
                <div className="fixed inset-0 bg-[#020617]/80 backdrop-blur-xl z-[1000] flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-2xl p-8 w-full max-w-sm animate-in zoom-in-95 duration-300">
                        <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mb-6 mx-auto">
                            <ShieldAlert size={32} className="text-indigo-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2 text-center">Đăng nhập {promptUser.role}</h3>
                        <p className="text-sm text-slate-400 mb-8 text-center">Tài khoản: <span className="font-bold text-indigo-300">{promptUser.username}</span></p>
                        
                        <div className="relative mb-6">
                            <input 
                                type={showPromptPassword ? "text" : "password"}
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
                                className={`w-full p-4 pr-12 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 font-bold text-lg text-white text-center placeholder:text-slate-600 placeholder:font-normal placeholder:text-base placeholder:tracking-normal transition-all ${!showPromptPassword && promptPassword ? 'tracking-[0.3em]' : ''}`}
                                placeholder="Mật khẩu..."
                            />
                            <button
                                type="button"
                                onClick={() => setShowPromptPassword(!showPromptPassword)}
                                className="absolute right-4 top-4 text-slate-500 hover:text-indigo-400 transition-colors"
                            >
                                {showPromptPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                        
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setPromptUser(null)}
                                className="flex-1 py-3.5 rounded-2xl font-bold text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
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
                                className="flex-1 py-3.5 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 transition-all"
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
