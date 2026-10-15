'use client';

import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('[ErrorBoundary caught error]:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }
            return (
                <div className="p-6 bg-rose-50 border border-rose-200 rounded-3xl text-center space-y-4 my-4 max-w-lg mx-auto shadow-sm">
                    <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
                        <AlertCircle size={28} />
                    </div>
                    <div>
                        <h4 className="text-rose-800 font-black text-base">{this.props.title || 'Không thể hiển thị phiếu này'}</h4>
                        <p className="text-xs text-rose-600 mt-1">Dữ liệu có trường không tương thích hoặc bị lỗi định dạng.</p>
                        {this.state.error?.message && (
                            <p className="text-[11px] text-rose-400 font-mono mt-2 bg-white/80 p-2 rounded-xl border border-rose-100 break-all">
                                {this.state.error.message}
                            </p>
                        )}
                    </div>
                    <div className="flex justify-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                this.setState({ hasError: false, error: null });
                                if (this.props.onReset) this.props.onReset();
                            }}
                            className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition flex items-center gap-1.5 shadow-md shadow-rose-600/20"
                        >
                            <RotateCcw size={14} /> {this.props.resetText || 'Đóng & Thử lại'}
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
