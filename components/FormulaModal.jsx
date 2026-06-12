'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Calculator, RotateCcw, Edit2, Info } from 'lucide-react';

const DEFAULT_FORMULAS = [
    {
        id: 'totalContractAndPlhd',
        name: 'Tổng HĐ & PLHĐ (Trước Thuế)',
        formula: 'Hợp đồng + Công nợ cần thu + Các PLHĐ phát sinh',
        description: 'Tổng giá trị hợp đồng gốc trước thuế cộng với công nợ cần thu và tổng giá trị của các phụ lục hợp đồng.'
    },
    {
        id: 'debtToCollect',
        name: 'Công nợ cần thu',
        formula: 'Giá trị phải thu dự kiến (HSTT) - Giá trị thực tế đã nhận (bao gồm cấn trừ)',
        description: 'Khoản tiền khách hàng chưa thanh toán cho các đợt thanh toán đã đến kỳ hoặc đã lập hồ sơ thanh toán.'
    },
    {
        id: 'totalExpense',
        name: 'Tổng chi phí',
        formula: 'Chi phí thực tế + Chi phí còn lại (Dự trù)',
        description: 'Tổng tất cả chi phí đã chi ra cho công trình (vật tư, nhân công...) cộng với khoản chi phí còn lại dự kiến cần chi thêm.'
    },
    {
        id: 'totalPhaseReceived',
        name: 'Thực nhận đã thu',
        formula: 'Tổng (Thực nhận đợt i + Cấn trừ đợt i) (Không gồm đợt Tạm ứng)',
        description: 'Tổng số tiền thực tế đã thu được từ các đợt thanh toán (bao gồm cả tiền mặt/chuyển khoản và tiền cấn trừ), ngoại trừ đợt Tạm ứng.'
    },
    {
        id: 'totalUnreceivedPhase',
        name: 'Thực nhận các đợt chưa thu',
        formula: 'Tổng Giá trị phải thu dự kiến (HSTT) - Tổng (Thực nhận đợt i + Cấn trừ đợt i) (Không gồm đợt Tạm ứng)',
        description: 'Tổng số tiền còn lại chưa thu được của các đợt thanh toán so với dự kiến.'
    },
    {
        id: 'receivedPhaseBeforeVat',
        name: 'TN đã thu trước VAT',
        formula: 'Thực nhận đã thu / 1.08',
        description: 'Tổng giá trị thực nhận các đợt (đã thu) sau khi quy đổi về giá trị trước thuế VAT.'
    },
    {
        id: 'unreceivedPhaseBeforeVat',
        name: 'TN chưa thu trước VAT',
        formula: 'Thực nhận các đợt chưa thu / 1.08',
        description: 'Tổng giá trị thực nhận các đợt chưa thu sau khi quy đổi về giá trị trước thuế VAT.'
    },
    {
        id: 'totalReceivedBeforeVat',
        name: 'TN đã thu trước VAT (có T.Ư)',
        formula: 'TM (có T.Ư) / 1.08',
        description: 'Tổng giá trị thực nhận (gồm Tạm ứng) sau khi quy đổi về giá trị trước thuế VAT (chia cho hệ số 1.08).'
    },
    {
        id: 'totalAllBeforeVat',
        name: 'TN trước VAT (có T.Ư)',
        formula: '(Thực nhận các đợt chưa thu + Thực nhận các đợt đã thu + Tạm ứng) / 1.08',
        description: 'Tổng toàn bộ giá trị (bao gồm cả chưa thu, đã thu và tạm ứng) quy đổi về trước VAT (chia cho hệ số 1.08).'
    },
    {
        id: 'totalReceivedAmount',
        name: 'TN đã thu (có T.Ư)',
        formula: 'Thực nhận đã thu + (Thực nhận Tạm ứng hoặc Giá trị Tạm ứng kế hoạch)',
        description: 'Tổng toàn bộ số tiền đã thực tế nhận từ công trình. Nếu đợt Tạm ứng đã có phiếu thu thực tế thì lấy theo thực tế, ngược lại lấy theo giá trị tạm ứng kế hoạch.'
    },
    {
        id: 'uncollectedProfit',
        name: 'Lợi nhuận chưa thu',
        formula: 'TN đã thu trước VAT (có T.Ư) - Tổng chi phí',
        description: 'Số tiền chênh lệch còn lại tính đến thời điểm hiện tại, sau khi lấy phần thực nhận đã thu (quy trước thuế) trừ đi toàn bộ tổng chi phí đầu tư.'
    },
    {
        id: 'profit',
        name: 'Lợi nhuận',
        formula: 'TN trước VAT (có T.Ư) - Tổng chi phí',
        description: 'Lợi nhuận dự kiến của công trình sau khi lấy tổng toàn bộ thực nhận (cả chưa thu và đã thu) quy trước thuế trừ đi tổng chi phí đầu tư.'
    },
    {
        id: 'totalActualIncome',
        name: 'Tổng sản lượng',
        formula: 'Tổng giá trị sản lượng của tất cả các đợt',
        description: 'Tổng khối lượng công việc hoàn thành đã được nghiệm thu quy đổi ra giá trị tiền tệ của tất cả các đợt.'
    }
];

export default function FormulaModal({ isOpen, onClose, systemConfig, onSaveConfig, isAdmin }) {
    const [formulas, setFormulas] = useState([]);

    useEffect(() => {
        if (systemConfig?.formulas && Array.isArray(systemConfig.formulas) && systemConfig.formulas.length > 0) {
            const merged = DEFAULT_FORMULAS.map(def => {
                const saved = systemConfig.formulas.find(f => f.id === def.id);
                if (saved) {
                    return {
                        ...def,
                        name: (saved.name === 'Tổng G.Trị Thực nhận') ? def.name : (saved.name || def.name),
                        formula: saved.formula || def.formula,
                        description: saved.description || def.description
                    };
                }
                return def;
            });
            setFormulas(merged);
        } else {
            setFormulas(DEFAULT_FORMULAS);
        }
    }, [systemConfig, isOpen]);

    if (!isOpen) return null;

    const handleFieldChange = (id, field, value) => {
        setFormulas(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
    };

    const handleReset = () => {
        if (window.confirm('Bạn có chắc chắn muốn khôi phục toàn bộ công thức về mặc định?')) {
            setFormulas(DEFAULT_FORMULAS);
        }
    };

    const handleSave = () => {
        const updatedConfig = {
            ...(systemConfig || {}),
            formulas: formulas
        };
        onSaveConfig(updatedConfig);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-slate-900 p-5 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3 text-white">
                        <div className="bg-blue-600 p-2.5 rounded-xl">
                            <Calculator size={22} className="text-white animate-pulse" />
                        </div>
                        <div>
                            <h2 className="font-black text-lg tracking-tight uppercase">Diễn giải công thức phần mềm</h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {isAdmin ? 'Bạn đang ở chế độ Quản trị viên - Có thể thay đổi công thức.' : 'Chế độ xem - Chỉ Admin mới có thể chỉnh sửa.'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition bg-slate-800/50 hover:bg-slate-800 p-2 rounded-lg">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5 bg-slate-50">
                    {isAdmin && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-start gap-3 text-blue-800 text-xs font-semibold shadow-sm">
                            <Info size={16} className="shrink-0 mt-0.5" />
                            <div>
                                <p>Hướng dẫn dành cho Admin:</p>
                                <ul className="list-disc pl-4 mt-1 space-y-1 font-medium text-blue-700">
                                    <li>Thay đổi các ô "Công thức" hoặc "Diễn giải" bên dưới để cập nhật giải thích.</li>
                                    <li>Nhấp vào nút "Khôi phục mặc định" để đặt lại cài đặt gốc nếu cần.</li>
                                    <li>Nhấp "Lưu thay đổi" để áp dụng cho toàn bộ phần mềm.</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        {formulas.map((f) => (
                            <div key={f.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-2.5">
                                    <h4 className="font-extrabold text-slate-900 text-sm md:text-base flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                                        {f.name}
                                    </h4>
                                    <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2.5 py-1 rounded-md tracking-wider uppercase">
                                        {f.id}
                                    </span>
                                </div>

                                {isAdmin ? (
                                    <div className="space-y-3 mt-3">
                                        <div>
                                            <label className="block text-[10px] uppercase font-black text-slate-400 tracking-wider mb-1">Công thức toán học</label>
                                            <input
                                                type="text"
                                                value={f.formula}
                                                onChange={(e) => handleFieldChange(f.id, 'formula', e.target.value)}
                                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition"
                                                placeholder="Ví dụ: A + B"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] uppercase font-black text-slate-400 tracking-wider mb-1">Diễn giải ý nghĩa</label>
                                            <textarea
                                                rows="2"
                                                value={f.description}
                                                onChange={(e) => handleFieldChange(f.id, 'description', e.target.value)}
                                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 outline-none focus:border-blue-500 focus:bg-white transition"
                                                placeholder="Nhập diễn giải..."
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2.5">
                                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center">
                                            <code className="text-blue-700 font-mono font-bold text-xs md:text-sm whitespace-pre-wrap break-all">
                                                {f.formula}
                                            </code>
                                        </div>
                                        <p className="text-xs md:text-sm text-slate-600 font-medium leading-relaxed">
                                            {f.description}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-5 bg-white border-t border-slate-100 flex gap-3 shrink-0">
                    {isAdmin && (
                        <button
                            onClick={handleReset}
                            className="px-4 py-2.5 rounded-xl font-bold text-red-600 bg-red-50 hover:bg-red-100 transition flex items-center gap-2 text-sm shadow-sm"
                            title="Đặt lại cài đặt mặc định"
                        >
                            <RotateCcw size={16} />
                            <span className="hidden sm:inline">Khôi phục mặc định</span>
                        </button>
                    )}
                    <div className="flex-1"></div>
                    <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition text-sm">
                        Đóng
                    </button>
                    {isAdmin && (
                        <button onClick={handleSave} className="px-5 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/30 flex items-center gap-2 transition text-sm">
                            <Save size={18} /> Lưu thay đổi
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
