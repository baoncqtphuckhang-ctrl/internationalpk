'use client';
/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

import React, { useState, useEffect, useMemo } from 'react';
import { Save, Trash2, AlertCircle } from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';
import RecipientInput from './RecipientInput';
import { formatCurrency, parseVietnameseNumber, EXPENSE_CATEGORIES } from '@/lib/utils';

export default function InputForm({ transactions = [], projects, onSubmit, onAddDebt, isLoading, editData, incomes = [], onCancel, currentUser, onEditIncome, onDeleteIncome }) {
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
        post_tax_amount: 0,
        actual_received_amount: 0,
        deduction_amount: 0,
        creator: ''
    });

    const [errors, setErrors] = useState({});
    const [confirmSave, setConfirmSave] = useState(false);
    const [pendingSubmit, setPendingSubmit] = useState(null);
    const [thanhToanStatus, setThanhToanStatus] = useState('CHƯA XONG');
    const [debtConfirmModal, setDebtConfirmModal] = useState({ isOpen: false, data: null, mode: 'PAY_ONLY', thuStatus: 'CHƯA XONG', chiStatus: 'CHƯA XONG' });
    const [confirmReset, setConfirmReset] = useState(false);

    useEffect(() => {
        if (editData) {
            setType(editData.type || 'EXPENSE');
            setFormData({
                project_name: editData.project_name || projects[0]?.name || '',
                accounting_date: editData.accounting_date || editData.date || new Date().toISOString().split('T')[0],
                invoice_no: editData.invoice_no || '',
                invoice_date: (() => {
                    if (editData.note) {
                        try {
                            const parsed = JSON.parse(editData.note);
                            if (parsed && typeof parsed === 'object' && 'invoice_date' in parsed) {
                                return parsed.invoice_date;
                            }
                        } catch(e) {}
                    }
                    return editData.invoice_date || '';
                })(),
                corresponding_account: editData.corresponding_account || '',
                code: editData.code || '',
                debit: editData.debit || 0,
                credit: editData.credit || 0,
                recipient: editData.recipient || '',
                actual_received_amount: editData.actual_received_amount || 0,
                creator: editData.created_by || '',
                phase: editData.phase || 'Đợt 1',
                amount: editData.amount || 0,
                vat_rate: editData.vat_rate || 8,
                vat_amount: editData.vat_amount || 0,
                post_tax_amount: editData.post_tax_amount || 0,
                amount6418: editData.credit || 0,
                creator: editData.created_by || '',
                note: (() => {
                    if (editData.note) {
                        try {
                            const p = JSON.parse(editData.note);
                            if (p && typeof p === 'object' && p.text !== undefined) {
                                return p.text;
                            }
                        } catch(e) {}
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
                })(),
                deduction_amount: (() => {
                    if (editData.note) {
                        try {
                            const parsed = JSON.parse(editData.note);
                            if (parsed && typeof parsed === 'object' && 'deduction_amount' in parsed) {
                                return parsed.deduction_amount;
                            }
                        } catch(e) {}
                    }
                    return 0;
                })(),
                invoice_no: (() => {
                    if (editData.note) {
                        try {
                            const parsed = JSON.parse(editData.note);
                            if (parsed && typeof parsed === 'object' && 'invoice_no' in parsed) {
                                return parsed.invoice_no;
                            }
                        } catch(e) {}
                    }
                    return editData.invoice_no || '';
                })(),
                voucher_no: (() => {
                    if (editData.note) {
                        try {
                            const parsed = JSON.parse(editData.note);
                            if (parsed && typeof parsed === 'object' && 'voucher_no' in parsed) {
                                return parsed.voucher_no;
                            }
                        } catch(e) {}
                    }
                    return '';
                })()
            });
            setIsCustomCode(editData.code && !EXPENSE_CATEGORIES.find(c => c.code === editData.code));
            
            const commonAccounts = ["", "111 - Tiền mặt", "112 - Tiền gửi NH", "131 - Công nợ phải thu", "141 - Tạm ứng", "152 - Nguyên liệu, vật liệu", "154 - Chi phí SXKD dở dang", "331 - Phải trả người bán", "334 - Phải trả người lao động", "338 - Phải trả khác", "642 - Chi phí QLDN"];
            setIsCustomAccount(editData.corresponding_account && !commonAccounts.includes(editData.corresponding_account));
            
            setErrors({});
        }
    }, [editData, projects]);

    const availablePhases = useMemo(() => {
        const phases = new Set();
        phases.add('Tạm ứng');
        if (formData.project_name && incomes && incomes.length > 0) {
            incomes.forEach(i => {
                if (i.project_name === formData.project_name && i.phase) {
                    phases.add(i.phase);
                }
            });
        }
        
        return Array.from(phases);
    }, [formData.project_name, incomes]);

    const selectedPhaseStats = useMemo(() => {
        if (type !== 'INCOME_REAL' || !formData.project_name || !formData.phase || !incomes) return null;
        
        const phaseIncs = incomes.filter(i => i.project_name === formData.project_name && i.phase === formData.phase);
        
        let expected = 0;

        if (formData.phase === 'Tạm ứng') {
            const proj = projects.find(p => p.name === formData.project_name);
            expected = proj?.advance_value || 0;
        } else {
            if (phaseIncs.length === 0) return null;

            // Bug 2 fix: HSTT là giá trị duy nhất cho mỗi đợt (lấy bản ghi mới nhất, không cộng dồn)
            const invoiceRecords = phaseIncs.filter(i => i.post_tax_amount > 0 || i.amount > 0);
            const sortedInvoices = [...invoiceRecords].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
            for (const inv of sortedInvoices) {
                if (inv.note) {
                    try {
                        const parsed = JSON.parse(inv.note);
                        if (parsed && typeof parsed === 'object' && 'actual_received_amount' in parsed) {
                            expected = Number(parsed.actual_received_amount) || 0;
                            break; // Chỉ lấy giá trị mới nhất
                        }
                    } catch(e) {}
                }
            }
        }
        
        const received = phaseIncs.filter(i => i.post_tax_amount === 0 && i.amount === 0).reduce((sum, i) => {
            let actual = 0;
            if (i.note) {
                try {
                    const parsed = JSON.parse(i.note);
                    if (parsed && typeof parsed === 'object') {
                        const act = Number(parsed.actual_received_amount) || 0;
                        const ded = Number(parsed.deduction_amount) || 0;
                        actual = act + ded;
                    }
                } catch(e) {}
            }
            return sum + actual;
        }, 0);
        
        if (formData.phase !== 'Tạm ứng' && phaseIncs.length === 0) return null;

        return { expected, received };
    }, [type, formData.project_name, formData.phase, incomes, projects]);

    const projectRecipients = useMemo(() => {
        if (!formData.project_name) return [];
        const recipients = new Set();
        if (incomes) {
            incomes.forEach(i => {
                if (i.project_name === formData.project_name && i.recipient) {
                    recipients.add(i.recipient);
                }
            });
        }
        if (transactions) {
            transactions.forEach(t => {
                if (t.project_name === formData.project_name && t.recipient) {
                    recipients.add(t.recipient);
                }
            });
        }
        return Array.from(recipients);
    }, [formData.project_name, incomes, transactions]);



    useEffect(() => {
        if (!editData && type === 'INCOME_INVOICE') {
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
            if (!hasDebit) {
                newErrors.debit = 'Vui lòng nhập số tiền chi';
            }
            if (!formData.note?.trim()) newErrors.note = 'Vui lòng nhập nội dung / diễn giải';
            if (!formData.recipient?.trim()) newErrors.recipient = 'Vui lòng nhập đối tượng';
        } else if (type === 'INCOME_INVOICE') {
            if (!formData.phase?.trim()) newErrors.phase = 'Vui lòng nhập đợt thu';
            if (!formData.post_tax_amount || formData.post_tax_amount <= 0) newErrors.post_tax_amount = 'Số tiền thu phải lớn hơn 0';
        } else if (type === 'INCOME_REAL') {
            if (!formData.phase?.trim()) newErrors.phase = 'Vui lòng nhập đợt thu';
            
            const valReal = Number(formData.actual_received_amount) || 0;
            const valDed = Number(formData.deduction_amount) || 0;
            if (valReal <= 0 && valDed <= 0) {
                newErrors.actual_received_amount = 'Vui lòng nhập giá trị thực nhận hoặc cấn trừ';
            }
            
            if (selectedPhaseStats && selectedPhaseStats.expected > 0) {
                let originalRealAmount = 0;
                if (editData && editData.type === 'INCOME_REAL') {
                    if (editData.note) {
                        try {
                            const p = JSON.parse(editData.note);
                            if (p && typeof p === 'object') {
                                originalRealAmount = (Number(p.actual_received_amount) || 0) + (Number(p.deduction_amount) || 0);
                            }
                        } catch(e) {}
                    }
                }
                const maxAllowed = selectedPhaseStats.expected - selectedPhaseStats.received + originalRealAmount;
                const newTotal = (Number(formData.actual_received_amount) || 0) + (Number(formData.deduction_amount) || 0);
                if (newTotal > maxAllowed) {
                    newErrors.actual_received_amount = `Tổng thu và cấn trừ vượt quá giới hạn (tối đa còn lại: ${formatCurrency(maxAllowed)})`;
                }
            }
        } else if (type === 'OFFICE_INCOME') {
            if (!formData.recipient?.trim()) newErrors.recipient = 'Vui lòng nhập đối tượng';
            if (!formData.debit_account && formData.debit_account !== 'Khác') newErrors.debit_account = 'Vui lòng chọn tài khoản nợ';
            if (!formData.credit_account && formData.credit_account !== 'Khác') newErrors.credit_account = 'Vui lòng chọn tài khoản có';
            if (!formData.office_amount || formData.office_amount <= 0) newErrors.office_amount = 'Vui lòng nhập số tiền thu';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!validate()) return;

        if (type === 'EXPENSE') {
            const isBothCode = ['6413', '6418'].includes(formData.code);
            const isAdvanceOrReceivable = ['131', '141'].some(acc => formData.corresponding_account?.startsWith(acc));
            const isPayable = ['331', '334', '338'].some(acc => formData.corresponding_account?.startsWith(acc));
            const isMaterialOrEquipment = ['621', '623'].includes(formData.code);
            
            const isPayOnly = isMaterialOrEquipment || isPayable;
            const isBoth = !isPayOnly && (isBothCode || isAdvanceOrReceivable);

            if ((isBoth || isPayOnly) && parseFloat(formData.debit) > 0 && !editData) {
                setDebtConfirmModal({
                    isOpen: true,
                    data: formData,
                    mode: isBoth ? 'BOTH' : 'PAY_ONLY',
                    thuStatus: 'CHƯA XONG',
                    chiStatus: 'CHƯA XONG'
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
            const { data, mode, thuStatus, chiStatus } = debtConfirmModal;
            setDebtConfirmModal({ ...debtConfirmModal, isOpen: false });
            
            data.thuStatus = thuStatus;
            data.chiStatus = chiStatus;

            onSubmit('EXPENSE', data, editData?.id);
        
        if (onAddDebt) {
            const isVatTu = ['621', '623'].includes(data.code);
            const categoryPrefix = isVatTu ? '[VẬT TƯ] ' : '[TỔ ĐỘI] ';
            
            const debts = [];
            if (mode === 'BOTH') {
                let partnerNameThu = data.recipient || 'Đối tác/Nhà cung cấp';
                let debtNote = `${categoryPrefix}Thu lại - ${data.note || ''}`;
                if (data.code === '6418') debtNote = `${categoryPrefix}Thu lại (Bảo hiểm) - ${data.note || ''}`;
                else if (data.code === '6413') debtNote = `${categoryPrefix}Thu lại (Hồ sơ) - ${data.note || ''}`;

                debts.push({
                    project_name: data.project_name,
                    partner_name: partnerNameThu,
                    debt_type: 'CẦN THU',
                    amount: parseFloat(data.debit) || 0,
                    status: thuStatus,
                    note: debtNote
                });
            }
            
            const debtNoteChi = `${categoryPrefix}Thanh toán chi phí - ${data.note || ''}`;

            debts.push({
                project_name: data.project_name,
                partner_name: data.recipient || 'Đối tác/Nhà cung cấp',
                debt_type: 'CẦN TRẢ',
                amount: parseFloat(data.debit) || parseFloat(data.amount) || 0,
                status: chiStatus,
                note: debtNoteChi
            });
            onAddDebt(debts);
        }
        
        if (!editData) resetForm();
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
            actual_received_amount: 0,
            deduction_amount: 0
        }));
        setIsCustomCode(false);
    };

    const doSubmit = () => {
        if (!pendingSubmit) return;
        setConfirmSave(false);
        const data = pendingSubmit.formData;
        onSubmit(pendingSubmit.type, data, pendingSubmit.editId);
        
        // Không thêm công nợ tại đây nữa vì handleDebtConfirm đã lo việc đó nếu cần
        // đối với các mã chi phí tạo ra công nợ (isBoth hoặc isPayOnly)

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



            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                <div className="flex border-b">
                    <button
                        type="button"
                        onClick={() => { setType('EXPENSE'); setErrors({}); }}
                        className={`flex-1 py-3 text-sm sm:text-base sm:py-4 font-bold text-center transition ${type === 'EXPENSE' ? 'bg-blue-600 text-white' : 'hover:bg-slate-50 text-slate-500'}`}
                    >
                        CHI PHÍ
                    </button>
                    <button
                        type="button"
                        onClick={() => { setType('INCOME_INVOICE'); setErrors({}); }}
                        className={`flex-1 py-3 text-[10px] sm:text-xs md:text-sm font-bold text-center transition ${type === 'INCOME_INVOICE' ? 'bg-green-600 text-white' : 'hover:bg-slate-50 text-slate-500'}`}
                    >
                        DOANH THU (HÓA ĐƠN)
                    </button>
                    <button
                        type="button"
                        onClick={() => { 
                            if (type === 'INCOME_INVOICE') {
                                setFormData(prev => ({...prev, actual_received_amount: 0}));
                            }
                            setType('INCOME_REAL'); 
                            setErrors({}); 
                        }}
                        className={`flex-1 py-3 text-[10px] sm:text-xs md:text-sm font-bold text-center transition ${type === 'INCOME_REAL' ? 'bg-emerald-600 text-white' : 'hover:bg-slate-50 text-slate-500'}`}
                    >
                        DOANH THU (THỰC TẾ)
                    </button>
                    <button
                        type="button"
                        onClick={() => { setType('OFFICE_INCOME'); setErrors({}); }}
                        className={`flex-1 py-3 text-sm sm:text-base sm:py-4 font-bold text-center transition ${type === 'OFFICE_INCOME' ? 'bg-amber-600 text-white' : 'hover:bg-slate-50 text-slate-500'}`}
                    >
                        THU VĂN PHÒNG
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
                                {type === 'INCOME_REAL' ? 'Ngày TT' : 'Ngày hạch toán'} <span className="text-red-500">*</span>
                            </label>
                            <div className="relative flex items-center">
                                <input
                                    type="text"
                                    placeholder="dd/mm/yyyy"
                                    value={formData.display_accounting_date || (formData.accounting_date ? formData.accounting_date.split('-').reverse().join('/') : '')}
                                    onChange={(e) => {
                                        let val = e.target.value.replace(/[^0-9/]/g, '');
                                        if (val.length === 2 && !val.includes('/')) val += '/';
                                        if (val.length === 5 && val.split('/').length === 2) val += '/';
                                        handleChange('display_accounting_date', val);
                                        if (val.length === 10) {
                                            const [d, m, y] = val.split('/');
                                            if (d && m && y && y.length === 4) handleChange('accounting_date', `${y}-${m}-${d}`);
                                        } else {
                                            handleChange('accounting_date', '');
                                        }
                                    }}
                                    className={inputCls('accounting_date')}
                                />
                                <input 
                                    type="date"
                                    value={formData.accounting_date}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        handleChange('accounting_date', val);
                                        if (val) {
                                            const [y, m, d] = val.split('-');
                                            handleChange('display_accounting_date', `${d}/${m}/${y}`);
                                        }
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 cursor-pointer w-8 h-8 z-10"
                                />
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                    <line x1="16" y1="2" x2="16" y2="6"></line>
                                    <line x1="8" y1="2" x2="8" y2="6"></line>
                                    <line x1="3" y1="10" x2="21" y2="10"></line>
                                </svg>
                            </div>
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

                            </>
                        ) : type === 'INCOME_INVOICE' ? (
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
                                    <label className={labelCls}>Giá trị thanh toán sau thuế <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={formData.post_tax_amount ? formatCurrency(formData.post_tax_amount) : ''}
                                        onChange={(e) => {
                                            const val = parseVietnameseNumber(e.target.value);
                                            setFormData(prev => ({ 
                                                ...prev, 
                                                post_tax_amount: val,
                                                amount: val - (prev.vat_amount || 0)
                                            }));
                                        }}
                                        placeholder="Nhập số tiền sau thuế..."
                                        className={`${inputCls('post_tax_amount')} font-bold text-blue-600`}
                                    />
                                    {errorMsg('post_tax_amount')}
                                </div>
                                {/* Số hóa đơn */}
                                <div>
                                    <label className={labelCls}>Số hóa đơn</label>
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
                                    <label className={labelCls}>Ngày hóa đơn</label>
                                    <input
                                        type="date"
                                        value={formData.invoice_date || ''}
                                        onChange={(e) => handleChange('invoice_date', e.target.value)}
                                        className={inputCls('invoice_date')}
                                    />
                                </div>
                                {/* Giá trị thực nhận kỳ này */}
                                <div>
                                    <label className={labelCls}>Giá trị thực nhận kỳ này (Theo Hồ sơ thanh toán)</label>
                                    <input
                                        type="text"
                                        value={formData.actual_received_amount ? formatCurrency(formData.actual_received_amount) : ''}
                                        onChange={(e) => handleChange('actual_received_amount', parseVietnameseNumber(e.target.value))}
                                        placeholder="Nhập giá trị thực nhận theo hồ sơ..."
                                        className={`${inputCls('actual_received_amount')} font-bold text-emerald-600`}
                                    />
                                </div>
                            </>
                        ) : type === 'INCOME_REAL' ? (
                            <>
                                {/* Đợt thu */}
                                <div>
                                    <label className={labelCls}>
                                        Đợt thu (Giai đoạn) <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={formData.phase || ''}
                                        onChange={(e) => handleChange('phase', e.target.value)}
                                        className={inputCls('phase')}
                                    >
                                        <option value="">-- Chọn đợt thu --</option>
                                        {availablePhases.map(p => (
                                            <option key={p} value={p}>{p}</option>
                                        ))}
                                    </select>
                                    {errorMsg('phase')}
                                    {selectedPhaseStats && (selectedPhaseStats.expected > 0 || selectedPhaseStats.received > 0) && (
                                        <div className="mt-2 text-[13px] p-2.5 bg-blue-50/50 border border-blue-100 rounded-lg flex items-center justify-between shadow-sm">
                                            <span className="text-slate-600 font-medium">Tiến độ thu đợt này:</span>
                                            <div className="font-bold">
                                                <span className="text-blue-700">{formatCurrency(selectedPhaseStats.received)}</span>
                                                <span className="text-slate-400 mx-1.5">/</span>
                                                <span className="text-slate-700">{formatCurrency(selectedPhaseStats.expected)}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {/* Số chứng từ */}
                                <div>
                                    <label className={labelCls}>Số chứng từ</label>
                                    <input
                                        type="text"
                                        value={formData.voucher_no || ''}
                                        onChange={(e) => handleChange('voucher_no', e.target.value)}
                                        placeholder="Nhập số chứng từ..."
                                        className={inputCls('voucher_no')}
                                    />
                                </div>
                                {/* Giá trị thực nhận/nhập */}
                                <div>
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
                                {/* Cấn trừ trực tiếp */}
                                <div>
                                    <label className={labelCls}>Cấn trừ trực tiếp (Nếu có)</label>
                                    <input
                                        type="text"
                                        value={formData.deduction_amount ? formatCurrency(formData.deduction_amount) : ''}
                                        onChange={(e) => handleChange('deduction_amount', parseVietnameseNumber(e.target.value))}
                                        placeholder="Nhập giá trị cấn trừ..."
                                        className={`${inputCls('deduction_amount')} font-bold text-amber-600`}
                                    />
                                </div>
                                {type === 'INCOME_REAL' && formData.project_name && formData.phase && incomes && (
                                    <div className="md:col-span-2 mt-4">
                                        <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">Lịch sử các lần thu tiền (Thực tế) đợt này</label>
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-emerald-50 border-b border-slate-200 text-emerald-800">
                                                    <tr>
                                                        <th className="p-3 font-bold">Ngày Thanh Toán</th>
                                                        <th className="p-3 font-bold text-right">Số Tiền Thực Nhận</th>
                                                        <th className="p-3 font-bold text-right text-amber-700">Tiền Cấn Trừ</th>
                                                        <th className="p-3 font-bold">Diễn Giải / Nội Dung</th>
                                                        <th className="p-3 font-bold text-center">Thao tác</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 bg-white">
                                                    {(() => {
                                                        const historyReals = incomes.filter(i => 
                                                            i.project_name === formData.project_name && 
                                                            i.phase === formData.phase && 
                                                            i.post_tax_amount === 0 && 
                                                            i.amount === 0
                                                        ).sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at));

                                                        if (historyReals.length === 0) {
                                                            return <tr><td colSpan="5" className="p-4 text-center text-slate-500 italic">Chưa có khoản thu thực tế nào được ghi nhận</td></tr>;
                                                        }

                                                        return historyReals.map((inc) => {
                                                            let actAmt = 0;
                                                            let dedAmt = 0;
                                                            let text = inc.note;
                                                            if (inc.note) {
                                                                try {
                                                                    const p = JSON.parse(inc.note);
                                                                    actAmt = Number(p.actual_received_amount) || 0;
                                                                    dedAmt = Number(p.deduction_amount) || 0;
                                                                    text = p.text !== undefined ? p.text : inc.note;
                                                                    // Fix double stringified JSON (nội dung tùm lum)
                                                                    if (typeof text === 'string' && text.startsWith('{')) {
                                                                        try {
                                                                            const p2 = JSON.parse(text);
                                                                            if (p2.text !== undefined) text = p2.text;
                                                                        } catch(e) {}
                                                                    }
                                                                } catch(e) {}
                                                            }
                                                            const isEditingThis = editData && editData.id === inc.id;
                                                            return (
                                                                <tr key={inc.id} className={isEditingThis ? "bg-amber-50" : "hover:bg-slate-50"}>
                                                                    <td className="p-3 font-medium text-slate-700">
                                                                        {inc.date ? new Date(inc.date).toLocaleDateString('vi-VN') : ''}
                                                                        {isEditingThis && <span className="ml-2 text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-bold">Đang sửa</span>}
                                                                    </td>
                                                                    <td className="p-3 font-black text-emerald-600 text-right">{formatCurrency(actAmt)} VNĐ</td>
                                                                    <td className="p-3 font-black text-amber-600 text-right">{dedAmt > 0 ? formatCurrency(dedAmt) + ' VNĐ' : '-'}</td>
                                                                    <td className="p-3 text-slate-600">
                                                                        <div className="line-clamp-2 break-all" title={text}>{text}</div>
                                                                    </td>
                                                                    <td className="p-3 text-center">
                                                                        <div className="flex items-center justify-center gap-2">
                                                                            {onEditIncome && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => onEditIncome(inc)}
                                                                                    className="text-blue-500 hover:text-blue-700 p-1 font-bold text-[13px]"
                                                                                    title="Sửa"
                                                                                >
                                                                                    Sửa
                                                                                </button>
                                                                            )}
                                                                            {onDeleteIncome && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => onDeleteIncome(inc.id)}
                                                                                    className="text-red-500 hover:text-red-700 p-1"
                                                                                    title="Xóa"
                                                                                >
                                                                                    <Trash2 size={16} />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        });
                                                    })()}
                                                </tbody>
                                            </table>
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-2 font-medium">
                                            * Lưu ý: Để SỬA hoặc XÓA một phiếu thu cũ, vui lòng sang menu <span className="font-bold text-slate-700">"LỊCH SỬ THU CHI"</span>.
                                        </p>
                                    </div>
                                )}
                            </>
                        ) : type === 'OFFICE_INCOME' ? (
                            <>
                                {/* Tài khoản Nợ */}
                                <div>
                                    <label className={labelCls}>
                                        Tài khoản Nợ <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={formData.debit_account === 'Khác' ? 'Khác' : formData.debit_account || ''}
                                        onChange={(e) => handleChange('debit_account', e.target.value)}
                                        className={inputCls('debit_account')}
                                    >
                                        <option value="">-- Chọn tài khoản --</option>
                                        <option value="1111 - Tiền mặt">1111 - Tiền mặt</option>
                                        <option value="1121 - Tiền gửi NH">1121 - Tiền gửi NH</option>
                                        <option value="131 - Phải thu khách hàng">131 - Phải thu khách hàng</option>
                                        <option value="Khác">Khác...</option>
                                    </select>
                                    {formData.debit_account === 'Khác' && (
                                        <input
                                            type="text"
                                            value={formData.custom_debit_account || ''}
                                            onChange={(e) => handleChange('custom_debit_account', e.target.value)}
                                            placeholder="Nhập tài khoản nợ..."
                                            className={`${inputCls('custom_debit_account')} mt-2`}
                                        />
                                    )}
                                    {errorMsg('debit_account')}
                                </div>
                                {/* Tài khoản Có */}
                                <div>
                                    <label className={labelCls}>
                                        Tài khoản Có <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={formData.credit_account === 'Khác' ? 'Khác' : formData.credit_account || ''}
                                        onChange={(e) => handleChange('credit_account', e.target.value)}
                                        className={inputCls('credit_account')}
                                    >
                                        <option value="">-- Chọn tài khoản --</option>
                                        <option value="511 - Doanh thu">511 - Doanh thu</option>
                                        <option value="711 - Thu nhập khác">711 - Thu nhập khác</option>
                                        <option value="131 - Phải thu khách hàng">131 - Phải thu khách hàng</option>
                                        <option value="Khác">Khác...</option>
                                    </select>
                                    {formData.credit_account === 'Khác' && (
                                        <input
                                            type="text"
                                            value={formData.custom_credit_account || ''}
                                            onChange={(e) => handleChange('custom_credit_account', e.target.value)}
                                            placeholder="Nhập tài khoản có..."
                                            className={`${inputCls('custom_credit_account')} mt-2`}
                                        />
                                    )}
                                    {errorMsg('credit_account')}
                                </div>
                                {/* Số tiền thu */}
                                <div className="md:col-span-2">
                                    <label className={labelCls}>
                                        Số tiền thu <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.office_amount ? formatCurrency(formData.office_amount) : ''}
                                        onChange={(e) => handleChange('office_amount', parseVietnameseNumber(e.target.value))}
                                        placeholder="Nhập số tiền..."
                                        className={`${inputCls('office_amount')} font-bold text-amber-600`}
                                    />
                                    {errorMsg('office_amount')}
                                </div>
                            </>
                        ) : null}
                    </div>

                    {/* Đối tượng thụ hưởng */}
                    {(type === 'EXPENSE' || type === 'OFFICE_INCOME') && (
                        <div>
                            <label className={labelCls}>
                                Đối tượng <span className="text-red-500">*</span>
                            </label>
                            <RecipientInput
                                value={formData.recipient}
                                onChange={(val) => handleChange('recipient', val)}
                                errorCls={errors.recipient ? 'border-red-500' : ''}
                                placeholder="Nhập tên đối tượng..."
                                suggestions={projectRecipients}
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
                                onClick={() => setConfirmReset(true)}
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
            
            <ConfirmModal
                isOpen={confirmReset}
                title="Xóa trắng nhập liệu"
                message="Bạn có chắc chắn muốn xóa trắng toàn bộ dữ liệu đang nhập để nhập lại từ đầu?"
                onConfirm={() => {
                    setFormData({
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
                        actual_received_amount: 0,
                        creator: ''
                    });
                    setErrors({});
                    setConfirmReset(false);
                }}
                onCancel={() => setConfirmReset(false)}
            />

            {/* Modal Xác Nhận Công Nợ */}
            {debtConfirmModal.isOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-indigo-600 p-6 text-white">
                            <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
                                <AlertCircle className="text-indigo-200" size={28} />
                                Xác nhận Trạng thái
                            </h3>
                            <p className="text-indigo-100 opacity-90 text-sm">Hệ thống phát hiện chi phí này có phát sinh công nợ tự động. Vui lòng xác nhận trạng thái.</p>
                        </div>
                        
                        <div className="p-8">
                            <div className="space-y-6">
                                {debtConfirmModal.mode === 'BOTH' && (
                                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                        <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">Công nợ đã thu hay chưa?</label>
                                        <div className="flex gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setDebtConfirmModal({ ...debtConfirmModal, thuStatus: 'ĐÃ XONG' })}
                                                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all border-2 ${
                                                    debtConfirmModal.thuStatus === 'ĐÃ XONG' 
                                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-400 shadow-sm' 
                                                        : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/50'
                                                }`}
                                            >
                                                ĐÃ THU
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDebtConfirmModal({ ...debtConfirmModal, thuStatus: 'CHƯA XONG' })}
                                                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all border-2 ${
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
                                
                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                    <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">Công nợ đã chi hay chưa?</label>
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setDebtConfirmModal({ ...debtConfirmModal, chiStatus: 'ĐÃ XONG' })}
                                            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all border-2 ${
                                                debtConfirmModal.chiStatus === 'ĐÃ XONG' 
                                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-400 shadow-sm' 
                                                    : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/50'
                                            }`}
                                        >
                                            ĐÃ CHI
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDebtConfirmModal({ ...debtConfirmModal, chiStatus: 'CHƯA XONG' })}
                                            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all border-2 ${
                                                debtConfirmModal.chiStatus === 'CHƯA XONG' 
                                                    ? 'bg-amber-50 text-amber-600 border-amber-400 shadow-sm' 
                                                    : 'bg-white text-slate-500 border-slate-200 hover:border-amber-200 hover:bg-amber-50/50'
                                            }`}
                                        >
                                            CHƯA CHI
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 mt-8">
                                <button
                                    type="button"
                                    onClick={handleDebtConfirm}
                                    className="w-full py-4 bg-indigo-600 text-white hover:bg-indigo-700 font-bold rounded-2xl transition shadow-lg shadow-indigo-600/20"
                                >
                                    LƯU DỮ LIỆU & CHUYỂN TỚI CÔNG NỢ
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDebtConfirmModal({ ...debtConfirmModal, isOpen: false })}
                                    className="w-full py-3 text-slate-500 hover:bg-slate-100 font-bold rounded-2xl transition"
                                >
                                    Hủy bỏ
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
