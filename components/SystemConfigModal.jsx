'use client';

import React, { useState } from 'react';
import { Settings, X, Save, Lock, Unlock } from 'lucide-react';

export default function SystemConfigModal({ isOpen, onClose, currentConfig, onSave }) {
    const [config, setConfig] = useState(currentConfig || {
        input_data: false,
        edit_transaction: false,
        create_dntt: false,
        approve_dntt: false,
        material_orders: false
    });

    if (!isOpen) return null;

    const toggleFeature = (key) => {
        setConfig({ ...config, [key]: !config[key] });
    };

    const features = [
        { key: 'input_data', label: 'Thêm mới Thu/Chi (Nhập liệu)', desc: 'Khóa chức năng nhập dữ liệu vào lịch sử.' },
        { key: 'edit_transaction', label: 'Sửa/Xóa Giao dịch (Lịch sử chi tiền)', desc: 'Khóa chức năng chỉnh sửa và xóa giao dịch.' },
        { key: 'create_dntt', label: 'Lập Đề nghị thanh toán (DNTT)', desc: 'Khóa khả năng tạo mới các DNTT.' },
        { key: 'approve_dntt', label: 'Phê duyệt Đề nghị thanh toán', desc: 'Khóa khả năng Kế toán trưởng & Giám đốc phê duyệt.' },
        { key: 'material_orders', label: 'Đặt Vật Tư', desc: 'Khóa chức năng quản lý đặt vật tư.' }
    ];

    const handleSave = () => {
        onSave(config);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="bg-slate-900 p-5 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3 text-white">
                        <div className="bg-slate-800 p-2 rounded-lg">
                            <Settings size={20} className="text-blue-400" />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg">Khóa chức năng hệ thống</h2>
                            <p className="text-xs text-slate-400">Bật công tắc để khóa tính năng với toàn bộ user.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition bg-slate-800/50 hover:bg-slate-800 p-2 rounded-lg">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4 bg-slate-50">
                    {features.map(f => (
                        <div key={f.key} className={`p-4 rounded-xl border transition-all duration-300 flex items-center justify-between gap-4 cursor-pointer hover:shadow-md ${config[f.key] ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`} onClick={() => toggleFeature(f.key)}>
                            <div className="flex items-start gap-3">
                                <div className={`mt-0.5 ${config[f.key] ? 'text-red-500' : 'text-slate-400'}`}>
                                    {config[f.key] ? <Lock size={20} /> : <Unlock size={20} />}
                                </div>
                                <div>
                                    <p className={`font-bold ${config[f.key] ? 'text-red-700' : 'text-slate-700'}`}>{f.label}</p>
                                    <p className="text-xs text-slate-500 mt-1">{f.desc}</p>
                                </div>
                            </div>
                            <div className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-slate-600 focus:ring-offset-2 ${config[f.key] ? 'bg-red-500' : 'bg-slate-300'}`}>
                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${config[f.key] ? 'translate-x-5' : 'translate-x-0'}`} />
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-5 bg-white border-t border-slate-100 flex gap-3 shrink-0">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition">Hủy bỏ</button>
                    <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/30 flex justify-center items-center gap-2 transition">
                        <Save size={18} /> Lưu Cấu Hình
                    </button>
                </div>
            </div>
        </div>
    );
}
