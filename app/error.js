'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

export default function GlobalError({ error, reset }) {
    useEffect(() => {
        console.error('Unhandled App Error caught by error boundary:', error);
    }, [error]);

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans text-slate-100">
            <div className="max-w-md w-full bg-slate-800/80 border border-slate-700 backdrop-blur-xl p-8 rounded-3xl shadow-2xl text-center">
                <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-red-500/20">
                    <AlertTriangle size={32} />
                </div>
                
                <h2 className="text-xl font-black text-white mb-2">Đã xảy ra sự cố hiển thị</h2>
                <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                    Hệ thống gặp lỗi tạm thời khi tải dữ liệu trang. Bạn có thể bấm nút bên dưới để thử tải lại giao diện mà không bị gián đoạn.
                </p>

                {error?.message && (
                    <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700/60 text-xs text-rose-300 font-mono mb-6 text-left break-words max-h-32 overflow-y-auto">
                        {error.message}
                    </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={() => reset ? reset() : window.location.reload()}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-5 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                    >
                        <RotateCcw size={16} /> Thử lại
                    </button>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold py-3 px-5 rounded-xl transition flex items-center justify-center gap-2"
                    >
                        <Home size={16} /> Về trang chủ
                    </button>
                </div>
            </div>
        </div>
    );
}
