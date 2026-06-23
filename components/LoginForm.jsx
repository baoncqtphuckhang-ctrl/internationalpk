'use client';

import React, { useState, useEffect } from 'react';
import { Building2, ShieldCheck, Lock, Star, User, ArrowRight, Eye, EyeOff, Sun, Shield } from 'lucide-react';

export default function LoginForm({ onLogin, usersList }) {
    const [form, setForm] = useState({ username: '', password: '' });
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

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

    if (!isMounted) return <div className="min-h-screen bg-[#050505]"></div>;

    return (
        <div className="min-h-screen flex relative overflow-hidden font-sans text-[#FFFFFF] bg-[#050505]">
            
            {/* FULLSCREEN BACKGROUND */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div 
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-90 mix-blend-lighten"
                    style={{ backgroundImage: 'url(/bg-hcm.jpg)' }}
                />
                {/* Gradient overlay: keep left side clear, fade to dark on right side for the login form */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#050505]/40 to-[#050505] lg:to-[#050505]" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent opacity-50" />
            </div>

            {/* TOP RIGHT TOGGLE */}
            <div className="absolute top-8 right-8 z-20">
                <button className="flex items-center gap-2.5 px-5 py-2.5 rounded-full border border-[rgba(212,175,55,0.25)] bg-[#0A0A0A]/80 backdrop-blur-md text-[#B8B8B8] hover:text-[#D4AF37] hover:border-[#D4AF37]/50 transition-all duration-300 text-[13px] font-medium shadow-[0_0_15px_rgba(212,175,55,0.05)]">
                    <Sun size={15} className="text-[#D4AF37]" /> Chế độ sáng
                </button>
            </div>

            <div className="flex-1 flex w-full max-w-[1600px] mx-auto relative z-10">
                {/* LEFT SIDE - BRANDING */}
                <div className="hidden lg:flex flex-col justify-center w-[55%] p-16 relative">
                    <div className="flex flex-col max-w-[500px]">
                        <div className="w-[80px] h-[80px] rounded-2xl border border-[rgba(212,175,55,0.4)] bg-[#050505]/40 backdrop-blur-md flex items-center justify-center shadow-[0_0_30px_rgba(212,175,55,0.2)] mb-6">
                            <Building2 size={36} strokeWidth={1.5} className="text-[#D4AF37]" />
                        </div>
                        
                        <h1 className="text-[72px] font-bold tracking-tight leading-none mb-3 drop-shadow-2xl">
                            <span className="text-[#FFFFFF]">CB</span> <span className="text-transparent bg-clip-text bg-gradient-to-b from-[#F5D27A] to-[#C6922D]">Pro</span>
                        </h1>
                        
                        <p className="text-[#B8B8B8] text-[14px] font-medium tracking-[0.4em] uppercase mb-10 drop-shadow-md">
                            Hệ Thống Quản Lý Nội Bộ
                        </p>

                        <div className="w-[120px] h-[1px] bg-gradient-to-r from-[#D4AF37]/80 to-transparent mb-10"></div>

                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-3 border border-[rgba(212,175,55,0.2)] bg-[#050505]/30 backdrop-blur-md px-5 py-2.5 rounded-full">
                                <ShieldCheck size={18} className="text-[#D4AF37]" />
                                <span className="text-[#FFFFFF] text-[13px] font-medium">Hiệu quả</span>
                            </div>
                            <div className="flex items-center gap-3 border border-[rgba(212,175,55,0.2)] bg-[#050505]/30 backdrop-blur-md px-5 py-2.5 rounded-full">
                                <Lock size={18} className="text-[#D4AF37]" />
                                <span className="text-[#FFFFFF] text-[13px] font-medium">Bảo mật</span>
                            </div>
                            <div className="flex items-center gap-3 border border-[rgba(212,175,55,0.2)] bg-[#050505]/30 backdrop-blur-md px-5 py-2.5 rounded-full">
                                <Star size={18} className="text-[#D4AF37]" />
                                <span className="text-[#FFFFFF] text-[13px] font-medium">Tối ưu</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT SIDE - LOGIN FORM */}
                <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-12 w-full lg:w-[45%]">
                    
                    <div className="w-full max-w-[460px] bg-[#0A0A0A]/90 backdrop-blur-[24px] rounded-[32px] border border-[rgba(212,175,55,0.25)] p-10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] relative animate-in zoom-in-[0.98] duration-700">
                        
                        {/* Glowing Top Edge */}
                        <div className="absolute top-0 left-[20%] right-[20%] h-[1px] bg-gradient-to-r from-transparent via-[#D4AF37]/60 to-transparent shadow-[0_0_15px_rgba(212,175,55,0.8)]"></div>

                        <div className="flex flex-col items-center mb-10 mt-2">
                            <div className="w-[72px] h-[72px] rounded-full border border-[rgba(212,175,55,0.3)] flex items-center justify-center bg-[#101010] mb-5 shadow-[0_0_20px_rgba(212,175,55,0.15)] relative">
                                <div className="absolute inset-0 rounded-full bg-[#D4AF37] opacity-10 blur-md"></div>
                                <Building2 size={30} strokeWidth={1.5} className="text-[#D4AF37] relative z-10" />
                            </div>
                            <h2 className="text-[26px] font-bold text-[#FFFFFF] mb-1 tracking-tight">Chào mừng trở lại</h2>
                            <p className="text-[14px] text-[#B8B8B8] font-normal">Đăng nhập để tiếp tục làm việc</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {error && (
                                <div className="p-3 bg-red-950/40 text-red-400 text-[13px] font-medium rounded-xl border border-red-500/30 text-center backdrop-blur-sm">
                                    {error}
                                </div>
                            )}
                            <div className="space-y-2">
                                <label className="block text-[10px] font-semibold text-[#B8B8B8] uppercase tracking-[0.15em] pl-1">Tài khoản</label>
                                <div className="relative group">
                                    <User className="absolute left-5 top-1/2 -translate-y-1/2 text-[#D4AF37] opacity-80" size={18} />
                                    <input 
                                        type="text" 
                                        value={form.username} 
                                        onChange={(e) => setForm({ ...form, username: e.target.value })} 
                                        className="w-full pl-14 pr-5 py-3.5 bg-[#050505] border border-[rgba(212,175,55,0.25)] rounded-2xl outline-none focus:border-[#D4AF37] focus:shadow-[0_0_15px_rgba(212,175,55,0.15)] transition-all font-medium text-[#FFFFFF] placeholder:text-[#B8B8B8]/40 text-[15px]" 
                                        placeholder="Nhập username..."
                                        required 
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[10px] font-semibold text-[#B8B8B8] uppercase tracking-[0.15em] pl-1">Mật khẩu</label>
                                <div className="relative group">
                                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-[#D4AF37] opacity-80" size={18} />
                                    <input 
                                        type={showPassword ? "text" : "password"} 
                                        value={form.password} 
                                        onChange={(e) => setForm({ ...form, password: e.target.value })} 
                                        className={`w-full pl-14 pr-12 py-3.5 bg-[#050505] border border-[rgba(212,175,55,0.25)] rounded-2xl outline-none focus:border-[#D4AF37] focus:shadow-[0_0_15px_rgba(212,175,55,0.15)] transition-all font-medium text-[#FFFFFF] placeholder:text-[#B8B8B8]/40 text-[15px] ${!showPassword && form.password ? 'tracking-widest' : ''}`} 
                                        placeholder="Nhập mật khẩu..."
                                        required 
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-5 top-1/2 -translate-y-1/2 text-[#B8B8B8] hover:text-[#FFFFFF] transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                            <button 
                                type="submit" 
                                className="w-full mt-2 bg-gradient-to-r from-[#C6922D] via-[#F5D27A] to-[#D4AF37] hover:brightness-110 text-[#050505] font-bold py-4 rounded-2xl shadow-[0_4px_20px_rgba(212,175,55,0.3)] transition-all flex items-center justify-center gap-2 text-[15px]"
                            >
                                Đăng nhập <ArrowRight size={18} strokeWidth={2.5} className="text-[#050505]" />
                            </button>
                        </form>

                    </div>

                    {/* ISO Footer */}
                    <div className="mt-8 flex flex-col items-center gap-1.5 opacity-60">
                        <div className="flex items-center gap-1.5 text-[#B8B8B8] text-[10px] font-medium uppercase tracking-wider">
                            <ShieldCheck size={12} className="text-[#D4AF37]" />
                            <span>ISO 27001:2022 Certified Security</span>
                        </div>
                        <p className="text-[#B8B8B8]/60 text-[10px]">
                            &copy; 2026 CB Pro Enterprise. All rights reserved.
                        </p>
                    </div>
                </div>
            </div>

        </div>
    );
}
