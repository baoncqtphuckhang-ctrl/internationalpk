'use client';
/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, CheckCircle2 } from 'lucide-react';

export default function InputForm({ projects, onSubmit, isLoading, editData, incomes = [], onCancel }) {
    const [type, setType] = useState('EXPENSE'); // EXPENSE hoặc INCOME
    const [formData, setFormData] = useState({
        project_name: projects[0]?.name || '',
        accounting_date: new Date().toISOString().split('T')[0],
        invoice_no: '',
        code: '',
        debit: 0,
        credit: 0,
        note: '',
        recipient: '',
        phase: 'Đợt 1',
        amount: 0
    });

    useEffect(() => {
        if (editData) {
            setType(editData.type || 'EXPENSE');
            setFormData({
                project_name: editData.project_name || projects[0]?.name || '',
                accounting_date: editData.accounting_date || new Date().toISOString().split('T')[0],
                invoice_no: editData.invoice_no || '',
                code: editData.code || '',
                debit: editData.debit || 0,
                credit: editData.credit || 0,
                note: editData.note || '',
                recipient: editData.recipient || '',
                phase: editData.phase || 'Đợt 1',
                amount: editData.amount || 0
            });
        }
    }, [editData, projects]);

    useEffect(() => {
        if (!editData && type === 'INCOME') {
            const projIncomes = incomes.filter(i => i.project_name === formData.project_name);
            let maxPhase = 0;
            projIncomes.forEach(inc => {
                const phaseStr = inc.phase || '';
                const match = phaseStr.match(/\d+/);
                if (match) {
                    const num = parseInt(match[0], 10);
                    if (num > maxPhase) maxPhase = num;
                }
            });
            setFormData(prev => ({ ...prev, phase: `Đợt ${maxPhase + 1}` }));
        }
    }, [type, formData.project_name, incomes, editData]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(type, formData, editData?.id);
        // Reset form

        setFormData({
            ...formData,
            invoice_no: '',
            debit: 0,
            credit: 0,
            note: '',
            amount: 0
        });
    };

    return (
        <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                <div className="flex border-b">
                    <button 
                        onClick={() => setType('EXPENSE')}
                        className={`flex-1 py-4 font-bold text-center transition ${type === 'EXPENSE' ? 'bg-blue-600 text-white' : 'hover:bg-slate-50 text-slate-500'}`}
                    >
                        CHI PHÍ (PHIẾU CHI)
                    </button>
                    <button 
                        onClick={() => setType('INCOME')}
                        className={`flex-1 py-4 font-bold text-center transition ${type === 'INCOME' ? 'bg-green-600 text-white' : 'hover:bg-slate-50 text-slate-500'}`}
                    >
                        DOANH THU (THU TIỀN)
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-slate-700">Công trình</label>
                            <select 
                                value={formData.project_name}
                                onChange={(e) => setFormData({...formData, project_name: e.target.value})}
                                className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-100 border-slate-300"
                                required
                            >
                                {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-slate-700">Ngày hạch toán</label>
                            <input 
                                type="date"
                                value={formData.accounting_date}
                                onChange={(e) => setFormData({...formData, accounting_date: e.target.value})}
                                className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-100 border-slate-300"
                                required
                            />
                        </div>

                        {type === 'EXPENSE' ? (
                            <>
                                <div className="space-y-2">
                                    <label className="block text-sm font-bold text-slate-700">Mã CP</label>
                                    <input 
                                        type="text"
                                        value={formData.code}
                                        onChange={(e) => setFormData({...formData, code: e.target.value.replace(',', '.')})}
                                        placeholder="Ví dụ: 621, 622..."
                                        className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-100 border-slate-300"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-bold text-slate-700">Số tiền chi (Nợ)</label>
                                    <input 
                                        type="number"
                                        value={formData.debit === 0 ? '' : formData.debit}
                                        onChange={(e) => setFormData({...formData, debit: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                                        className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-red-100 border-slate-300 font-bold text-red-600"
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    <label className="block text-sm font-bold text-slate-700">Đợt thu (Giai đoạn)</label>
                                    <input 
                                        type="text"
                                        value={formData.phase}
                                        onChange={(e) => setFormData({...formData, phase: e.target.value})}
                                        className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-green-100 border-slate-300"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-bold text-slate-700">Số tiền thu</label>
                                    <input 
                                        type="number"
                                        value={formData.amount === 0 ? '' : formData.amount}
                                        onChange={(e) => setFormData({...formData, amount: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                                        className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-green-100 border-slate-300 font-bold text-green-600"
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-slate-700">Người thụ hưởng</label>
                        <input 
                            type="text"
                            value={formData.recipient}
                            onChange={(e) => setFormData({...formData, recipient: e.target.value})}
                            placeholder="Nhập tên người nhận/nhà cung cấp..."
                            className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-100 border-slate-300"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-slate-700">Nội dung / Diễn giải</label>
                        <textarea 
                            value={formData.note}
                            onChange={(e) => setFormData({...formData, note: e.target.value})}
                            rows="3"
                            className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-100 border-slate-300"
                            placeholder="Nhập chi tiết nội dung..."
                        ></textarea>
                    </div>

                    <div className="flex gap-4">
                        {onCancel ? (
                            <button 
                                type="button"
                                onClick={onCancel}
                                className="px-6 py-4 rounded-xl font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-700 border border-slate-200 transition flex items-center justify-center gap-2"
                            >
                                HỦY BỎ
                            </button>
                        ) : (
                            <button 
                                type="button"
                                onClick={() => {
                                    if (window.confirm('Bạn có muốn xóa trắng toàn bộ dữ liệu đang nhập để nhập lại từ đầu?')) {
                                        setFormData({
                                            project_name: projects[0]?.name || '',
                                            accounting_date: new Date().toISOString().split('T')[0],
                                            invoice_no: '',
                                            code: '',
                                            debit: 0,
                                            credit: 0,
                                            note: '',
                                            recipient: '',
                                            phase: 'Đợt 1',
                                            amount: 0
                                        });
                                    }
                                }}
                                className="px-6 py-4 rounded-xl font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-700 border border-slate-200 transition flex items-center justify-center gap-2"
                            >
                                <Trash2 size={20} /> XÓA NHẬP LIỆU
                            </button>
                        )}
                        <button 
                            type="submit"
                            disabled={isLoading}
                            className={`flex-1 py-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition transform active:scale-95 ${type === 'EXPENSE' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}
                        >
                            {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <><Save size={20} /> LƯU DỮ LIỆU VÀO DATABASE</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
