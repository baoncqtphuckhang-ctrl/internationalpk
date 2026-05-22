'use client';
/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

import React, { useState, useEffect } from 'react';
import { Save, Trash2, AlertCircle } from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';
import { formatCurrency, parseVietnameseNumber } from '@/lib/utils';

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

    const [errors, setErrors] = useState({});
    const [confirmSave, setConfirmSave] = useState(false);
    const [pendingSubmit, setPendingSubmit] = useState(null);

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
            setErrors({});
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

    // Xóa lỗi khi user bắt đầu nhập
    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => { const e = { ...prev }; delete e[field]; return e; });
        }
    };

    const validate = () => {
        const newErrors = {};
        if (!formData.project_name) newErrors.project_name = 'Vui lòng chọn công trình';
        if (!formData.accounting_date) newErrors.accounting_date = 'Vui lòng nhập ngày hạch toán';

        if (type === 'EXPENSE') {
            if (!formData.code?.trim()) newErrors.code = 'Vui lòng nhập mã chi phí';
            if (!formData.debit || formData.debit <= 0) newErrors.debit = 'Số tiền chi phải lớn hơn 0';
            if (!formData.note?.trim()) newErrors.note = 'Vui lòng nhập nội dung / diễn giải';
        } else {
            if (!formData.phase?.trim()) newErrors.phase = 'Vui lòng nhập đợt thu';
            if (!formData.amount || formData.amount <= 0) newErrors.amount = 'Số tiền thu phải lớn hơn 0';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!validate()) return;

        // Hiện confirm trước khi lưu
        const action = editData ? 'cập nhật' : 'thêm mới';
        setPendingSubmit({ type, formData, editId: editData?.id });
        setConfirmSave(true);
    };

    const doSubmit = () => {
        if (!pendingSubmit) return;
        setConfirmSave(false);
        onSubmit(pendingSubmit.type, pendingSubmit.formData, pendingSubmit.editId);
        setPendingSubmit(null);

        if (!editData) {
            setFormData(prev => ({
                ...prev,
                invoice_no: '',
                debit: 0,
                credit: 0,
                note: '',
                amount: 0
            }));
        }
    };

    const inputCls = (field) =>
        `w-full p-3 border rounded-xl outline-none focus:ring-2 transition ${
            errors[field]
                ? 'border-red-400 focus:ring-red-100 bg-red-50'
                : 'border-slate-300 focus:ring-blue-100 focus:border-blue-400'
        }`;

    const labelCls = 'block text-sm font-bold text-slate-700 mb-1';
    const errorMsg = (field) => errors[field] ? (
        <span className="flex items-center gap-1 text-red-500 text-xs mt-1 font-medium">
            <AlertCircle size={12} /> {errors[field]}
        </span>
    ) : null;

    return (
        <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
            <ConfirmModal
                isOpen={confirmSave}
                title={editData ? 'Xác nhận cập nhật' : 'Xác nhận lưu dữ liệu'}
                message={editData
                    ? `Bạn có chắc chắn muốn cập nhật dữ liệu này không?`
                    : `Bạn có chắc chắn muốn lưu dữ liệu ${type === 'EXPENSE' ? 'chi phí' : 'doanh thu'} mới này không?`
                }
                onConfirm={doSubmit}
                onCancel={() => setConfirmSave(false)}
                type={editData ? 'warning' : 'info'}
            />

            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                <div className="flex border-b">
                    <button
                        type="button"
                        onClick={() => { setType('EXPENSE'); setErrors({}); }}
                        className={`flex-1 py-4 font-bold text-center transition ${type === 'EXPENSE' ? 'bg-blue-600 text-white' : 'hover:bg-slate-50 text-slate-500'}`}
                    >
                        CHI PHÍ (PHIẾU CHI)
                    </button>
                    <button
                        type="button"
                        onClick={() => { setType('INCOME'); setErrors({}); }}
                        className={`flex-1 py-4 font-bold text-center transition ${type === 'INCOME' ? 'bg-green-600 text-white' : 'hover:bg-slate-50 text-slate-500'}`}
                    >
                        DOANH THU (THU TIỀN)
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6" noValidate>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Công trình */}
                        <div>
                            <label className={labelCls}>
                                Công trình <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.project_name}
                                onChange={(e) => handleChange('project_name', e.target.value)}
                                className={inputCls('project_name')}
                            >
                                {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                            </select>
                            {errorMsg('project_name')}
                        </div>

                        {/* Ngày hạch toán */}
                        <div>
                            <label className={labelCls}>
                                Ngày hạch toán <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={formData.accounting_date}
                                onChange={(e) => handleChange('accounting_date', e.target.value)}
                                className={inputCls('accounting_date')}
                            />
                            {errorMsg('accounting_date')}
                        </div>

                        {type === 'EXPENSE' ? (
                            <>
                                {/* Mã CP */}
                                <div>
                                    <label className={labelCls}>
                                        Mã CP <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.code}
                                        onChange={(e) => handleChange('code', e.target.value.replace(',', '.'))}
                                        placeholder="Ví dụ: 621, 622..."
                                        className={inputCls('code')}
                                    />
                                    {errorMsg('code')}
                                </div>
                                {/* Số tiền chi */}
                                <div>
                                    <label className={labelCls}>
                                        Số tiền chi (Nợ) <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.debit ? formatCurrency(formData.debit) : ''}
                                        onChange={(e) => handleChange('debit', parseVietnameseNumber(e.target.value))}
                                        placeholder="Nhập số tiền..."
                                        className={`${inputCls('debit')} font-bold text-red-600`}
                                    />
                                    {errorMsg('debit')}
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Đợt thu */}
                                <div>
                                    <label className={labelCls}>
                                        Đợt thu (Giai đoạn) <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.phase}
                                        onChange={(e) => handleChange('phase', e.target.value)}
                                        className={inputCls('phase')}
                                    />
                                    {errorMsg('phase')}
                                </div>
                                {/* Số tiền thu */}
                                <div>
                                    <label className={labelCls}>
                                        Số tiền thu <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.amount ? formatCurrency(formData.amount) : ''}
                                        onChange={(e) => handleChange('amount', parseVietnameseNumber(e.target.value))}
                                        placeholder="Nhập số tiền..."
                                        className={`${inputCls('amount')} font-bold text-green-600`}
                                    />
                                    {errorMsg('amount')}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Người thụ hưởng */}
                    <div>
                        <label className={labelCls}>Người thụ hưởng</label>
                        <input
                            type="text"
                            value={formData.recipient}
                            onChange={(e) => handleChange('recipient', e.target.value)}
                            placeholder="Nhập tên người nhận/nhà cung cấp..."
                            className={inputCls('recipient')}
                        />
                    </div>

                    {/* Nội dung / Diễn giải */}
                    <div>
                        <label className={labelCls}>
                            Nội dung / Diễn giải
                            {type === 'EXPENSE' && <span className="text-red-500"> *</span>}
                        </label>
                        <textarea
                            value={formData.note}
                            onChange={(e) => handleChange('note', e.target.value)}
                            rows="3"
                            className={inputCls('note')}
                            placeholder="Nhập chi tiết nội dung..."
                        />
                        {errorMsg('note')}
                    </div>

                    {/* Hiển thị số lỗi nếu có */}
                    {Object.keys(errors).length > 0 && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">
                            <AlertCircle size={16} className="flex-shrink-0" />
                            Vui lòng điền đầy đủ các trường bắt buộc (<span className="text-red-500">*</span>) trước khi lưu.
                        </div>
                    )}

                    <div className="flex gap-4">
                        {onCancel ? (
                            <button
                                type="button"
                                onClick={onCancel}
                                className="px-6 py-4 rounded-xl font-bold text-red-500 hover:bg-red-50 hover:text-red-700 border border-red-200 transition flex items-center justify-center gap-2"
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
                                        setErrors({});
                                    }
                                }}
                                className="px-6 py-4 rounded-xl font-bold text-red-500 hover:bg-red-50 hover:text-red-700 border border-red-200 transition flex items-center justify-center gap-2"
                            >
                                <Trash2 size={20} /> XÓA NHẬP LIỆU
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`flex-1 py-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition transform active:scale-95 ${
                                type === 'EXPENSE' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'
                            } disabled:opacity-60 disabled:cursor-not-allowed`}
                        >
                            {isLoading
                                ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                                : <>
                                    <Save size={20} />
                                    {editData ? 'CẬP NHẬT DỮ LIỆU' : 'LƯU DỮ LIỆU VÀO DATABASE'}
                                  </>
                            }
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
