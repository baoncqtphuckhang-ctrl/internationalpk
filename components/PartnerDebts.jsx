import React, { useState, useMemo } from 'react';
import { formatCurrency, formatDateVN } from '@/lib/utils';
import { PlusCircle, Search, CheckCircle, Clock, Trash2, Filter, Save, X } from 'lucide-react';
import ConfirmModal from './ConfirmModal';

export default function PartnerDebts({ 
    debts, 
    projects, 
    onAddDebt, 
    onUpdateDebtStatus, 
    onDeleteDebt,
    isLoading,
    currentUser 
}) {
    const [confirmDebtModal, setConfirmDebtModal] = useState({ isOpen: false, debt: null });
    const [debtAccount, setDebtAccount] = useState('131 - Công nợ phải thu');

    const [filterType, setFilterType] = useState('ALL'); // ALL, CẦN THU, CẦN TRẢ
    const [filterStatus, setFilterStatus] = useState('CHƯA XONG'); // ALL, CHƯA XONG, ĐÃ XONG
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

    const filteredDebts = useMemo(() => {
        if (!debts) return [];
        return debts.filter(d => {
            if (filterType !== 'ALL' && d.debt_type !== filterType) return false;
            if (filterStatus !== 'ALL' && d.status !== filterStatus) return false;
            
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                return (
                    d.partner_name.toLowerCase().includes(term) ||
                    d.project_name.toLowerCase().includes(term) ||
                    (d.note && d.note.toLowerCase().includes(term))
                );
            }
            return true;
        });
    }, [debts, filterType, filterStatus, searchTerm]);

    const totalNeedToCollect = filteredDebts.filter(d => d.debt_type === 'CẦN THU' && d.status === 'CHƯA XONG').reduce((sum, d) => sum + Number(d.amount), 0);
    const totalNeedToPay = filteredDebts.filter(d => d.debt_type === 'CẦN TRẢ' && d.status === 'CHƯA XONG').reduce((sum, d) => sum + Number(d.amount), 0);

    const isAdminOrManager = ['ADMIN', 'GIÁM ĐỐC', 'PHÓ GIÁM ĐỐC', 'KẾ TOÁN TRƯỞNG', 'KẾ TOÁN'].includes(currentUser?.role?.toUpperCase());

    return (
        <div className="max-w-6xl mx-auto animate-in fade-in duration-500">
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
                                    {projects.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
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
                <div className="overflow-x-auto print:overflow-visible">
                    <table id="partner-debts-table" className="w-full text-left border-collapse min-w-[800px] print:min-w-0 print:text-[12px]">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
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
                                    <tr key={debt.id} className="hover:bg-slate-50/80 transition group">
                                        <td className="p-4 text-sm text-slate-500">{formatDateVN(debt.created_at)}</td>
                                        <td className="p-4">
                                            <span className={`text-xs font-black px-2 py-1 rounded-md border ${debt.debt_type === 'CẦN THU' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                                {debt.debt_type}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm font-bold text-slate-700">{debt.project_name}</td>
                                        <td className="p-4">
                                            <p className="text-sm font-bold text-slate-800">{debt.partner_name}</p>
                                            {debt.note && <p className="text-xs text-slate-400 mt-0.5">{debt.note}</p>}
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
                                                {isAdminOrManager && (
                                                    <button 
                                                        onClick={() => {
                                                            setConfirmModal({
                                                                isOpen: true,
                                                                message: `Bạn có chắc chắn muốn xóa khoản công nợ của [${debt.partner_name}]?`,
                                                                onConfirm: () => {
                                                                    onDeleteDebt(debt.id);
                                                                    setConfirmModal({ isOpen: false, message: '', onConfirm: null });
                                                                }
                                                            });
                                                        }}
                                                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                                        title="Xóa công nợ"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
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
                                Vui lòng chọn tài khoản đối ứng (nếu có):
                            </p>
                            <div className="mb-8">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tài khoản đối ứng</label>
                                <select 
                                    value={debtAccount} 
                                    onChange={(e) => setDebtAccount(e.target.value)}
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-3 font-bold focus:border-blue-500 outline-none"
                                >
                                    <option value="">-- Bỏ qua / Không ghi nhận giao dịch --</option>
                                    <option value="111 - Tiền mặt">111 - Tiền mặt</option>
                                    <option value="112 - Tiền gửi NH">112 - Tiền gửi NH</option>
                                    <option value="131 - Công nợ phải thu">131 - Công nợ phải thu</option>
                                    <option value="141 - Tạm ứng">141 - Tạm ứng</option>
                                    <option value="331 - Phải trả người bán">331 - Phải trả người bán</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => {
                                        onUpdateDebtStatus(confirmDebtModal.debt, 'ĐÃ XONG', debtAccount);
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
        </div>
    );
}
