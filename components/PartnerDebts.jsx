import React, { useState, useMemo } from 'react';
import { formatCurrency, formatDateVN } from '@/lib/utils';
import { PlusCircle, Search, CheckCircle, Clock, Trash2, Filter, Save, X, Eye, Printer } from 'lucide-react';
import ConfirmModal from './ConfirmModal';

export default function PartnerDebts({ 
    debts, 
    projects, 
    onAddDebt, 
    onUpdateDebtStatus, 
    onDeleteDebt,
    isLoading,
    currentUser,
    dnttList,
    deleteRequests = []
}) {
    const [confirmDebtModal, setConfirmDebtModal] = useState({ isOpen: false, debt: null });
    const [debtAccount, setDebtAccount] = useState('131 - Công nợ phải thu');

    const [filterType, setFilterType] = useState('ALL'); // ALL, CẦN THU, CẦN TRẢ
    const [filterStatus, setFilterStatus] = useState('CHƯA XONG'); // ALL, CHƯA XONG, ĐÃ XONG
    const [activeCategory, setActiveCategory] = useState('ALL'); // ALL, TO_DOI, VAT_TU
    const [searchTerm, setSearchTerm] = useState('');
    
    const [showAddForm, setShowAddForm] = useState(false);
    const [formData, setFormData] = useState({
        project_name: projects[0]?.name || '',
        partner_name: '',
        debt_type: 'CẦN THU',
        amount_before_tax: '',
        vat_amount: '0',
        amount_after_tax: '',
        note: ''
    });
    const [editingId, setEditingId] = useState(null);
    
    const [formError, setFormError] = useState('');
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });
    const [viewDnttModal, setViewDnttModal] = useState(null);

    const formatRecordedDateTime = (dateString) => {
        if (!dateString) return { date: '', time: '' };
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return { date: dateString, time: '' };
        return {
            date: date.toLocaleDateString('vi-VN'),
            time: date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        };
    };

    const getDebtDntt = (note) => {
        if (!note || !dnttList || dnttList.length === 0) return null;
        const noteStr = note.split('[PAYLOAD]')[0];
        
        // 1. Try finding ID match e.g. [Đơn Vật Tư] 17216034 or eb9e400d
        const match = noteStr.match(/\[(.*?)\]\s*([a-f0-9\-]+)/i);
        if (match && match[2]) {
            const shortId = match[2].trim().toLowerCase();
            if (shortId.length >= 6) {
                const found = dnttList.find(d => d.id && d.id.toLowerCase().startsWith(shortId));
                if (found) return found;
            }
        }

        // 2. Try finding order phase match e.g. "ĐỢT 9" or "Đợt 9"
        const phaseMatch = noteStr.match(/(?:ĐỢT|Đợt)\s*(\d+)/i);
        if (phaseMatch) {
            const phaseStr = phaseMatch[0].toUpperCase();
            const found = dnttList.find(d => {
                if (!d.reason) return false;
                return d.reason.toUpperCase().includes(phaseStr);
            });
            if (found) return found;
        }

        return null;
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAddSubmit = (e) => {
        e.preventDefault();
        setFormError('');
        
        if (!formData.project_name) return setFormError('Vui lòng chọn công trình!');
        if (!formData.partner_name.trim()) return setFormError('Vui lòng nhập tên đối tượng / tổ đội!');
        
        const preTax = parseFloat(formData.amount_before_tax) || 0;
        const vatAmount = parseFloat(formData.vat_amount) || 0;
        const postTaxInput = parseFloat(formData.amount_after_tax);
        
        const totalAmount = (!isNaN(postTaxInput) && postTaxInput > 0) ? postTaxInput : (preTax + vatAmount);
        if (totalAmount <= 0) return setFormError('Số tiền sau thuế phải lớn hơn 0!');

        const payloadNote = `[PRE_TAX:${preTax}][VAT_AMOUNT:${vatAmount}] ${formData.note}`.trim();

        onAddDebt({
            id: editingId, // will be undefined if new
            project_name: formData.project_name,
            partner_name: formData.partner_name,
            debt_type: formData.debt_type,
            amount: totalAmount,
            note: payloadNote,
            status: 'CHƯA XONG'
        });
        
        setShowAddForm(false);
        setEditingId(null);
        setFormData({
            project_name: projects[0]?.name || '',
            partner_name: '',
            debt_type: 'CẦN THU',
            amount_before_tax: '',
            vat_amount: '0',
            amount_after_tax: '',
            note: ''
        });
    };

    const getDebtPostTaxAmount = (debt) => {
        if (!debt) return 0;
        const rawAmount = parseFloat(debt.amount) || 0;
        const note = debt.note || '';

        const preTaxMatch = note.match(/\[PRE_TAX:([0-9.]+)\]/);
        const vatAmountMatch = note.match(/\[VAT_AMOUNT:([0-9.]+)\]/);
        const vatRateMatch = note.match(/\[VAT_RATE:([0-9.]+)\]/);
        const pretaxTagMatch = note.match(/\[PRETAX:([0-9.]+)\]/);

        if (preTaxMatch && vatAmountMatch) {
            return (parseFloat(preTaxMatch[1]) || 0) + (parseFloat(vatAmountMatch[1]) || 0);
        }
        if (preTaxMatch && vatRateMatch) {
            const p = parseFloat(preTaxMatch[1]) || 0;
            const r = parseFloat(vatRateMatch[1]) || 0;
            const v = r > 100 ? r : (p * r / 100);
            return p + v;
        }
        if (pretaxTagMatch) {
            const pretaxVal = parseFloat(pretaxTagMatch[1]) || 0;
            if (pretaxVal > 0 && Math.abs(pretaxVal - rawAmount) < 1) {
                return Math.round(rawAmount * 1.08);
            }
            return rawAmount;
        }
        const isVatTuOrDonVatTu = note.includes('[VẬT TƯ]') || note.includes('[Đơn Vật Tư]');
        if (isVatTuOrDonVatTu && rawAmount > 0) {
            const hasExplicitVat0 = note.includes('[VAT:0]') || note.includes('[VAT_RATE:0]');
            if (!hasExplicitVat0 && !preTaxMatch && !vatAmountMatch) {
                return Math.round(rawAmount * 1.08);
            }
        }

        return rawAmount;
    };

    const handleEditDebt = (debt) => {
        let preTax = debt.amount;
        let vatAmount = 0;
        let cleanNote = debt.note || '';

        // Extract tags if exist: [PRE_TAX:1000][VAT_AMOUNT:80] or [VAT_RATE:8]
        const preTaxMatch = cleanNote.match(/\[PRE_TAX:([0-9.]+)\]/);
        const vatAmountMatch = cleanNote.match(/\[VAT_AMOUNT:([0-9.]+)\]/);
        const vatRateMatch = cleanNote.match(/\[VAT_RATE:([0-9.]+)\]/);
        const pretaxTagMatch = cleanNote.match(/\[PRETAX:([0-9.]+)\]/);
        
        if (preTaxMatch) {
            preTax = preTaxMatch[1];
            cleanNote = cleanNote.replace(preTaxMatch[0], '');
        } else if (pretaxTagMatch) {
            preTax = pretaxTagMatch[1];
            cleanNote = cleanNote.replace(pretaxTagMatch[0], '');
        }
        if (vatAmountMatch) {
            vatAmount = vatAmountMatch[1];
            cleanNote = cleanNote.replace(vatAmountMatch[0], '');
        } else if (vatRateMatch) {
            const rawRate = parseFloat(vatRateMatch[1]) || 0;
            cleanNote = cleanNote.replace(vatRateMatch[0], '');
            if (rawRate > 100) {
                vatAmount = rawRate;
            } else {
                vatAmount = (parseFloat(preTax) || 0) * (rawRate / 100);
            }
        }

        const postTaxVal = getDebtPostTaxAmount(debt);
        if (!vatAmount && preTax) {
            vatAmount = Math.max(0, postTaxVal - (parseFloat(preTax) || 0));
        }
        
        setFormData({
            project_name: debt.project_name,
            partner_name: debt.partner_name,
            debt_type: debt.debt_type,
            amount_before_tax: preTax ? String(preTax) : '',
            vat_amount: vatAmount ? String(vatAmount) : String(Math.max(0, postTaxVal - (parseFloat(preTax) || 0))),
            amount_after_tax: postTaxVal ? String(postTaxVal) : '',
            note: cleanNote.trim()
        });
        setEditingId(debt.id);
        setShowAddForm(true);
    };

    const removeAccents = (str) => {
        if (!str) return '';
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
    };

    const filteredDebts = useMemo(() => {
        if (!debts) return [];
        return debts.filter(d => {
            if (filterType !== 'ALL' && d.debt_type !== filterType) return false;
            
            if (activeCategory === 'LICH_SU') {
                if (d.status !== 'ĐÃ XONG') return false;
            } else {
                if (filterStatus !== 'ALL' && d.status !== filterStatus) return false;
                const isVatTu = d.note && d.note.includes('[VẬT TƯ]');
                if (activeCategory === 'VAT_TU' && !isVatTu) return false;
                if (activeCategory === 'TO_DOI' && isVatTu) return false;
            }
            
            if (searchTerm) {
                const term = removeAccents(searchTerm.toLowerCase());
                const pName = removeAccents((d.partner_name || '').toLowerCase());
                const pProject = removeAccents((d.project_name || '').toLowerCase());
                const pNote = removeAccents((d.note || '').toLowerCase());
                const pCreator = removeAccents((d.created_by || '').toLowerCase());
                
                return (
                    pName.includes(term) ||
                    pProject.includes(term) ||
                    pNote.includes(term) ||
                    pCreator.includes(term)
                );
            }
            return true;
        });
    }, [debts, filterType, filterStatus, activeCategory, searchTerm]);

    const totalNeedToCollect = filteredDebts.filter(d => d.debt_type === 'CẦN THU' && (activeCategory === 'LICH_SU' ? d.status === 'ĐÃ XONG' : d.status === 'CHƯA XONG')).reduce((sum, d) => sum + getDebtPostTaxAmount(d), 0);
    const totalNeedToPay = filteredDebts.filter(d => d.debt_type === 'CẦN TRẢ' && (activeCategory === 'LICH_SU' ? d.status === 'ĐÃ XONG' : d.status === 'CHƯA XONG')).reduce((sum, d) => sum + getDebtPostTaxAmount(d), 0);

    const isAdminOrManager = ['ADMIN', 'GIÁM ĐỐC', 'PHÓ GIÁM ĐỐC', 'KẾ TOÁN TRƯỞNG', 'KẾ TOÁN', 'KẾ TOÁN THUẾ', 'KẾ TOÁN TỔNG HỢP', 'KẾ TOÁN VẬT TƯ'].includes(currentUser?.role?.toUpperCase());

    return (
        <div className="w-full animate-in fade-in duration-500">
            <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Filter className="text-blue-600" /> Quản Lý Công Nợ Đối Tác / Tổ Đội
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Theo dõi các khoản cần thu và cần trả độc lập với quỹ thu chi.</p>
                </div>
                {!showAddForm && (
                    <div className="flex gap-2 w-full sm:w-auto">
                        <button 
                            onClick={() => {
                                const table = document.getElementById('partner-debts-table');
                                if (!table) return;
                                const html = table.outerHTML;
                                const blob = new Blob([`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"></head><body>${html}</body></html>`], { type: 'application/vnd.ms-excel;charset=utf-8' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = 'Cong_No_To_Doi.xls';
                                a.click();
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold transition shadow-sm flex items-center gap-2"
                            title="Xuất Excel"
                        >
                            <Save size={18} /> Xuất Excel
                        </button>
                        <button 
                            onClick={() => window.print()}
                            className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl font-bold transition shadow-sm flex items-center gap-2"
                            title="In danh sách"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg> In
                        </button>
                        <button 
                            onClick={() => setShowAddForm(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold transition shadow-lg flex items-center gap-2"
                        >
                            <PlusCircle size={18} /> Thêm Công Nợ
                        </button>
                    </div>
                )}
            </header>

            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
                <button
                    onClick={() => setActiveCategory('ALL')}
                    className={`px-6 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${
                        activeCategory === 'ALL'
                            ? 'bg-slate-800 text-white shadow-lg'
                            : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
                    }`}
                >
                    TẤT CẢ SỔ CÔNG NỢ
                </button>
                <button
                    onClick={() => setActiveCategory('TO_DOI')}
                    className={`px-6 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${
                        activeCategory === 'TO_DOI'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                            : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
                    }`}
                >
                    CÔNG NỢ TỔ ĐỘI / NHÂN CÔNG
                </button>
                <button
                    onClick={() => setActiveCategory('VAT_TU')}
                    className={`px-6 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${
                        activeCategory === 'VAT_TU'
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                            : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
                    }`}
                >
                    CÔNG NỢ VẬT TƯ / THIẾT BỊ
                </button>
                <button
                    onClick={() => setActiveCategory('LICH_SU')}
                    className={`px-6 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${
                        activeCategory === 'LICH_SU'
                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                            : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
                    }`}
                >
                    LỊCH SỬ (ĐÃ HOÀN THÀNH)
                </button>
            </div>

            {showAddForm && (
                <div className="fixed inset-0 z-[120] bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="bg-white w-full max-w-6xl max-h-[90vh] overflow-y-auto p-6 rounded-2xl shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-black text-lg">Ghi Nhận Công Nợ Mới</h3>
                        <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-600 p-1"><X size={20}/></button>
                    </div>
                    
                    {formError && <div className="mb-4 text-red-500 font-bold text-sm bg-red-50 p-3 rounded-xl border border-red-100">{formError}</div>}
                    
                    <form onSubmit={handleAddSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Loại Công Nợ</label>
                                <select name="debt_type" value={formData.debt_type} onChange={handleFormChange} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 font-bold focus:border-blue-500 outline-none">
                                    <option value="CẦN THU">Khoản Cần Thu (Thu về)</option>
                                    <option value="CẦN TRẢ">Khoản Cần Trả (Chi ra)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Công Trình</label>
                                <select name="project_name" value={formData.project_name} onChange={handleFormChange} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 font-bold focus:border-blue-500 outline-none">
                                    {projects.map(p => {
                                        const isCompleted = p.status === 'Finish';
                                        const isCurrentProject = formData.project_name === p.name;
                                        return (
                                            <option key={p.name} value={p.name} disabled={isCompleted && !isCurrentProject}>
                                                {p.name} {isCompleted ? ' (FINISH - ĐÃ KHÓA)' : ''}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Đối tượng / Tổ đội</label>
                                <input type="text" name="partner_name" value={formData.partner_name} onChange={handleFormChange} placeholder="Nhập tên..." className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 font-bold focus:border-blue-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Số Tiền Sau Thuế (VNĐ) <span className="text-red-500">*</span></label>
                                <input 
                                    type="number" 
                                    name="amount_after_tax" 
                                    value={formData.amount_after_tax} 
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        const postTaxNum = parseFloat(val) || 0;
                                        const preTaxNum = parseFloat(formData.amount_before_tax) || 0;
                                        const vatNum = postTaxNum - preTaxNum;
                                        setFormData(prev => ({
                                            ...prev,
                                            amount_after_tax: val,
                                            vat_amount: vatNum >= 0 ? String(vatNum) : '0'
                                        }));
                                    }} 
                                    placeholder="Nhập tổng sau thuế..." 
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 font-black text-emerald-600 text-base focus:border-blue-500 outline-none" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Số Tiền VAT (VNĐ)</label>
                                <input 
                                    type="number" 
                                    name="vat_amount" 
                                    value={formData.vat_amount} 
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        const vatNum = parseFloat(val) || 0;
                                        const preTaxNum = parseFloat(formData.amount_before_tax) || 0;
                                        setFormData(prev => ({
                                            ...prev,
                                            vat_amount: val,
                                            amount_after_tax: String(preTaxNum + vatNum)
                                        }));
                                    }} 
                                    placeholder="0" 
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 font-bold text-blue-600 focus:border-blue-500 outline-none" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Số Tiền (Trước thuế - Tham khảo)</label>
                                <input 
                                    type="number" 
                                    name="amount_before_tax" 
                                    value={formData.amount_before_tax} 
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        const preTaxNum = parseFloat(val) || 0;
                                        const vatNum = parseFloat(formData.vat_amount) || 0;
                                        setFormData(prev => ({
                                            ...prev,
                                            amount_before_tax: val,
                                            amount_after_tax: String(preTaxNum + vatNum)
                                        }));
                                    }} 
                                    placeholder="0" 
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 font-bold text-slate-600 focus:border-blue-500 outline-none" 
                                />
                            </div>
                        </div>
                        <div>
                            <div className="mb-2 text-right">
                                <span className="text-xs text-slate-500 font-bold uppercase">Tổng Thực Tế (Sau thuế): </span>
                                <span className="text-lg font-black text-blue-600">{formatCurrency(parseFloat(formData.amount_after_tax) || ((parseFloat(formData.amount_before_tax) || 0) + (parseFloat(formData.vat_amount) || 0)))} VNĐ</span>
                            </div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ghi Chú</label>
                            <input type="text" name="note" value={formData.note} onChange={handleFormChange} placeholder="Lý do ghi nhận công nợ..." className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 focus:border-blue-500 outline-none" />
                        </div>
                        <div className="flex justify-end pt-2 gap-2">
                            <button type="button" onClick={() => { setShowAddForm(false); setEditingId(null); }} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition">
                                <X size={18} /> Hủy
                            </button>
                            <button type="submit" disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg disabled:opacity-50">
                                <Save size={18} /> {editingId ? 'Cập Nhật' : 'Lưu Công Nợ'}
                            </button>
                        </div>
                    </form>
                </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">
                            {activeCategory === 'LICH_SU' ? 'Tổng Đã Thu (Hoàn Thành)' : 'Tổng Còn Phải Thu (Sau Thuế)'}
                        </p>
                        <p className="text-2xl font-black text-emerald-600">{formatCurrency(totalNeedToCollect)}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500"><PlusCircle size={20}/></div>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">
                            {activeCategory === 'LICH_SU' ? 'Tổng Đã Trả (Hoàn Thành)' : 'Tổng Còn Phải Trả (Sau Thuế)'}
                        </p>
                        <p className="text-2xl font-black text-red-600">{formatCurrency(totalNeedToPay)}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500"><Clock size={20}/></div>
                </div>
                
                {/* Search and Filter */}
                <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-center gap-2">
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button onClick={() => setFilterStatus('ALL')} className={`flex-1 text-xs font-bold py-1.5 rounded-lg transition ${filterStatus === 'ALL' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Tất cả</button>
                        <button onClick={() => setFilterStatus('CHƯA XONG')} className={`flex-1 text-xs font-bold py-1.5 rounded-lg transition ${filterStatus === 'CHƯA XONG' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Chưa Xong</button>
                        <button onClick={() => setFilterStatus('ĐÃ XONG')} className={`flex-1 text-xs font-bold py-1.5 rounded-lg transition ${filterStatus === 'ĐÃ XONG' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Đã Xong</button>
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button onClick={() => setFilterType('ALL')} className={`flex-1 text-xs font-bold py-1.5 rounded-lg transition ${filterType === 'ALL' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Tất cả loại</button>
                        <button onClick={() => setFilterType('CẦN TRẢ')} className={`flex-1 text-xs font-bold py-1.5 rounded-lg transition ${filterType === 'CẦN TRẢ' ? 'bg-red-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Cần trả</button>
                        <button onClick={() => setFilterType('CẦN THU')} className={`flex-1 text-xs font-bold py-1.5 rounded-lg transition ${filterType === 'CẦN THU' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Cần thu</button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input 
                            type="text" 
                            placeholder="Tìm kiếm đối tượng, công trình..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-sm outline-none focus:border-blue-500 transition"
                        />
                    </div>
                </div>
            </div>

            {/* Bảng Dữ Liệu */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:shadow-none print:border-none">
                <div className="overflow-auto max-h-[calc(100vh-260px)] print:overflow-visible print:max-h-none">
                    <table id="partner-debts-table" className="w-full text-left border-collapse min-w-[800px] print:min-w-0 print:text-[12px]">
                        <thead className="sticky top-0 z-20">
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 shadow-sm">
                                <th className="p-4 font-black">Ngày Ghi Nhận</th>
                                <th className="p-4 font-black">Loại</th>
                                <th className="p-4 font-black">Công Trình</th>
                                <th className="p-4 font-black">Đối Tượng / Tổ Đội</th>
                                <th className="p-4 font-black text-right">Số Tiền Sau Thuế (VNĐ)</th>
                                <th className="p-4 font-black text-center">Trạng Thái</th>
                                <th className="p-4 font-black text-center">Người Nhập</th>
                                <th className="p-4 font-black text-center">Thao Tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredDebts.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="p-8 text-center text-slate-400 font-bold">Chưa có dữ liệu công nợ nào.</td>
                                </tr>
                            ) : (
                                filteredDebts.map(debt => {
                                    const recordedAt = formatRecordedDateTime(debt.created_at);
                                    return (
                                    <tr id={"row-" + debt.id} key={debt.id} className="hover:bg-slate-50/80 transition group">
                                        <td className="p-4 text-sm text-slate-500 whitespace-nowrap">
                                            <div className="font-semibold text-slate-600">{recordedAt.date}</div>
                                            {recordedAt.time && <div className="mt-0.5 text-[11px] font-mono text-slate-400">{recordedAt.time}</div>}
                                        </td>
                                        <td className="p-4">
                                            <span className={`text-xs font-black px-2 py-1 rounded-md border ${debt.debt_type === 'CẦN THU' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                                {debt.debt_type}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm font-bold text-slate-700">{debt.project_name}</td>
                                        <td className="p-4">
                                            <p className="text-sm font-bold text-slate-800">{debt.partner_name}</p>
                                            {debt.note && (
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <p className="text-xs text-slate-400">{debt.note.split('[PAYLOAD]')[0]}</p>
                                                    {(() => {
                                                        const matchedDntt = getDebtDntt(debt.note);
                                                        if (matchedDntt) {
                                                            return (
                                                                <button onClick={() => setViewDnttModal(matchedDntt)} className="text-blue-500 hover:text-blue-700 p-1 bg-blue-50 hover:bg-blue-100 rounded-lg transition" title="Xem chi tiết đơn">
                                                                    <Eye size={14} />
                                                                </button>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-right font-black text-slate-800">{formatCurrency(getDebtPostTaxAmount(debt))}</td>
                                        <td className="p-4 text-center">
                                            {debt.status === 'ĐÃ XONG' ? (
                                                <button 
                                                    onClick={() => onUpdateDebtStatus(debt, 'CHƯA XONG')}
                                                    className="inline-flex items-center gap-1 text-xs font-bold bg-green-100 hover:bg-amber-100 text-green-700 hover:text-amber-800 px-3 py-1.5 rounded-full transition shadow-sm cursor-pointer border border-green-200"
                                                    title="Nhấn để chuyển lại thành Chưa Xong"
                                                >
                                                    <CheckCircle size={12} /> Đã Xong
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => setConfirmDebtModal({ isOpen: true, debt })}
                                                    className="inline-flex items-center gap-1 text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1.5 rounded-full transition shadow-sm cursor-pointer border border-amber-300 hover:scale-105 active:scale-95"
                                                    title="Nhấn vào đây để xác nhận đã hoàn thành công nợ"
                                                >
                                                    <Clock size={12} /> Chưa Xong
                                                </button>
                                            )}
                                        </td>
                                        <td className="p-4 text-center text-sm font-bold text-slate-700">
                                            {debt.created_by || 'admin'}
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button 
                                                    onClick={() => handleEditDebt(debt)}
                                                    className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition"
                                                    title="Sửa công nợ"
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                                </button>
                                                {(() => {
                                                    const isPendingDelete = deleteRequests.some(r => r.original_table === 'partner_debts' && r.record_id === debt.id);
                                                    if (isPendingDelete) {
                                                        return (
                                                            <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded whitespace-nowrap">
                                                                Chờ xóa
                                                            </span>
                                                        );
                                                    }
                                                    const isAuthorizer = currentUser?.role?.toUpperCase() === 'ADMIN';
                                                    return (
                                                        <button 
                                                            onClick={() => {
                                                                if (isAuthorizer) {
                                                                    setConfirmModal({
                                                                        isOpen: true,
                                                                        message: `Bạn có chắc chắn muốn chuyển khoản công nợ của [${debt.partner_name}] vào thùng rác?`,
                                                                        onConfirm: () => {
                                                                            onDeleteDebt(debt.id);
                                                                            setConfirmModal({ isOpen: false, message: '', onConfirm: null });
                                                                        }
                                                                    });
                                                                } else {
                                                                    onDeleteDebt(debt.id);
                                                                }
                                                            }}
                                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                                            title={isAuthorizer ? "Xóa công nợ" : "Đề nghị xóa công nợ"}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    );
                                                })()}
                                            </div>
                                        </td>
                                    </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <ConfirmModal 
                isOpen={confirmModal.isOpen} 
                message={confirmModal.message} 
                onConfirm={confirmModal.onConfirm} 
                onCancel={() => setConfirmModal({ isOpen: false, message: '', onConfirm: null })} 
            />

            {confirmDebtModal.isOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 border border-slate-100">
                        <div className="p-8">
                            <h3 className="text-xl font-black text-slate-800 mb-4 flex items-center gap-2"><CheckCircle className="text-emerald-500" /> Xác nhận đã hoàn thành</h3>
                            <p className="text-slate-600 mb-6 font-medium leading-relaxed text-sm">
                                Bạn có chắc chắn muốn xác nhận đã hoàn thành công nợ của <b>{confirmDebtModal.debt?.partner_name}</b> ({formatCurrency(getDebtPostTaxAmount(confirmDebtModal.debt))} VNĐ - <b>{confirmDebtModal.debt?.debt_type === 'CẦN THU' ? 'ĐÃ THU' : 'ĐÃ THANH TOÁN'}</b>)?
                            </p>
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => {
                                        onUpdateDebtStatus(confirmDebtModal.debt, 'ĐÃ XONG');
                                        setConfirmDebtModal({ isOpen: false, debt: null });
                                    }}
                                    className="w-full py-3.5 bg-emerald-600 text-white hover:bg-emerald-700 font-bold rounded-2xl transition shadow-lg shadow-emerald-600/20 flex justify-center items-center gap-2 text-base"
                                >
                                    <CheckCircle size={20} /> XÁC NHẬN ĐÃ HOÀN THÀNH
                                </button>
                                <button
                                    onClick={() => setConfirmDebtModal({ isOpen: false, debt: null })}
                                    className="w-full py-3 text-slate-500 hover:bg-slate-100 font-bold rounded-2xl transition"
                                >
                                    Hủy bỏ
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {viewDnttModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 border border-slate-100">
                        <div className="p-4 sm:p-6 border-b flex justify-between items-center bg-slate-50">
                            <h3 className="text-lg sm:text-xl font-black text-slate-800 flex items-center gap-2">
                                <Eye className="text-blue-500"/> Chi tiết [{viewDnttModal.doc_type || 'Đơn Vật Tư'}]
                            </h3>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => window.print()} 
                                    className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold rounded-xl flex items-center gap-2 transition text-sm"
                                >
                                    <Printer size={16} /> In đơn
                                </button>
                                <button onClick={() => setViewDnttModal(null)} className="text-slate-400 hover:text-slate-600 p-2">
                                    <X size={20}/>
                                </button>
                            </div>
                        </div>
                        
                        <div className="p-6 overflow-auto custom-scrollbar bg-slate-100 print:bg-white print:p-0">
                            {(() => {
                                let parsed;
                                try {
                                    parsed = typeof viewDnttModal.reason === 'string' ? JSON.parse(viewDnttModal.reason) : viewDnttModal.reason;
                                } catch(e) {
                                    return <div className="text-slate-600 font-medium p-4 bg-white rounded-xl border border-slate-200">{viewDnttModal.reason || 'Không có ghi chú thêm'}</div>;
                                }

                                const isMaterialOrder = viewDnttModal.doc_type === 'Đơn Vật Tư' || (parsed && parsed.docType === 'Đơn Vật Tư');
                                
                                const parseItemDetails = (item) => {
                                    let name = item.name || item.content || '';
                                    let colorCode = item.colorCode || item.color_code || '';
                                    let unit = item.unit || item.dvt || '';
                                    let qty = item.quantity || item.qty || item.sl || '';
                                    let price = item.price || 0;
                                    let total = item.total || item.amount || 0;

                                    if (typeof item.content === 'string') {
                                        const nameMatch = item.content.match(/- Tên vật tư:\s*([^\n]+)/);
                                        if (nameMatch) name = nameMatch[1].trim();

                                        const colorMatch = item.content.match(/- Mã màu:\s*([^\n]+)/);
                                        if (colorMatch) colorCode = colorMatch[1].trim();

                                        const unitMatch = item.content.match(/- Đơn vị:\s*([^\n]+)/);
                                        if (unitMatch) unit = unitMatch[1].trim();

                                        const slMatch = item.content.match(/- SL:\s*([^\n]+)/);
                                        if (slMatch) qty = slMatch[1].trim();

                                        const priceMatch = item.content.match(/- Đơn giá:\s*([^\n]+)/);
                                        if (priceMatch) price = priceMatch[1].trim();
                                    }

                                    const qtyNum = parseFloat(qty) || 0;
                                    const priceNum = typeof price === 'number' ? price : (parseFloat(String(price).replace(/[^0-9.]/g, '')) || 0);
                                    const totalNum = total ? (parseFloat(total) || 0) : (qtyNum * priceNum);

                                    return { name, colorCode, unit, qty: qtyNum, price: priceNum, total: totalNum };
                                };

                                const filterValidItems = (itemsList) => {
                                    if (!Array.isArray(itemsList)) return [];
                                    return itemsList.map(it => parseItemDetails(it)).filter(it => it.qty > 0 || it.total > 0);
                                };

                                let categories = [];
                                let flatItems = [];

                                if (isMaterialOrder && Array.isArray(parsed?.items) && parsed.items.length > 0 && Array.isArray(parsed.items[0]?.items)) {
                                    categories = parsed.items.map(cat => ({
                                        name: cat.categoryName || cat.name || 'HỆ VẬT TƯ',
                                        items: filterValidItems(cat.items)
                                    })).filter(cat => cat.items.length > 0);
                                } else if (Array.isArray(parsed?.items)) {
                                    flatItems = filterValidItems(parsed.items);
                                }

                                const hasData = categories.length > 0 || flatItems.length > 0;

                                let subtotal = 0;
                                if (categories.length > 0) {
                                    subtotal = categories.reduce((sum, cat) => sum + cat.items.reduce((s, it) => s + it.total, 0), 0);
                                } else if (flatItems.length > 0) {
                                    subtotal = flatItems.reduce((sum, it) => sum + it.total, 0);
                                }

                                const vat = subtotal > 0 ? Math.round(subtotal * 0.08) : 0;
                                const totalAfterTax = subtotal > 0 ? (subtotal + vat) : (parseFloat(viewDnttModal.total_amount || parsed?.totalAmount) || 0);
                                const orderPhaseStr = parsed?.orderPhase || (viewDnttModal.note?.match(/(?:ĐỢT|Đợt)\s*\d+/i)?.[0]) || '';

                                return (
                                    <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm print:p-0 print:border-none print:shadow-none font-sans">
                                        <div className="text-center mb-6 border-b pb-4 border-slate-200">
                                            <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-wide">
                                                ĐƠN ĐẶT HÀNG VẬT TƯ SƠN NƯỚC {orderPhaseStr.toUpperCase()}
                                            </h2>
                                        </div>

                                        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm border-l-4 border-amber-500 pl-4 py-2 bg-amber-50/60 rounded-r-xl">
                                            <p><strong>DỰ ÁN:</strong> <span className="font-bold text-blue-700 uppercase">{viewDnttModal.project_name || parsed?.project || '-'}</span></p>
                                            <p><strong>NGƯỜI NHẬN HÀNG:</strong> <span className="font-bold text-slate-800">{viewDnttModal.recipient || parsed?.recipient || parsed?.supplier || '-'}</span></p>
                                            <p><strong>HẠNG MỤC:</strong> <span className="font-bold text-slate-800">SƠN NƯỚC</span></p>
                                            <p><strong>ĐỢT:</strong> <span className="font-bold text-slate-800">{orderPhaseStr || 'ĐỢT 1'}</span></p>
                                        </div>

                                        <div className="overflow-x-auto border border-slate-300 rounded-lg">
                                            <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[700px]">
                                                <thead>
                                                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 uppercase font-black">
                                                        <th className="p-2.5 text-center border-r border-slate-300 w-12">STT</th>
                                                        <th className="p-2.5 border-r border-slate-300">Chủng loại vật tư</th>
                                                        <th className="p-2.5 border-r border-slate-300 text-center w-28">Mã màu</th>
                                                        <th className="p-2.5 border-r border-slate-300 text-center w-24">ĐVT</th>
                                                        <th className="p-2.5 border-r border-slate-300 text-right w-24">Số lượng</th>
                                                        <th className="p-2.5 border-r border-slate-300 text-right w-32">Đơn giá</th>
                                                        <th className="p-2.5 text-right w-36">Thành tiền</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200">
                                                    {!hasData ? (
                                                        <tr>
                                                            <td colSpan={7} className="p-8 text-center text-slate-400 font-bold">
                                                                Không có mặt hàng nào được đặt (Số lượng = 0)
                                                            </td>
                                                        </tr>
                                                    ) : categories.length > 0 ? (
                                                        categories.map((cat, catIdx) => {
                                                            let runningStt = 1;
                                                            return (
                                                                <React.Fragment key={catIdx}>
                                                                    <tr className="bg-slate-100/90 font-black border-y border-slate-300">
                                                                        <td colSpan={7} className="p-2.5 text-center text-slate-800 uppercase tracking-wider bg-slate-200/80">
                                                                            {cat.name}
                                                                        </td>
                                                                    </tr>
                                                                    {cat.items.map((item, itemIdx) => (
                                                                        <tr key={itemIdx} className="hover:bg-slate-50 transition">
                                                                            <td className="p-2.5 text-center text-slate-500 border-r border-slate-200">{runningStt++}</td>
                                                                            <td className="p-2.5 font-bold text-slate-800 border-r border-slate-200">{item.name}</td>
                                                                            <td className="p-2.5 text-center text-slate-600 border-r border-slate-200">{item.colorCode || '-'}</td>
                                                                            <td className="p-2.5 text-center text-slate-600 border-r border-slate-200">{item.unit || '-'}</td>
                                                                            <td className="p-2.5 text-right font-bold text-blue-700 border-r border-slate-200">{item.qty ? formatCurrency(item.qty).replace(' ₫', '') : '-'}</td>
                                                                            <td className="p-2.5 text-right text-slate-700 border-r border-slate-200">{item.price ? formatCurrency(item.price) : '-'}</td>
                                                                            <td className="p-2.5 text-right font-black text-slate-800">{formatCurrency(item.total)}</td>
                                                                        </tr>
                                                                    ))}
                                                                </React.Fragment>
                                                            );
                                                        })
                                                    ) : (
                                                        flatItems.map((item, itemIdx) => (
                                                            <tr key={itemIdx} className="hover:bg-slate-50 transition">
                                                                <td className="p-2.5 text-center text-slate-500 border-r border-slate-200">{itemIdx + 1}</td>
                                                                <td className="p-2.5 font-bold text-slate-800 border-r border-slate-200">{item.name}</td>
                                                                <td className="p-2.5 text-center text-slate-600 border-r border-slate-200">{item.colorCode || '-'}</td>
                                                                <td className="p-2.5 text-center text-slate-600 border-r border-slate-200">{item.unit || '-'}</td>
                                                                <td className="p-2.5 text-right font-bold text-blue-700 border-r border-slate-200">{item.qty ? formatCurrency(item.qty).replace(' ₫', '') : '-'}</td>
                                                                <td className="p-2.5 text-right text-slate-700 border-r border-slate-200">{item.price ? formatCurrency(item.price) : '-'}</td>
                                                                <td className="p-2.5 text-right font-black text-slate-800">{formatCurrency(item.total)}</td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                                <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                                                    <tr>
                                                        <td colSpan={6} className="p-2.5 text-right uppercase text-xs font-black text-slate-600 border-r border-slate-300">TỔNG TRƯỚC THUẾ:</td>
                                                        <td className="p-2.5 text-right font-black text-slate-800">{formatCurrency(subtotal)}</td>
                                                    </tr>
                                                    <tr>
                                                        <td colSpan={6} className="p-2.5 text-right uppercase text-xs font-black text-slate-600 border-r border-slate-300">THUẾ VAT (8%):</td>
                                                        <td className="p-2.5 text-right font-black text-slate-800">{formatCurrency(vat)}</td>
                                                    </tr>
                                                    <tr className="bg-blue-50/90 text-blue-950 text-sm">
                                                        <td colSpan={6} className="p-3 text-right uppercase font-black border-r border-blue-200">TỔNG CỘNG (SAU THUẾ):</td>
                                                        <td className="p-3 text-right font-black text-blue-700 text-base">{formatCurrency(totalAfterTax)}</td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                        
                        <div className="p-4 border-t flex justify-end bg-white">
                            <button onClick={() => setViewDnttModal(null)} className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition">Đóng lại</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
