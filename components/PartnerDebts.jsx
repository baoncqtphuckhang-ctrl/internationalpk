import React, { useState, useMemo } from 'react';
import { formatCurrency, formatDateVN } from '@/lib/utils';
import { PlusCircle, Search, CheckCircle, Clock, Trash2, Filter, Save, X, Eye } from 'lucide-react';
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
        amount: '',
        note: ''
    });
    
    const [formError, setFormError] = useState('');
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });
    const [viewDnttModal, setViewDnttModal] = useState(null);

    const getDebtDntt = (note) => {
        if (!note || !dnttList) return null;
        const noteStr = note.split('[PAYLOAD]')[0];
        const match = noteStr.match(/\[(.*?)\]\s*([a-f0-9\-]{8,})/i);
        if (!match) return null;
        const shortId = match[2];
        return dnttList.find(d => d.id.startsWith(shortId));
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
        if (!formData.amount || parseFloat(formData.amount) <= 0) return setFormError('Số tiền phải lớn hơn 0!');
        
        onAddDebt({
            ...formData,
            amount: parseFloat(formData.amount),
            status: 'CHƯA XONG'
        });
        
        setShowAddForm(false);
        setFormData({
            project_name: projects[0]?.name || '',
            partner_name: '',
            debt_type: 'CẦN THU',
            amount: '',
            note: ''
        });
    };

    const removeAccents = (str) => {
        if (!str) return '';
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
    };

    const filteredDebts = useMemo(() => {
        if (!debts) return [];
        return debts.filter(d => {
            if (filterType !== 'ALL' && d.debt_type !== filterType) return false;
            if (filterStatus !== 'ALL' && d.status !== filterStatus) return false;
            
            const isVatTu = d.note && d.note.includes('[VẬT TƯ]');
            if (activeCategory === 'VAT_TU' && !isVatTu) return false;
            if (activeCategory === 'TO_DOI' && isVatTu) return false; // Assume anything not VAT_TU is TO_DOI (including legacy)
            
            if (searchTerm) {
                const term = removeAccents(searchTerm.toLowerCase());
                const pName = removeAccents((d.partner_name || '').toLowerCase());
                const pProject = removeAccents((d.project_name || '').toLowerCase());
                const pNote = removeAccents((d.note || '').toLowerCase());
                
                return (
                    pName.includes(term) ||
                    pProject.includes(term) ||
                    pNote.includes(term)
                );
            }
            return true;
        });
    }, [debts, filterType, filterStatus, activeCategory, searchTerm]);

    const totalNeedToCollect = filteredDebts.filter(d => d.debt_type === 'CẦN THU' && d.status === 'CHƯA XONG').reduce((sum, d) => sum + Number(d.amount), 0);
    const totalNeedToPay = filteredDebts.filter(d => d.debt_type === 'CẦN TRẢ' && d.status === 'CHƯA XONG').reduce((sum, d) => sum + Number(d.amount), 0);

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
            </div>

            {showAddForm && (
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200 mb-8 animate-in slide-in-from-top-4">
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
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Số Tiền (VNĐ)</label>
                                <input type="number" name="amount" value={formData.amount} onChange={handleFormChange} placeholder="0" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 font-bold text-red-600 focus:border-blue-500 outline-none" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ghi Chú</label>
                            <input type="text" name="note" value={formData.note} onChange={handleFormChange} placeholder="Lý do ghi nhận công nợ..." className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 focus:border-blue-500 outline-none" />
                        </div>
                        <div className="flex justify-end pt-2">
                            <button type="submit" disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg disabled:opacity-50">
                                <Save size={18} /> Lưu Công Nợ
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Tổng Còn Phải Thu</p>
                        <p className="text-2xl font-black text-emerald-600">{formatCurrency(totalNeedToCollect)}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500"><PlusCircle size={20}/></div>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Tổng Còn Phải Trả</p>
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
                                <th className="p-4 font-black text-right">Số Tiền (VNĐ)</th>
                                <th className="p-4 font-black text-center">Trạng Thái</th>
                                <th className="p-4 font-black text-center">Thao Tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredDebts.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="p-8 text-center text-slate-400 font-bold">Chưa có dữ liệu công nợ nào.</td>
                                </tr>
                            ) : (
                                filteredDebts.map(debt => (
                                    <tr id={"row-" + debt.id} key={debt.id} className="hover:bg-slate-50/80 transition group">
                                        <td className="p-4 text-sm text-slate-500">{formatDateVN(debt.created_at)}</td>
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
                                        <td className="p-4 text-right font-black text-slate-800">{formatCurrency(debt.amount)}</td>
                                        <td className="p-4 text-center">
                                            {debt.status === 'ĐÃ XONG' ? (
                                                <span className="inline-flex items-center gap-1 text-xs font-bold bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
                                                    <CheckCircle size={12} /> Đã Xong
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-xs font-bold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">
                                                    <Clock size={12} /> Chưa Xong
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                {debt.status === 'CHƯA XONG' && (
                                                    <button 
                                                        onClick={() => setConfirmDebtModal({ isOpen: true, debt })}
                                                        className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition"
                                                        title={`Đánh dấu là ${debt.debt_type === 'CẦN THU' ? 'Đã Thu' : 'Đã Trả'}`}
                                                    >
                                                        <CheckCircle size={16} />
                                                    </button>
                                                )}
                                                {debt.status === 'ĐÃ XONG' && (
                                                    <button 
                                                        onClick={() => onUpdateDebtStatus(debt, 'CHƯA XONG')}
                                                        className="p-1.5 bg-slate-100 text-slate-500 hover:bg-amber-500 hover:text-white rounded-lg transition"
                                                        title="Đánh dấu lại là Chưa Xong"
                                                    >
                                                        <Clock size={16} />
                                                    </button>
                                                )}
                                                {(() => {
                                                    const isPendingDelete = deleteRequests.some(r => r.original_table === 'partner_debts' && r.record_id === debt.id);
                                                    if (isPendingDelete) {
                                                        return (
                                                            <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded whitespace-nowrap">
                                                                Chờ xóa
                                                            </span>
                                                        );
                                                    }
                                                    const isAuthorizer = currentUser?.role?.toUpperCase() === 'ADMIN' || currentUser?.role?.toUpperCase() === 'QS TRƯỞNG';
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
                                ))
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
                            <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2"><CheckCircle className="text-emerald-500" /> Xác nhận công nợ</h3>
                            <p className="text-slate-600 mb-6 font-medium leading-relaxed">
                                Bạn đang đánh dấu công nợ của <b>{confirmDebtModal.debt?.partner_name}</b> là <b>{confirmDebtModal.debt?.debt_type === 'CẦN THU' ? 'ĐÃ THU' : 'ĐÃ THANH TOÁN'}</b>.
                            </p>
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => {
                                        onUpdateDebtStatus(confirmDebtModal.debt, 'ĐÃ XONG');
                                        setConfirmDebtModal({ isOpen: false, debt: null });
                                    }}
                                    className="w-full py-4 bg-emerald-600 text-white hover:bg-emerald-700 font-bold rounded-2xl transition shadow-lg shadow-emerald-600/20 flex justify-center items-center gap-2"
                                >
                                    <CheckCircle size={20} /> XÁC NHẬN
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
                    <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 border border-slate-100">
                        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Eye className="text-blue-500"/> Chi tiết [{viewDnttModal.doc_type}]</h3>
                            <button onClick={() => setViewDnttModal(null)} className="text-slate-400 hover:text-slate-600 p-2"><X size={20}/></button>
                        </div>
                        <div className="p-6 overflow-auto custom-scrollbar bg-slate-50">
                            {(() => {
                                let parsed;
                                try {
                                    parsed = JSON.parse(viewDnttModal.reason);
                                } catch(e) {
                                    return <div className="text-slate-500">{viewDnttModal.reason}</div>;
                                }
                                
                                const isMaterialOrder = viewDnttModal.doc_type === 'Đơn Vật Tư';
                                
                                return (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 bg-white p-4 rounded-xl border border-slate-200">
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-bold">Người đề nghị</p>
                                                <p className="font-bold text-slate-800">{viewDnttModal.recipient}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-bold">Tổng tiền</p>
                                                <p className="font-black text-blue-600 text-lg">{formatCurrency(viewDnttModal.total_amount)} VNĐ</p>
                                            </div>
                                            {isMaterialOrder && parsed.orderPhase && (
                                                <div>
                                                    <p className="text-xs text-slate-500 uppercase font-bold">Đợt đặt hàng</p>
                                                    <p className="font-bold text-slate-800">{parsed.orderPhase}</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-slate-100 text-slate-600">
                                                    <tr>
                                                        <th className="p-3 font-bold border-b border-slate-200 w-12 text-center">STT</th>
                                                        <th className="p-3 font-bold border-b border-slate-200">Nội dung / Tên vật tư</th>
                                                        <th className="p-3 font-bold border-b border-slate-200 w-24">ĐVT</th>
                                                        <th className="p-3 font-bold border-b border-slate-200 text-right w-24">Khối lượng</th>
                                                        <th className="p-3 font-bold border-b border-slate-200 text-right w-32">Đơn giá</th>
                                                        <th className="p-3 font-bold border-b border-slate-200 text-right w-32">Thành tiền</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {isMaterialOrder && Array.isArray(parsed.items) ? (
                                                        parsed.items.map((cat, catIdx) => (
                                                            <React.Fragment key={catIdx}>
                                                                <tr className="bg-slate-50">
                                                                    <td colSpan={6} className="p-3 font-black text-slate-800">{cat.categoryName}</td>
                                                                </tr>
                                                                {cat.items && cat.items.map((item, itemIdx) => (
                                                                    <tr key={itemIdx} className="hover:bg-slate-50/50">
                                                                        <td className="p-3 text-slate-500 text-center">{itemIdx + 1}</td>
                                                                        <td className="p-3 font-medium">{item.name}</td>
                                                                        <td className="p-3 text-slate-500">{item.unit || '-'}</td>
                                                                        <td className="p-3 text-right">{item.quantity || '-'}</td>
                                                                        <td className="p-3 text-right">{item.price ? formatCurrency(item.price) : '-'}</td>
                                                                        <td className="p-3 text-right font-bold text-slate-700">{item.total ? formatCurrency(item.total) : '-'}</td>
                                                                    </tr>
                                                                ))}
                                                            </React.Fragment>
                                                        ))
                                                    ) : (
                                                        Array.isArray(parsed.items) ? parsed.items.map((item, idx) => (
                                                            <tr key={idx} className="hover:bg-slate-50/50">
                                                                <td className="p-3 text-slate-500 text-center">{idx + 1}</td>
                                                                <td className="p-3 font-medium">{item.content}</td>
                                                                <td className="p-3">-</td>
                                                                <td className="p-3">-</td>
                                                                <td className="p-3">-</td>
                                                                <td className="p-3 text-right font-bold text-slate-700">{item.amount ? formatCurrency(item.amount) : '-'}</td>
                                                            </tr>
                                                        )) : (
                                                            <tr><td colSpan={6} className="p-8 text-center text-slate-400">Không có chi tiết</td></tr>
                                                        )
                                                    )}
                                                </tbody>
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
