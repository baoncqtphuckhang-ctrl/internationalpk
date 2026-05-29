'use client';
/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

import React, { useState, useEffect } from 'react';
import { Save, Trash2, AlertCircle } from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';
import { formatCurrency, parseVietnameseNumber, EXPENSE_CATEGORIES } from '@/lib/utils';

export default function InputForm({ projects, onSubmit, onAddDebt, isLoading, editData, incomes = [], onCancel, currentUser }) {
    const [type, setType] = useState('EXPENSE'); // EXPENSE hoặc INCOME
    const [isCustomCode, setIsCustomCode] = useState(false);
    const [isCustomAccount, setIsCustomAccount] = useState(false);
    const [formData, setFormData] = useState({
        project_name: projects[0]?.name || '',
        accounting_date: new Date().toISOString().split('T')[0],
        invoice_no: '',
        invoice_date: '',
        corresponding_account: '',
        code: '',
        debit: 0,
        credit: 0,
        note: '',
        recipient: '',
        phase: 'Đợt 1',
        amount: 0,
        vat_rate: 8,
        vat_amount: 0,
        post_tax_amount: 0,
        amount6418: 0,
        amount6418: 0,
        actual_received_amount: 0,
        creator: ''
    });

    const [errors, setErrors] = useState({});
    const [confirmSave, setConfirmSave] = useState(false);
    const [pendingSubmit, setPendingSubmit] = useState(null);
    const [debtConfirmModal, setDebtConfirmModal] = useState({ 
        isOpen: false, 
        data: null, 
        thuStatus: 'CHƯA XONG', 
        thanhToanStatus: 'CHƯA XONG' 
    });

    useEffect(() => {
        if (editData) {
            setType(editData.type || 'EXPENSE');
            setFormData({
                project_name: editData.project_name || projects[0]?.name || '',
                accounting_date: editData.accounting_date || editData.date || new Date().toISOString().split('T')[0],
                invoice_no: editData.invoice_no || '',
                invoice_date: editData.invoice_date || '',
                corresponding_account: editData.corresponding_account || '',
                code: editData.code || '',
                debit: editData.debit || 0,
                credit: editData.credit || 0,
                recipient: editData.recipient || '',
                phase: editData.phase || 'Đợt 1',
                amount: editData.amount || 0,
                vat_rate: editData.vat_rate || 8,
                vat_amount: editData.vat_amount || 0,
                post_tax_amount: editData.post_tax_amount || 0,
                amount6418: editData.amount6418 || 0,
                creator: editData.created_by || '',
                note: (() => {
                    if (editData.type === 'INCOME' && editData.note) {
                        try {
                            const p = JSON.parse(editData.note);
                            return p.text || '';
                        } catch(e) { return editData.note; }
                    }
                    return editData.note || '';
                })(),
                actual_received_amount: (() => {
                    if (editData.note) {
                        try {
                            const parsed = JSON.parse(editData.note);
                            if (parsed && typeof parsed === 'object' && 'actual_received_amount' in parsed) {
                                return parsed.actual_received_amount;
                            }
                        } catch(e) {}
                    }
                    return 0;
                })()
            });
            setIsCustomCode(editData.code && !EXPENSE_CATEGORIES.find(c => c.code === editData.code));
            
            const commonAccounts = ["", "111 - Tiền mặt", "112 - Tiền gửi NH", "131 - Công nợ phải thu", "141 - Tạm ứng", "152 - Nguyên liệu, vật liệu", "154 - Chi phí SXKD dở dang", "331 - Phải trả người bán", "334 - Phải trả người lao động", "338 - Phải trả khác", "642 - Chi phí QLDN"];
            setIsCustomAccount(editData.corresponding_account && !commonAccounts.includes(editData.corresponding_account));
            
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
            const hasDebit = formData.debit > 0;
            const hasAmount6418 = formData.amount6418 > 0;
            if (!hasDebit && !hasAmount6418) {
                newErrors.debit = 'Vui lòng nhập Số tiền chi hoặc Số tiền thu';
                newErrors.amount6418 = 'Vui lòng nhập Số tiền chi hoặc Số tiền thu';
            }
            if (!formData.note?.trim()) newErrors.note = 'Vui lòng nhập nội dung / diễn giải';
            if (!formData.recipient?.trim()) newErrors.recipient = 'Vui lòng nhập đối tượng';
        } else {
            if (!formData.phase?.trim()) newErrors.phase = 'Vui lòng nhập đợt thu';
            if (!formData.amount || formData.amount <= 0) newErrors.amount = 'Số tiền thu phải lớn hơn 0';
            if (!formData.actual_received_amount || formData.actual_received_amount <= 0) newErrors.actual_received_amount = 'Vui lòng nhập giá trị thực nhận';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!validate()) return;

        if (type === 'EXPENSE') {
            const isBothCode = ['6413', '6418'].includes(formData.code);
            const isDebtAccount = ['131', '141', '331'].some(acc => formData.corresponding_account?.startsWith(acc));
            const isBoth = isBothCode || isDebtAccount;
            const isPayOnly = ['621', '623'].includes(formData.code);
            
            if ((isBoth || isPayOnly) && parseFloat(formData.debit) > 0) {
                setDebtConfirmModal({ 
                    isOpen: true, 
                    data: formData,
                    thuStatus: isBoth ? 'CHƯA XONG' : null,
                    thanhToanStatus: 'CHƯA XONG',
                    mode: isBoth ? 'BOTH' : 'PAY_ONLY'
                });
                return;
            }
        }

        // Hiện confirm trước khi lưu
        const action = editData ? 'cập nhật' : 'thêm mới';
        setPendingSubmit({ type, formData, editId: editData?.id });
        setConfirmSave(true);
    };

    const handleDebtConfirm = () => {
        const data = debtConfirmModal.data;
        const { thuStatus, thanhToanStatus, mode } = debtConfirmModal;
        
        setDebtConfirmModal({ isOpen: false, data: null, thuStatus: 'CHƯA XONG', thanhToanStatus: 'CHƯA XONG' });
        
        // 1. Submit normal transaction
        onSubmit('EXPENSE', data, editData?.id);
        
        // 2 & 3. Submit debts
        if (onAddDebt) {
            const debts = [];
            if (mode === 'BOTH') {
                let partnerName = data.recipient || 'Đối tác/Nhà cung cấp';
                let debtNote = `Thu lại - ${data.note || ''}`;
                if (data.code === '6418') debtNote = `Thu lại (Bảo hiểm) - ${data.note || ''}`;
                else if (data.code === '6413') debtNote = `Thu lại (Hồ sơ) - ${data.note || ''}`;

                debts.push({
                    project_name: data.project_name,
                    partner_name: partnerName,
                    debt_type: 'CẦN THU',
                    amount: parseFloat(data.debit) || parseFloat(data.amount) || 0,
                    status: thuStatus,
                    note: debtNote
                });
            }
            
            debts.push({
                project_name: data.project_name,
                partner_name: data.recipient || 'Đối tác/Nhà cung cấp',
                debt_type: 'CẦN TRẢ',
                amount: parseFloat(data.debit) || parseFloat(data.amount) || 0,
                status: thanhToanStatus,
                note: `Thanh toán chi phí - ${data.note || ''}`
            });
            onAddDebt(debts);
        }
        
        resetForm();
    };

    const resetForm = () => {
        setFormData(prev => ({
            ...prev,
            invoice_no: '',
            debit: 0,
            credit: 0,
            note: '',
            amount: 0,
            vat_rate: 8,
            vat_amount: 0,
            post_tax_amount: 0,
            amount6418: 0,
            actual_received_amount: 0
        }));
        setIsCustomCode(false);
    };

    const doSubmit = () => {
        if (!pendingSubmit) return;
        setConfirmSave(false);
        onSubmit(pendingSubmit.type, pendingSubmit.formData, pendingSubmit.editId);
        setPendingSubmit(null);

        if (!editData) resetForm();
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

            {debtConfirmModal.isOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 border border-slate-100">
                        <div className="p-8">
                            <div className="flex items-center gap-3 text-amber-500 mb-6">
                                <div className="p-3 bg-amber-50 rounded-2xl">
                                    <AlertCircle size={28} />
                                </div>
                                <h3 className="text-xl font-black text-slate-800">Xác nhận Công Nợ</h3>
                            </div>
                            
                            <p className="text-slate-600 mb-8 font-medium leading-relaxed">
                                Chi phí này có mã <b>{debtConfirmModal.data?.code}</b>. Vui lòng xác nhận trạng thái để hệ thống tự động ghi nhận vào sổ công nợ.
                            </p>
                            
                            <div className="space-y-6">
                                {/* Khối Thu từ tổ đội */}
                                {debtConfirmModal.mode === 'BOTH' && (
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                        <p className="font-bold text-slate-800 mb-3 text-sm">1. Đã thu lại tiền từ tổ đội/công nhân chưa?</p>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => setDebtConfirmModal(prev => ({...prev, thuStatus: 'ĐÃ XONG'}))}
                                                className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all border-2 ${
                                                    debtConfirmModal.thuStatus === 'ĐÃ XONG' 
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-500 shadow-sm' 
                                                        : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/50'
                                                }`}
                                            >
                                                ĐÃ THU
                                            </button>
                                            <button
                                                onClick={() => setDebtConfirmModal(prev => ({...prev, thuStatus: 'CHƯA XONG'}))}
                                                className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all border-2 ${
                                                    debtConfirmModal.thuStatus === 'CHƯA XONG' 
                                                        ? 'bg-amber-50 text-amber-600 border-amber-400 shadow-sm' 
                                                        : 'bg-white text-slate-500 border-slate-200 hover:border-amber-200 hover:bg-amber-50/50'
                                                }`}
                                            >
                                                CHƯA THU
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Khối Thanh toán */}
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                    <p className="font-bold text-slate-800 mb-3 text-sm">{debtConfirmModal.mode === 'BOTH' ? '2. ' : ''}Đã thanh toán chi phí này chưa?</p>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setDebtConfirmModal(prev => ({...prev, thanhToanStatus: 'ĐÃ XONG'}))}
                                            className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all border-2 ${
                                                debtConfirmModal.thanhToanStatus === 'ĐÃ XONG' 
                                                    ? 'bg-blue-50 text-blue-700 border-blue-500 shadow-sm' 
                                                    : 'bg-white text-slate-500 border-slate-200 hover:border-blue-200 hover:bg-blue-50/50'
                                            }`}
                                        >
                                            ĐÃ THANH TOÁN
                                        </button>
                                        <button
                                            onClick={() => setDebtConfirmModal(prev => ({...prev, thanhToanStatus: 'CHƯA XONG'}))}
                                            className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all border-2 ${
                                                debtConfirmModal.thanhToanStatus === 'CHƯA XONG' 
                                                    ? 'bg-amber-50 text-amber-600 border-amber-400 shadow-sm' 
                                                    : 'bg-white text-slate-500 border-slate-200 hover:border-amber-200 hover:bg-amber-50/50'
                                            }`}
                                        >
                                            CHƯA THANH TOÁN
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 mt-8">
                                <button
                                    onClick={handleDebtConfirm}
                                    className="w-full py-4 bg-indigo-600 text-white hover:bg-indigo-700 font-bold rounded-2xl transition shadow-lg shadow-indigo-600/20"
                                >
                                    LƯU DỮ LIỆU & CHUYỂN TỚI CÔNG NỢ
                                </button>
                                <button
                                    onClick={() => setDebtConfirmModal({ isOpen: false, data: null, thuStatus: 'CHƯA XONG', thanhToanStatus: 'CHƯA XONG' })}
                                    className="w-full py-3 text-slate-500 hover:bg-slate-100 font-bold rounded-2xl transition"
                                >
                                    Hủy bỏ
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
                                    <select
                                        value={isCustomCode ? 'Khác' : formData.code}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === 'Khác') {
                                                setIsCustomCode(true);
                                                handleChange('code', '');
                                            } else {
                                                setIsCustomCode(false);
                                                handleChange('code', val);
                                            }
                                        }}
                                        className={inputCls('code')}
                                    >
                                        <option value="">-- Chọn Mã CP --</option>
                                        {EXPENSE_CATEGORIES.map(c => (
                                            <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                                        ))}
                                        <option value="Khác">Khác...</option>
                                    </select>
                                    {isCustomCode && (
                                        <input
                                            type="text"
                                            value={formData.code}
                                            onChange={(e) => handleChange('code', e.target.value.replace(',', '.'))}
                                            placeholder="Nhập mã CP khác..."
                                            className={`${inputCls('code')} mt-2`}
                                        />
                                    )}
                                    {errorMsg('code')}
                                </div>
                                {/* Số tiền chi */}
                                <div>
                                    <label className={labelCls}>
                                        Số tiền chi (Nợ)
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
                                {/* Số hóa đơn */}
                                <div>
                                    <label className={labelCls}>
                                        Số hóa đơn
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.invoice_no || ''}
                                        onChange={(e) => handleChange('invoice_no', e.target.value)}
                                        placeholder="Nhập số hóa đơn..."
                                        className={inputCls('invoice_no')}
                                    />
                                </div>
                                {/* Ngày hóa đơn */}
                                <div>
                                    <label className={labelCls}>
                                        Ngày hóa đơn
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.invoice_date || ''}
                                        onChange={(e) => handleChange('invoice_date', e.target.value)}
                                        className={inputCls('invoice_date')}
                                    />
                                </div>
                                {/* Tài khoản đối ứng */}
                                <div>
                                    <label className={labelCls}>
                                        Tài khoản đối ứng
                                    </label>
                                    <select
                                        value={isCustomAccount ? 'Khác' : (formData.corresponding_account || '')}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === 'Khác') {
                                                setIsCustomAccount(true);
                                                handleChange('corresponding_account', '');
                                            } else {
                                                setIsCustomAccount(false);
                                                handleChange('corresponding_account', val);
                                            }
                                        }}
                                        className={inputCls('corresponding_account')}
                                    >
                                        <option value="">-- Để trống --</option>
                                        <option value="111 - Tiền mặt">111 - Tiền mặt</option>
                                        <option value="112 - Tiền gửi NH">112 - Tiền gửi NH</option>
                                        <option value="131 - Công nợ phải thu">131 - Công nợ phải thu</option>
                                        <option value="141 - Tạm ứng">141 - Tạm ứng</option>
                                        <option value="152 - Nguyên liệu, vật liệu">152 - Nguyên liệu, vật liệu</option>
                                        <option value="154 - Chi phí SXKD dở dang">154 - Chi phí SXKD dở dang</option>
                                        <option value="331 - Phải trả người bán">331 - Phải trả người bán</option>
                                        <option value="334 - Phải trả người lao động">334 - Phải trả người lao động</option>
                                        <option value="338 - Phải trả khác">338 - Phải trả khác</option>
                                        <option value="642 - Chi phí QLDN">642 - Chi phí QLDN</option>
                                        <option value="Khác">Khác...</option>
                                    </select>
                                    {isCustomAccount && (
                                        <input
                                            type="text"
                                            value={formData.corresponding_account}
                                            onChange={(e) => handleChange('corresponding_account', e.target.value)}
                                            placeholder="Nhập tài khoản đối ứng khác..."
                                            className={`${inputCls('corresponding_account')} mt-2`}
                                        />
                                    )}
                                </div>
                                {/* Người lập */}
                                <div>
                                    <label className={labelCls}>
                                        Người lập
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.creator}
                                        onChange={(e) => handleChange('creator', e.target.value)}
                                        placeholder="Nhập tên người lập..."
                                        className={inputCls('creator')}
                                    />
                                </div>
                                {/* Số tiền thu */}
                                <div>
                                    <label className={labelCls}>
                                        Số tiền thu
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.amount6418 ? formatCurrency(formData.amount6418) : ''}
                                        onChange={(e) => handleChange('amount6418', parseVietnameseNumber(e.target.value))}
                                        placeholder="Nhập số tiền thu..."
                                        className={`${inputCls('amount6418')} font-bold text-amber-600`}
                                    />
                                    {errorMsg('amount6418')}
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
                                {/* Giá trị trước thuế */}
                                <div>
                                    <label className={labelCls}>
                                        Giá trị thanh toán trước thuế <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.amount ? formatCurrency(formData.amount) : ''}
                                        onChange={(e) => {
                                            const val = parseVietnameseNumber(e.target.value);
                                            const vat = Math.round(val * formData.vat_rate / 100);
                                            setFormData(prev => ({ 
                                                ...prev, 
                                                amount: val, 
                                                vat_amount: vat, 
                                                post_tax_amount: val + vat 
                                            }));
                                            if (errors.amount) {
                                                setErrors(prev => { const er = {...prev}; delete er.amount; return er; });
                                            }
                                        }}
                                        placeholder="Nhập số tiền..."
                                        className={`${inputCls('amount')} font-bold text-green-600`}
                                    />
                                    {errorMsg('amount')}
                                </div>
                                {/* Giá trị VAT */}
                                <div>
                                    <div className="flex justify-between items-end mb-1">
                                        <label className="block text-sm font-bold text-slate-700">Giá trị VAT</label>
                                        <div className="flex items-center gap-3 text-sm text-slate-600">
                                            <label className="flex items-center gap-1 cursor-pointer">
                                                <input type="radio" name="vat_rate" value="8" checked={formData.vat_rate === 8} 
                                                    onChange={() => {
                                                        const vat = Math.round(formData.amount * 8 / 100);
                                                        setFormData(prev => ({...prev, vat_rate: 8, vat_amount: vat, post_tax_amount: prev.amount + vat}));
                                                    }} 
                                                /> 8%
                                            </label>
                                            <label className="flex items-center gap-1 cursor-pointer">
                                                <input type="radio" name="vat_rate" value="10" checked={formData.vat_rate === 10} 
                                                    onChange={() => {
                                                        const vat = Math.round(formData.amount * 10 / 100);
                                                        setFormData(prev => ({...prev, vat_rate: 10, vat_amount: vat, post_tax_amount: prev.amount + vat}));
                                                    }} 
                                                /> 10%
                                            </label>
                                            <label className="flex items-center gap-1 cursor-pointer">
                                                <input type="radio" name="vat_rate" value="0" checked={formData.vat_rate === 0} 
                                                    onChange={() => {
                                                        setFormData(prev => ({...prev, vat_rate: 0, vat_amount: 0, post_tax_amount: prev.amount}));
                                                    }} 
                                                /> Khác
                                            </label>
                                        </div>
                                    </div>
                                    <input
                                        type="text"
                                        value={formData.vat_amount ? formatCurrency(formData.vat_amount) : ''}
                                        onChange={(e) => {
                                            const val = parseVietnameseNumber(e.target.value);
                                            setFormData(prev => ({ ...prev, vat_amount: val, post_tax_amount: prev.amount + val }));
                                        }}
                                        placeholder="Nhập VAT..."
                                        className={`${inputCls('vat_amount')} font-bold text-slate-600`}
                                    />
                                </div>
                                {/* Giá trị thanh toán sau thuế */}
                                <div className="md:col-span-2">
                                    <label className={labelCls}>Giá trị thanh toán sau thuế</label>
                                    <input
                                        type="text"
                                        value={formData.post_tax_amount ? formatCurrency(formData.post_tax_amount) : ''}
                                        onChange={(e) => handleChange('post_tax_amount', parseVietnameseNumber(e.target.value))}
                                        placeholder="Nhập số tiền sau thuế..."
                                        className={`${inputCls('post_tax_amount')} font-bold text-blue-600`}
                                    />
                                </div>
                                {/* Giá trị thực nhận/nhập */}
                                <div className="md:col-span-2">
                                    <label className={labelCls}>Giá trị thực nhận/nhập <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={formData.actual_received_amount ? formatCurrency(formData.actual_received_amount) : ''}
                                        onChange={(e) => handleChange('actual_received_amount', parseVietnameseNumber(e.target.value))}
                                        placeholder="Nhập giá trị thực nhận..."
                                        className={`${inputCls('actual_received_amount')} font-bold text-emerald-600`}
                                    />
                                    {errorMsg('actual_received_amount')}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Đối tượng thụ hưởng */}
                    {type === 'EXPENSE' && (
                        <div>
                            <label className={labelCls}>
                                Đối tượng thụ hưởng/đối tượng khấu trừ <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.recipient}
                                onChange={(e) => handleChange('recipient', e.target.value)}
                                placeholder="Nhập tên đối tượng..."
                                className={inputCls('recipient')}
                            />
                            {errorMsg('recipient')}
                        </div>
                    )}

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
                                            amount: 0,
                                            vat_rate: 8,
                                            vat_amount: 0,
                                            post_tax_amount: 0,
                                            amount6418: 0,
                                            actual_received_amount: 0
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
