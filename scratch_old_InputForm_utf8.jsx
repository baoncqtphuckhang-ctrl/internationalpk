'use client';
/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

import React, { useState, useEffect } from 'react';
import { Save, Trash2, AlertCircle } from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';
import { formatCurrency, parseVietnameseNumber, EXPENSE_CATEGORIES } from '@/lib/utils';

export default function InputForm({ projects, onSubmit, onAddDebt, isLoading, editData, incomes = [], onCancel, currentUser }) {
    const [type, setType] = useState('EXPENSE'); // EXPENSE hoß║╖c INCOME
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
        phase: '─Éß╗út 1',
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
        thuStatus: 'CH╞»A XONG', 
        thanhToanStatus: 'CH╞»A XONG' 
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
                phase: editData.phase || '─Éß╗út 1',
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
            
            const commonAccounts = ["", "111 - Tiß╗ün mß║╖t", "112 - Tiß╗ün gß╗¡i NH", "131 - C├┤ng nß╗ú phß║úi thu", "141 - Tß║ím ß╗⌐ng", "152 - Nguy├¬n liß╗çu, vß║¡t liß╗çu", "154 - Chi ph├¡ SXKD dß╗ƒ dang", "331 - Phß║úi trß║ú ng╞░ß╗¥i b├ín", "334 - Phß║úi trß║ú ng╞░ß╗¥i lao ─æß╗Öng", "338 - Phß║úi trß║ú kh├íc", "642 - Chi ph├¡ QLDN"];
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
            setFormData(prev => ({ ...prev, phase: `─Éß╗út ${maxPhase + 1}` }));
        }
    }, [type, formData.project_name, incomes, editData]);

    // X├│a lß╗ùi khi user bß║»t ─æß║ºu nhß║¡p
    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => { const e = { ...prev }; delete e[field]; return e; });
        }
    };

    const validate = () => {
        const newErrors = {};
        if (!formData.project_name) newErrors.project_name = 'Vui l├▓ng chß╗ìn c├┤ng tr├¼nh';
        if (!formData.accounting_date) newErrors.accounting_date = 'Vui l├▓ng nhß║¡p ng├áy hß║ích to├ín';

        if (type === 'EXPENSE') {
            if (!formData.code?.trim()) newErrors.code = 'Vui l├▓ng nhß║¡p m├ú chi ph├¡';
            const hasDebit = formData.debit > 0;
            const hasAmount6418 = formData.amount6418 > 0;
            if (!hasDebit && !hasAmount6418) {
                newErrors.debit = 'Vui l├▓ng nhß║¡p Sß╗æ tiß╗ün chi hoß║╖c Sß╗æ tiß╗ün thu';
                newErrors.amount6418 = 'Vui l├▓ng nhß║¡p Sß╗æ tiß╗ün chi hoß║╖c Sß╗æ tiß╗ün thu';
            }
            if (!formData.note?.trim()) newErrors.note = 'Vui l├▓ng nhß║¡p nß╗Öi dung / diß╗àn giß║úi';
            if (!formData.recipient?.trim()) newErrors.recipient = 'Vui l├▓ng nhß║¡p ─æß╗æi t╞░ß╗úng';
        } else {
            if (!formData.phase?.trim()) newErrors.phase = 'Vui l├▓ng nhß║¡p ─æß╗út thu';
            if (!formData.amount || formData.amount <= 0) newErrors.amount = 'Sß╗æ tiß╗ün thu phß║úi lß╗¢n h╞ín 0';
            if (!formData.actual_received_amount || formData.actual_received_amount <= 0) newErrors.actual_received_amount = 'Vui l├▓ng nhß║¡p gi├í trß╗ï thß╗▒c nhß║¡n';
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
                    thuStatus: isBoth ? 'CH╞»A XONG' : null,
                    thanhToanStatus: 'CH╞»A XONG',
                    mode: isBoth ? 'BOTH' : 'PAY_ONLY'
                });
                return;
            }
        }

        // Hiß╗çn confirm tr╞░ß╗¢c khi l╞░u
        const action = editData ? 'cß║¡p nhß║¡t' : 'th├¬m mß╗¢i';
        setPendingSubmit({ type, formData, editId: editData?.id });
        setConfirmSave(true);
    };

    const handleDebtConfirm = () => {
        const data = debtConfirmModal.data;
        const { thuStatus, thanhToanStatus, mode } = debtConfirmModal;
        
        setDebtConfirmModal({ isOpen: false, data: null, thuStatus: 'CH╞»A XONG', thanhToanStatus: 'CH╞»A XONG' });
        
        // 1. Submit normal transaction
        onSubmit('EXPENSE', data, editData?.id);
        
        // 2 & 3. Submit debts
        if (onAddDebt) {
            const debts = [];
            if (mode === 'BOTH') {
                let partnerName = data.recipient || '─Éß╗æi t├íc/Nh├á cung cß║Ñp';
                if (data.code === '6418') partnerName = 'Nh├ón sß╗▒ (Bß║úo hiß╗âm)';
                else if (data.code === '6413') partnerName = 'C├┤ng nh├ón (Hß╗ô s╞í)';

                debts.push({
                    project_name: data.project_name,
                    partner_name: partnerName,
                    debt_type: 'Cß║ªN THU',
                    amount: parseFloat(data.debit) || parseFloat(data.amount) || 0,
                    status: thuStatus,
                    note: `Thu lß║íi - ${data.note || ''}`
                });
            }
            
            debts.push({
                project_name: data.project_name,
                partner_name: data.recipient || '─Éß╗æi t├íc/Nh├á cung cß║Ñp',
                debt_type: 'Cß║ªN TRß║ó',
                amount: parseFloat(data.debit) || parseFloat(data.amount) || 0,
                status: thanhToanStatus,
                note: `Thanh to├ín chi ph├¡ - ${data.note || ''}`
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
                title={editData ? 'X├íc nhß║¡n cß║¡p nhß║¡t' : 'X├íc nhß║¡n l╞░u dß╗» liß╗çu'}
                message={editData
                    ? `Bß║ín c├│ chß║»c chß║»n muß╗æn cß║¡p nhß║¡t dß╗» liß╗çu n├áy kh├┤ng?`
                    : `Bß║ín c├│ chß║»c chß║»n muß╗æn l╞░u dß╗» liß╗çu ${type === 'EXPENSE' ? 'chi ph├¡' : 'doanh thu'} mß╗¢i n├áy kh├┤ng?`
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
                                <h3 className="text-xl font-black text-slate-800">X├íc nhß║¡n C├┤ng Nß╗ú</h3>
                            </div>
                            
                            <p className="text-slate-600 mb-8 font-medium leading-relaxed">
                                Chi ph├¡ n├áy c├│ m├ú <b>{debtConfirmModal.data?.code}</b>. Vui l├▓ng x├íc nhß║¡n trß║íng th├íi ─æß╗â hß╗ç thß╗æng tß╗▒ ─æß╗Öng ghi nhß║¡n v├áo sß╗ò c├┤ng nß╗ú.
                            </p>
                            
                            <div className="space-y-6">
                                {/* Khß╗æi Thu tß╗½ tß╗ò ─æß╗Öi */}
                                {debtConfirmModal.mode === 'BOTH' && (
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                        <p className="font-bold text-slate-800 mb-3 text-sm">1. ─É├ú thu lß║íi tiß╗ün tß╗½ tß╗ò ─æß╗Öi/c├┤ng nh├ón ch╞░a?</p>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => setDebtConfirmModal(prev => ({...prev, thuStatus: '─É├â XONG'}))}
                                                className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all border-2 ${
                                                    debtConfirmModal.thuStatus === '─É├â XONG' 
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-500 shadow-sm' 
                                                        : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/50'
                                                }`}
                                            >
                                                ─É├â THU
                                            </button>
                                            <button
                                                onClick={() => setDebtConfirmModal(prev => ({...prev, thuStatus: 'CH╞»A XONG'}))}
                                                className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all border-2 ${
                                                    debtConfirmModal.thuStatus === 'CH╞»A XONG' 
                                                        ? 'bg-amber-50 text-amber-600 border-amber-400 shadow-sm' 
                                                        : 'bg-white text-slate-500 border-slate-200 hover:border-amber-200 hover:bg-amber-50/50'
                                                }`}
                                            >
                                                CH╞»A THU
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Khß╗æi Thanh to├ín */}
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                    <p className="font-bold text-slate-800 mb-3 text-sm">{debtConfirmModal.mode === 'BOTH' ? '2. ' : ''}─É├ú thanh to├ín chi ph├¡ n├áy ch╞░a?</p>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setDebtConfirmModal(prev => ({...prev, thanhToanStatus: '─É├â XONG'}))}
                                            className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all border-2 ${
                                                debtConfirmModal.thanhToanStatus === '─É├â XONG' 
                                                    ? 'bg-blue-50 text-blue-700 border-blue-500 shadow-sm' 
                                                    : 'bg-white text-slate-500 border-slate-200 hover:border-blue-200 hover:bg-blue-50/50'
                                            }`}
                                        >
                                            ─É├â THANH TO├üN
                                        </button>
                                        <button
                                            onClick={() => setDebtConfirmModal(prev => ({...prev, thanhToanStatus: 'CH╞»A XONG'}))}
                                            className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all border-2 ${
                                                debtConfirmModal.thanhToanStatus === 'CH╞»A XONG' 
                                                    ? 'bg-amber-50 text-amber-600 border-amber-400 shadow-sm' 
                                                    : 'bg-white text-slate-500 border-slate-200 hover:border-amber-200 hover:bg-amber-50/50'
                                            }`}
                                        >
                                            CH╞»A THANH TO├üN
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 mt-8">
                                <button
                                    onClick={handleDebtConfirm}
                                    className="w-full py-4 bg-indigo-600 text-white hover:bg-indigo-700 font-bold rounded-2xl transition shadow-lg shadow-indigo-600/20"
                                >
                                    L╞»U Dß╗« LIß╗åU & CHUYß╗éN Tß╗ÜI C├öNG Nß╗ó
                                </button>
                                <button
                                    onClick={() => setDebtConfirmModal({ isOpen: false, data: null, thuStatus: 'CH╞»A XONG', thanhToanStatus: 'CH╞»A XONG' })}
                                    className="w-full py-3 text-slate-500 hover:bg-slate-100 font-bold rounded-2xl transition"
                                >
                                    Hß╗ºy bß╗Å
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
                        CHI PH├ì (PHIß║╛U CHI)
                    </button>
                    <button
                        type="button"
                        onClick={() => { setType('INCOME'); setErrors({}); }}
                        className={`flex-1 py-4 font-bold text-center transition ${type === 'INCOME' ? 'bg-green-600 text-white' : 'hover:bg-slate-50 text-slate-500'}`}
                    >
                        DOANH THU (THU TIß╗ÇN)
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6" noValidate>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* C├┤ng tr├¼nh */}
                        <div>
                            <label className={labelCls}>
                                C├┤ng tr├¼nh <span className="text-red-500">*</span>
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

                        {/* Ng├áy hß║ích to├ín */}
                        <div>
                            <label className={labelCls}>
                                Ng├áy hß║ích to├ín <span className="text-red-500">*</span>
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
                                {/* M├ú CP */}
                                <div>
                                    <label className={labelCls}>
                                        M├ú CP <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={isCustomCode ? 'Kh├íc' : formData.code}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === 'Kh├íc') {
                                                setIsCustomCode(true);
                                                handleChange('code', '');
                                            } else {
                                                setIsCustomCode(false);
                                                handleChange('code', val);
                                            }
                                        }}
                                        className={inputCls('code')}
                                    >
                                        <option value="">-- Chß╗ìn M├ú CP --</option>
                                        {EXPENSE_CATEGORIES.map(c => (
                                            <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                                        ))}
                                        <option value="Kh├íc">Kh├íc...</option>
                                    </select>
                                    {isCustomCode && (
                                        <input
                                            type="text"
                                            value={formData.code}
                                            onChange={(e) => handleChange('code', e.target.value.replace(',', '.'))}
                                            placeholder="Nhß║¡p m├ú CP kh├íc..."
                                            className={`${inputCls('code')} mt-2`}
                                        />
                                    )}
                                    {errorMsg('code')}
                                </div>
                                {/* Sß╗æ tiß╗ün chi */}
                                <div>
                                    <label className={labelCls}>
                                        Sß╗æ tiß╗ün chi (Nß╗ú)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.debit ? formatCurrency(formData.debit) : ''}
                                        onChange={(e) => handleChange('debit', parseVietnameseNumber(e.target.value))}
                                        placeholder="Nhß║¡p sß╗æ tiß╗ün..."
                                        className={`${inputCls('debit')} font-bold text-red-600`}
                                    />
                                    {errorMsg('debit')}
                                </div>
                                {/* Sß╗æ h├│a ─æ╞ín */}
                                <div>
                                    <label className={labelCls}>
                                        Sß╗æ h├│a ─æ╞ín
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.invoice_no || ''}
                                        onChange={(e) => handleChange('invoice_no', e.target.value)}
                                        placeholder="Nhß║¡p sß╗æ h├│a ─æ╞ín..."
                                        className={inputCls('invoice_no')}
                                    />
                                </div>
                                {/* Ng├áy h├│a ─æ╞ín */}
                                <div>
                                    <label className={labelCls}>
                                        Ng├áy h├│a ─æ╞ín
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.invoice_date || ''}
                                        onChange={(e) => handleChange('invoice_date', e.target.value)}
                                        className={inputCls('invoice_date')}
                                    />
                                </div>
                                {/* T├ái khoß║ún ─æß╗æi ß╗⌐ng */}
                                <div>
                                    <label className={labelCls}>
                                        T├ái khoß║ún ─æß╗æi ß╗⌐ng
                                    </label>
                                    <select
                                        value={isCustomAccount ? 'Kh├íc' : (formData.corresponding_account || '')}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === 'Kh├íc') {
                                                setIsCustomAccount(true);
                                                handleChange('corresponding_account', '');
                                            } else {
                                                setIsCustomAccount(false);
                                                handleChange('corresponding_account', val);
                                            }
                                        }}
                                        className={inputCls('corresponding_account')}
                                    >
                                        <option value="">-- ─Éß╗â trß╗æng --</option>
                                        <option value="111 - Tiß╗ün mß║╖t">111 - Tiß╗ün mß║╖t</option>
                                        <option value="112 - Tiß╗ün gß╗¡i NH">112 - Tiß╗ün gß╗¡i NH</option>
                                        <option value="131 - C├┤ng nß╗ú phß║úi thu">131 - C├┤ng nß╗ú phß║úi thu</option>
                                        <option value="141 - Tß║ím ß╗⌐ng">141 - Tß║ím ß╗⌐ng</option>
                                        <option value="152 - Nguy├¬n liß╗çu, vß║¡t liß╗çu">152 - Nguy├¬n liß╗çu, vß║¡t liß╗çu</option>
                                        <option value="154 - Chi ph├¡ SXKD dß╗ƒ dang">154 - Chi ph├¡ SXKD dß╗ƒ dang</option>
                                        <option value="331 - Phß║úi trß║ú ng╞░ß╗¥i b├ín">331 - Phß║úi trß║ú ng╞░ß╗¥i b├ín</option>
                                        <option value="334 - Phß║úi trß║ú ng╞░ß╗¥i lao ─æß╗Öng">334 - Phß║úi trß║ú ng╞░ß╗¥i lao ─æß╗Öng</option>
                                        <option value="338 - Phß║úi trß║ú kh├íc">338 - Phß║úi trß║ú kh├íc</option>
                                        <option value="642 - Chi ph├¡ QLDN">642 - Chi ph├¡ QLDN</option>
                                        <option value="Kh├íc">Kh├íc...</option>
                                    </select>
                                    {isCustomAccount && (
                                        <input
                                            type="text"
                                            value={formData.corresponding_account}
                                            onChange={(e) => handleChange('corresponding_account', e.target.value)}
                                            placeholder="Nhß║¡p t├ái khoß║ún ─æß╗æi ß╗⌐ng kh├íc..."
                                            className={`${inputCls('corresponding_account')} mt-2`}
                                        />
                                    )}
                                </div>
                                {/* Ng╞░ß╗¥i lß║¡p */}
                                <div>
                                    <label className={labelCls}>
                                        Ng╞░ß╗¥i lß║¡p
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.creator}
                                        onChange={(e) => handleChange('creator', e.target.value)}
                                        placeholder="Nhß║¡p t├¬n ng╞░ß╗¥i lß║¡p..."
                                        className={inputCls('creator')}
                                    />
                                </div>
                                {/* Sß╗æ tiß╗ün thu */}
                                <div>
                                    <label className={labelCls}>
                                        Sß╗æ tiß╗ün thu
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.amount6418 ? formatCurrency(formData.amount6418) : ''}
                                        onChange={(e) => handleChange('amount6418', parseVietnameseNumber(e.target.value))}
                                        placeholder="Nhß║¡p sß╗æ tiß╗ün thu..."
                                        className={`${inputCls('amount6418')} font-bold text-amber-600`}
                                    />
                                    {errorMsg('amount6418')}
                                </div>
                            </>
                        ) : (
                            <>
                                {/* ─Éß╗út thu */}
                                <div>
                                    <label className={labelCls}>
                                        ─Éß╗út thu (Giai ─æoß║ín) <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.phase}
                                        onChange={(e) => handleChange('phase', e.target.value)}
                                        className={inputCls('phase')}
                                    />
                                    {errorMsg('phase')}
                                </div>
                                {/* Gi├í trß╗ï tr╞░ß╗¢c thuß║┐ */}
                                <div>
                                    <label className={labelCls}>
                                        Gi├í trß╗ï thanh to├ín tr╞░ß╗¢c thuß║┐ <span className="text-red-500">*</span>
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
                                        placeholder="Nhß║¡p sß╗æ tiß╗ün..."
                                        className={`${inputCls('amount')} font-bold text-green-600`}
                                    />
                                    {errorMsg('amount')}
                                </div>
                                {/* Gi├í trß╗ï VAT */}
                                <div>
                                    <div className="flex justify-between items-end mb-1">
                                        <label className="block text-sm font-bold text-slate-700">Gi├í trß╗ï VAT</label>
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
                                                /> Kh├íc
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
                                        placeholder="Nhß║¡p VAT..."
                                        className={`${inputCls('vat_amount')} font-bold text-slate-600`}
                                    />
                                </div>
                                {/* Gi├í trß╗ï thanh to├ín sau thuß║┐ */}
                                <div className="md:col-span-2">
                                    <label className={labelCls}>Gi├í trß╗ï thanh to├ín sau thuß║┐</label>
                                    <input
                                        type="text"
                                        value={formData.post_tax_amount ? formatCurrency(formData.post_tax_amount) : ''}
                                        onChange={(e) => handleChange('post_tax_amount', parseVietnameseNumber(e.target.value))}
                                        placeholder="Nhß║¡p sß╗æ tiß╗ün sau thuß║┐..."
                                        className={`${inputCls('post_tax_amount')} font-bold text-blue-600`}
                                    />
                                </div>
                                {/* Gi├í trß╗ï thß╗▒c nhß║¡n/nhß║¡p */}
                                <div className="md:col-span-2">
                                    <label className={labelCls}>Gi├í trß╗ï thß╗▒c nhß║¡n/nhß║¡p <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={formData.actual_received_amount ? formatCurrency(formData.actual_received_amount) : ''}
                                        onChange={(e) => handleChange('actual_received_amount', parseVietnameseNumber(e.target.value))}
                                        placeholder="Nhß║¡p gi├í trß╗ï thß╗▒c nhß║¡n..."
                                        className={`${inputCls('actual_received_amount')} font-bold text-emerald-600`}
                                    />
                                    {errorMsg('actual_received_amount')}
                                </div>
                            </>
                        )}
                    </div>

                    {/* ─Éß╗æi t╞░ß╗úng thß╗Ñ h╞░ß╗ƒng */}
                    {type === 'EXPENSE' && (
                        <div>
                            <label className={labelCls}>
                                ─Éß╗æi t╞░ß╗úng thß╗Ñ h╞░ß╗ƒng/─æß╗æi t╞░ß╗úng khß║Ñu trß╗½ <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.recipient}
                                onChange={(e) => handleChange('recipient', e.target.value)}
                                placeholder="Nhß║¡p t├¬n ─æß╗æi t╞░ß╗úng..."
                                className={inputCls('recipient')}
                            />
                            {errorMsg('recipient')}
                        </div>
                    )}

                    {/* Nß╗Öi dung / Diß╗àn giß║úi */}
                    <div>
                        <label className={labelCls}>
                            Nß╗Öi dung / Diß╗àn giß║úi
                            {type === 'EXPENSE' && <span className="text-red-500"> *</span>}
                        </label>
                        <textarea
                            value={formData.note}
                            onChange={(e) => handleChange('note', e.target.value)}
                            rows="3"
                            className={inputCls('note')}
                            placeholder="Nhß║¡p chi tiß║┐t nß╗Öi dung..."
                        />
                        {errorMsg('note')}
                    </div>

                    {/* Hiß╗ân thß╗ï sß╗æ lß╗ùi nß║┐u c├│ */}
                    {Object.keys(errors).length > 0 && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">
                            <AlertCircle size={16} className="flex-shrink-0" />
                            Vui l├▓ng ─æiß╗ün ─æß║ºy ─æß╗º c├íc tr╞░ß╗¥ng bß║»t buß╗Öc (<span className="text-red-500">*</span>) tr╞░ß╗¢c khi l╞░u.
                        </div>
                    )}

                    <div className="flex gap-4">
                        {onCancel ? (
                            <button
                                type="button"
                                onClick={onCancel}
                                className="px-6 py-4 rounded-xl font-bold text-red-500 hover:bg-red-50 hover:text-red-700 border border-red-200 transition flex items-center justify-center gap-2"
                            >
                                Hß╗ªY Bß╗Ä
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => {
                                    if (window.confirm('Bß║ín c├│ muß╗æn x├│a trß║»ng to├án bß╗Ö dß╗» liß╗çu ─æang nhß║¡p ─æß╗â nhß║¡p lß║íi tß╗½ ─æß║ºu?')) {
                                        setFormData({
                                            project_name: projects[0]?.name || '',
                                            accounting_date: new Date().toISOString().split('T')[0],
                                            invoice_no: '',
                                            code: '',
                                            debit: 0,
                                            credit: 0,
                                            note: '',
                                            recipient: '',
                                            phase: '─Éß╗út 1',
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
                                <Trash2 size={20} /> X├ôA NHß║¼P LIß╗åU
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
                                    {editData ? 'Cß║¼P NHß║¼T Dß╗« LIß╗åU' : 'L╞»U Dß╗« LIß╗åU V├ÇO DATABASE'}
                                  </>
                            }
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
