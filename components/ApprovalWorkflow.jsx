'use client';

import React, { useState, useEffect } from 'react';
import { FileSignature, CheckCircle2, Clock, XCircle, DollarSign, Coins, User, FileText, Send, Check, X, Trash2, Tag, Archive, AlertCircle, Search, Printer } from 'lucide-react';
import { formatCurrency, docSoTiengViet, formatDateVN, EXPENSE_CATEGORIES, parseVietnameseNumber } from '@/lib/utils';
import ConfirmModal from './ConfirmModal';

export default function ApprovalWorkflow({ 
    activeTab,
    currentUser, 
    projects, 
    dnttList, 
    onAddDNTT, 
    onUpdateStatus,
    onAccountDNTT,
    onDeleteApproval,
    isLoading,
    STATUSES,
    ROLES
}) {
    const [view, setView] = useState('list'); // 'list' hoặc 'create'

    useEffect(() => {
        setView('list');
    }, [activeTab]);
    const [filter, setFilter] = useState('active'); // 'active', 'paid', 'accounted'
    const [searchTerm, setSearchTerm] = useState('');
    const [distributeItem, setDistributeItem] = useState(null); // Phiếu đang được hạch toán
    const [distributionData, setDistributionData] = useState([]); // Dữ liệu phân bổ chi tiết
    const [distributeOption, setDistributeOption] = useState('auto'); // 'auto' hoặc 'manual'
    const [formError, setFormError] = useState('');
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });
    const [printItem, setPrintItem] = useState(null); // Phiếu đang xem in
    
    const [dnttData, setDnttData] = useState({
        docType: 'DNTT',
        date: new Date().toISOString().split('T')[0],
        recipient: '',
        project: projects[0]?.name || '',
        items: [{ id: 1, content: '', amount: '', note: '' }],
        paymentMethod: 'chuyen_khoan',
        bankAccountName: '',
        bankAccountNumber: '',
        bankName: '',
        bankBranch: ''
    });

    const handleDnttChange = (e) => {
        if (!e || !e.target) return;
        const { name, value } = e.target;
        setDnttData(prev => ({ ...prev, [name]: value }));
    };

    const handleDnttItemChange = (index, field, value) => { 
        const newItems = [...dnttData.items]; 
        newItems[index][field] = value; 
        setDnttData({ ...dnttData, items: newItems }); 
    };
    
    const addDnttItem = () => { 
        setDnttData(prev => ({ ...prev, items: [...prev.items, { id: Date.now(), content: '', amount: '', note: '' }] })); 
    };
    
    const removeDnttItem = (index) => { 
        if (dnttData.items.length <= 1) return; 
        const newItems = dnttData.items.filter((_, i) => i !== index); 
        setDnttData(prev => ({ ...prev, items: newItems })); 
    };

    const dnttTotalAmount = dnttData.items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

    const handleSubmit = (e) => {
        if(e) e.preventDefault();
        setFormError('');
        if (dnttTotalAmount <= 0) return setFormError("Chưa nhập số tiền thanh toán! Vui lòng điền 'Thành tiền' ở phần A.");
        if (!dnttData.project) return setFormError("Vui lòng chọn Công trình!");

        onAddDNTT({
            doc_type: dnttData.docType,
            project_name: dnttData.project,
            recipient: dnttData.recipient,
            total_amount: dnttTotalAmount,
            reason: JSON.stringify(dnttData)
        });
        setView('list');
    };

    const getPrintDateComponents = (dateStr) => {
        if (!dateStr) return { day: '...', month: '...', year: '...' };
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return { day: '...', month: '...', year: '...' };
        return {
            day: d.getDate().toString().padStart(2, '0'),
            month: (d.getMonth() + 1).toString().padStart(2, '0'),
            year: d.getFullYear().toString()
        };
    };

    const openPrintPreview = (item) => {
        let parsed = null;
        try {
            parsed = JSON.parse(item.reason);
        } catch(e) {
            parsed = {
                docType: item.doc_type === 'DNTU' ? 'DNTU' : 'DNTT',
                date: item.created_at ? item.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
                recipient: item.recipient,
                project: item.project_name,
                items: [{ id: 1, content: item.reason || 'Chi phí', amount: item.total_amount, note: '' }],
                paymentMethod: 'tien_mat',
                bankAccountName: '',
                bankAccountNumber: '',
                bankName: '',
                bankBranch: ''
            };
        }
        setPrintItem({ ...item, parsed });
    };

    const openDistributeModal = (item) => {
        let items = [];
        let paymentMethod = 'tien_mat';
        try {
            const parsed = JSON.parse(item.reason);
            items = parsed.items || [];
            paymentMethod = parsed.paymentMethod || 'tien_mat';
        } catch(e) {
            items = [{ content: item.reason, amount: item.total_amount }];
        }
        
        setDistributeItem({ ...item, paymentMethod });
        setDistributionData(items.map(it => ({
            content: it.content,
            amount: parseFloat(it.amount),
            code: '621', // Mặc định vật tư
            note: it.note || ''
        })));
        setDistributeOption('auto');
    };

    const handleDistributeOptionChange = (option) => {
        setDistributeOption(option);
        if (option === 'auto' && distributeItem) {
            try {
                const parsed = JSON.parse(distributeItem.reason);
                const originalItems = parsed.items || [];
                setDistributionData(prev => prev.map((d, i) => ({
                    ...d,
                    amount: originalItems[i] ? parseFloat(originalItems[i].amount) : 0
                })));
            } catch(e) {
                setDistributionData(prev => [{...prev[0], amount: distributeItem.total_amount}]);
            }
        }
    };

    const handleSaveDistribution = () => {
        const totalSum = distributionData.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
        if (Math.abs(totalSum - distributeItem.total_amount) > 10) {
            setConfirmModal({
                isOpen: true,
                message: "Tổng tiền phân bổ không khớp với tổng tiền phiếu. Bạn vẫn muốn tiếp tục?",
                onConfirm: () => {
                    setConfirmModal({ isOpen: false, message: '', onConfirm: null });
                    onAccountDNTT(distributeItem.id, distributionData.map(d => ({
                        project_name: distributeItem.project_name,
                        code: d.code,
                        debit: parseFloat(d.amount) || 0,
                        note: `[${distributeItem.doc_type}] ${d.content}`,
                        recipient: distributeItem.recipient,
                        corresponding_account: distributeItem.paymentMethod === 'tien_mat' ? '1111' : '1121'
                    })));
                    setDistributeItem(null);
                    setFilter('accounted');
                }
            });
            return;
        }

        const payload = distributionData.map(d => ({
            project_name: distributeItem.project_name,
            code: d.code,
            debit: parseFloat(d.amount) || 0,
            note: `[${distributeItem.doc_type}] ${d.content}`,
            recipient: distributeItem.recipient,
            corresponding_account: distributeItem.paymentMethod === 'tien_mat' ? '1111' : '1121'
        }));

        onAccountDNTT(distributeItem.id, payload);
        setDistributeItem(null);
        setFilter('accounted'); // Chuyển sang tab hoàn tất sau khi xong
    };

    const getStatusStyle = (status) => {
        switch(status) {
            case STATUSES.APPROVED: return 'bg-green-100 text-green-700 border-green-200';
            case STATUSES.REJECTED: return 'bg-red-100 text-red-700 border-red-200';
            case STATUSES.PAID: return 'bg-blue-100 text-blue-700 border-blue-200';
            case STATUSES.ACCOUNTED: return 'bg-slate-100 text-slate-700 border-slate-200';
            default: return 'bg-amber-100 text-amber-700 border-amber-200';
        }
    };

    // Role permissions
    const userRole = currentUser?.role?.toUpperCase();
    const isAdminOrManager = ['ADMIN', 'GIÁM ĐỐC', 'PHÓ GIÁM ĐỐC', 'PHÓ GĐ'].includes(userRole);
    const canApproveQS = isAdminOrManager || ['KẾ TOÁN', 'QS'].includes(userRole);
    const canApproveKT = isAdminOrManager || ['KẾ TOÁN', 'QS'].includes(userRole);
    const canPay = canApproveKT || userRole === 'THƯ KÝ';
    const canAccount = canApproveKT;

    const getDisplayTitle = (item) => {
        let displayTitle = 'Đề nghị thanh toán';
        try {
            const parsed = JSON.parse(item.reason);
            if (parsed.items && parsed.items.length > 0) {
                displayTitle = parsed.items[0].content || 'Đề nghị thanh toán';
            }
        } catch(e) {}
        return displayTitle;
    };

    const filteredList = dnttList.filter(d => {
        // filter by tab status
        if (filter === 'active') {
            if ([STATUSES.PAID, STATUSES.ACCOUNTED, STATUSES.REJECTED].includes(d.status)) return false;
        } else if (filter === 'paid') {
            if (d.status !== STATUSES.PAID) return false;
        } else if (filter === 'accounted') {
            if (d.status !== STATUSES.ACCOUNTED) return false;
        }

        // filter by search term
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const displayTitle = getDisplayTitle(d).toLowerCase();
            return (
                d.project_name.toLowerCase().includes(term) ||
                d.recipient.toLowerCase().includes(term) ||
                d.total_amount.toString().includes(term) ||
                displayTitle.includes(term) ||
                d.doc_type.toLowerCase().includes(term) ||
                d.id.toLowerCase().includes(term)
            );
        }

        return true;
    });

    return (
        <div className="max-w-6xl mx-auto animate-in fade-in duration-500">
            <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FileSignature className="text-blue-600" /> {activeTab === 'dntt' ? 'Lập Phiếu Đề Nghị' : 'Quản Lý Phê Duyệt'}
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">{activeTab === 'dntt' ? 'Tạo đề nghị thanh toán/tạm ứng mới.' : 'Theo dõi và phê duyệt các đề nghị thanh toán/tạm ứng.'}</p>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-start sm:justify-end">
                    <button 
                        onClick={() => setView('list')}
                        className={`px-4 py-2 rounded-lg font-bold transition ${view === 'list' ? 'bg-slate-800 text-white shadow-lg' : 'bg-white border text-slate-600 hover:bg-slate-50'}`}
                    >
                        {activeTab === 'dntt' ? 'Phiếu đã tạo' : 'Danh sách phiếu'}
                    </button>
                    {activeTab === 'dntt' && (
                        <button 
                            onClick={() => setView('create')}
                            className={`px-4 py-2 rounded-lg font-bold transition ${view === 'create' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border text-blue-600 hover:bg-blue-50'}`}
                        >
                            Tạo phiếu mới
                        </button>
                    )}
                </div>
            </header>

            {view === 'create' ? (
                <div className="bg-white p-4 sm:p-8 md:p-12 shadow-lg rounded-xl font-['Times_New_Roman',_serif] text-[15px] text-black border border-slate-200 w-full max-w-3xl mx-auto overflow-x-auto custom-scrollbar">
                    <div className="text-center mb-8 px-2"><h1 className="font-bold text-sm sm:text-[17px] uppercase tracking-wide leading-relaxed">CÔNG TY TNHH TM XD TTNT QUỐC TẾ PHÚC KHANG</h1><p className="text-xs sm:text-sm mt-1">72/5 Trần Đình Xu, Phường Cô Giang, Q1, TP HCM</p></div>
                    
                    <div className="mb-6 flex flex-col sm:flex-row gap-3 sm:gap-6 bg-white p-3 rounded-xl border border-slate-200 w-full shadow-sm mx-auto items-start sm:items-center justify-center">
                        <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 font-sans text-sm sm:text-base">
                            <input type="radio" name="docType" value="DNTT" checked={dnttData.docType === 'DNTT'} onChange={handleDnttChange} className="w-4 h-4 text-blue-600 focus:ring-blue-500" /> 
                            Đề nghị thanh toán (DNTT)
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 font-sans text-sm sm:text-base">
                            <input type="radio" name="docType" value="DNTU" checked={dnttData.docType === 'DNTU'} onChange={handleDnttChange} className="w-4 h-4 text-blue-600 focus:ring-blue-500" /> 
                            Đề nghị tạm ứng (DNTƯ)
                        </label>
                    </div>

                    <div className="text-center mb-6">
                        <h2 className="text-xl sm:text-2xl font-bold mb-2 uppercase">{dnttData.docType === 'DNTT' ? 'ĐỀ NGHỊ THANH TOÁN' : 'ĐỀ NGHỊ TẠM ỨNG'}</h2>
                        <div className="flex justify-center items-center text-sm gap-1 flex-wrap">
                            <span>Ngày</span><input type="text" value={new Date(dnttData.date).getDate().toString().padStart(2, '0')} readOnly className="w-8 text-center outline-none border-b border-dotted border-gray-400 bg-transparent" />
                            <span>Tháng</span><input type="text" value={(new Date(dnttData.date).getMonth() + 1).toString().padStart(2, '0')} readOnly className="w-8 text-center outline-none border-b border-dotted border-gray-400 bg-transparent" />
                            <span>Năm</span><input type="text" value={new Date(dnttData.date).getFullYear()} readOnly className="w-12 text-center outline-none border-b border-dotted border-gray-400 bg-transparent" />
                            <input type="date" name="date" value={dnttData.date} onChange={handleDnttChange} className="ml-2 w-5 h-5 cursor-pointer opacity-50 hover:opacity-100 transition" />
                        </div>
                    </div>
                    <div className="space-y-2 mb-4">
                        <div className="flex"><span className="whitespace-nowrap mr-2 font-bold">Đối tượng:</span><input type="text" name="recipient" value={dnttData.recipient} onChange={handleDnttChange} className="flex-1 border-b border-dotted border-gray-400 outline-none bg-transparent" /></div>
                        <div className="flex"><span className="whitespace-nowrap mr-2 font-bold">Công trình:</span>
                            <div className="flex-1 border-b border-dotted border-gray-400 relative group">
                                <input type="text" value={dnttData.project} readOnly className="w-full outline-none bg-transparent cursor-pointer font-bold text-blue-700" placeholder="Chọn công trình..." />
                                <select name="project" value={dnttData.project} onChange={handleDnttChange} className="absolute inset-0 opacity-0 cursor-pointer w-full"><option value="">-- Chọn công trình --</option>{projects.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}</select>
                            </div>
                        </div>
                    </div>
                    <div className="mb-2 font-bold uppercase">A. NỘI DUNG {dnttData.docType === 'DNTT' ? 'THANH TOÁN' : 'TẠM ỨNG'}</div>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-black mb-2 min-w-[650px]">
                            <thead><tr className="bg-slate-50"><th className="border border-black p-1 text-center w-12">STT</th><th className="border border-black p-1 text-center">Nội dung</th><th className="border border-black p-1 text-center w-32">Thành tiền</th><th className="border border-black p-1 text-center w-32">Ghi chú</th><th className="border-none w-0 p-0"></th></tr></thead>
                            <tbody>
                                {dnttData.items.map((item, index) => (
                                    <tr key={item.id} className="group/row">
                                        <td className="border border-black p-1 text-center">{index + 1}</td>
                                        <td className="border border-black p-1"><input type="text" value={item.content} onChange={(e) => handleDnttItemChange(index, 'content', e.target.value)} className="w-full outline-none bg-transparent" placeholder="Nhập chi tiết..." /></td>
                                        <td className="border border-black p-1"><input type="text" value={item.amount ? formatCurrency(item.amount) : ''} onChange={(e) => handleDnttItemChange(index, 'amount', Math.max(0, parseVietnameseNumber(e.target.value) || 0))} className="w-full outline-none text-right bg-transparent font-medium" placeholder="0" /></td>
                                        <td className="border border-black p-1"><input type="text" value={item.note} onChange={(e) => handleDnttItemChange(index, 'note', e.target.value)} className="w-full outline-none bg-transparent" /></td>
                                        <td className="border-none align-middle pl-2 w-8"><button onClick={() => removeDnttItem(index)} className="text-red-400 hover:text-red-600 opacity-0 group-hover/row:opacity-100"><X size={16} /></button></td>
                                    </tr>
                                ))}
                                <tr><td colSpan="4" className="border border-black p-1 text-center bg-gray-50 hover:bg-gray-100 cursor-pointer text-blue-600 transition font-sans" onClick={addDnttItem}>+ Thêm dòng chi phí</td></tr>
                                <tr><td colSpan="2" className="border border-black p-1 font-bold text-center">Tổng cộng</td><td className="border border-black p-1 font-bold text-right text-base">{dnttTotalAmount > 0 ? formatCurrency(dnttTotalAmount) : '-'}</td><td className="border border-black p-1"></td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div className="mb-6"><span className="font-bold italic">Bằng chữ: </span><span className="italic font-medium">{docSoTiengViet(dnttTotalAmount)}</span></div>
                    <div className="mb-2 font-bold">B. HÌNH THỨC NHẬN TIỀN</div>
                    <div className="flex gap-8 mb-4 ml-4">
                        <label className="flex items-center gap-2 cursor-pointer"><div className={`w-4 h-4 border border-black flex justify-center items-center ${dnttData.paymentMethod === 'tien_mat' ? 'bg-black text-white' : 'text-transparent'}`}><span className="text-[10px] pb-0.5 font-sans">x</span></div><input type="radio" name="paymentMethod" value="tien_mat" checked={dnttData.paymentMethod === 'tien_mat'} onChange={handleDnttChange} className="hidden" /> Tiền mặt</label>
                        <label className="flex items-center gap-2 cursor-pointer"><div className={`w-4 h-4 border border-black flex justify-center items-center ${dnttData.paymentMethod === 'chuyen_khoan' ? 'bg-black text-white' : 'text-transparent'}`}><span className="text-[10px] pb-0.5 font-sans">x</span></div><input type="radio" name="paymentMethod" value="chuyen_khoan" checked={dnttData.paymentMethod === 'chuyen_khoan'} onChange={handleDnttChange} className="hidden" /> Chuyển khoản</label>
                    </div>
                    <div className="overflow-x-auto">
                        <table className={`w-full border-collapse border border-black mb-12 ${dnttData.paymentMethod === 'tien_mat' ? 'opacity-30' : ''} min-w-[650px]`}>
                            <thead><tr className="bg-slate-50 text-center font-bold"><th className="border border-black p-1 w-1/4">Tên chủ tài khoản</th><th className="border border-black p-1 w-1/4">Số tài khoản</th><th className="border border-black p-1 w-1/4">Ngân hàng</th><th className="border border-black p-1 w-1/4">Chi nhánh</th></tr></thead>
                            <tbody><tr><td className="border border-black p-1"><input type="text" name="bankAccountName" value={dnttData.bankAccountName} onChange={handleDnttChange} className="w-full outline-none bg-transparent text-center" /></td><td className="border border-black p-1"><input type="text" name="bankAccountNumber" value={dnttData.bankAccountNumber} onChange={handleDnttChange} className="w-full outline-none bg-transparent text-center font-sans font-bold" /></td><td className="border border-black p-1"><input type="text" name="bankName" value={dnttData.bankName} onChange={handleDnttChange} className="w-full outline-none bg-transparent text-center" /></td><td className="border border-black p-1"><input type="text" name="bankBranch" value={dnttData.bankBranch} onChange={handleDnttChange} className="w-full outline-none bg-transparent text-center" /></td></tr></tbody>
                        </table>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center font-bold font-sans"><div>NGƯỜI ĐỀ NGHỊ</div><div>QS</div><div>KẾ TOÁN</div><div>GIÁM ĐỐC</div></div><div className="h-24"></div>

                    {formError && (
                        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 font-bold flex items-center gap-2 animate-in slide-in-from-bottom-2">
                            <AlertCircle size={20} /> {formError}
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2 font-sans border-t pt-6">
                        <button onClick={() => setView('list')} className="px-6 py-2.5 rounded-xl font-bold transition bg-slate-100 text-slate-600 hover:bg-slate-200 w-full sm:flex-1">
                            Hủy bỏ
                        </button>
                        <button onClick={handleSubmit} disabled={isLoading} className="bg-blue-600 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg hover:bg-blue-700 transition w-full sm:flex-1 flex items-center justify-center gap-2">
                            <Send size={18} /> LƯU & GỬI DUYỆT
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="flex flex-wrap md:flex-nowrap border-b border-slate-200 bg-slate-100 p-1 rounded-2xl w-full md:w-fit">
                        <button 
                            onClick={() => setFilter('active')}
                            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition ${filter === 'active' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Đang xử lý ({dnttList.filter(d => ![STATUSES.PAID, STATUSES.ACCOUNTED, STATUSES.REJECTED].includes(d.status)).length})
                        </button>
                        <button 
                            onClick={() => setFilter('paid')}
                            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition ${filter === 'paid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Chờ hạch toán {dnttList.filter(d => d.status === STATUSES.PAID).length > 0 ? (
                                <span className="ml-1 px-2 py-0.5 bg-red-500 text-white rounded-full text-xs animate-pulse">
                                    {dnttList.filter(d => d.status === STATUSES.PAID).length}
                                </span>
                            ) : '(0)'}
                        </button>
                        <button 
                            onClick={() => setFilter('accounted')}
                            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition ${filter === 'accounted' ? 'bg-white text-slate-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Đã hoàn tất ({dnttList.filter(d => d.status === STATUSES.ACCOUNTED).length})
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
                            <input 
                                type="text"
                                placeholder="Tìm theo tên công trình, người nhận, số tiền, nội dung..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white transition"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {filteredList.length === 0 ? (
                            <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-slate-300 text-slate-400 font-bold">
                                Không tìm thấy phiếu đề nghị nào khớp với từ khóa tìm kiếm.
                            </div>
                        ) : (
                            filteredList.map((item) => {
                                const displayTitle = getDisplayTitle(item);
                                
                                return (
                                    <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 hover:shadow-md transition-all duration-300 group">
                                        <div className="flex-1 space-y-3">
                                            <div className="flex items-center gap-3">
                                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border ${getStatusStyle(item.status)}`}>
                                                    {item.status}
                                                </span>
                                                <span className="font-mono text-xs text-slate-400">#{item.id.slice(0,8)}</span>
                                                <span className="text-xs text-slate-400">{formatDateVN(item.created_at)}</span>
                                            </div>
                                            <h4 className="font-bold text-slate-800 text-lg">
                                                [{item.doc_type}] {displayTitle}
                                            </h4>
                                            <div className="flex flex-wrap gap-4 text-sm text-slate-600 font-medium">
                                                <div className="flex items-center gap-1.5"><User size={14} className="text-slate-400" /> {item.recipient}</div>
                                                <div className="flex items-center gap-1.5"><span className="font-bold text-blue-700">{formatCurrency(item.total_amount)} VNĐ</span></div>
                                                <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded border text-slate-500">{item.project_name}</div>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto mt-4 lg:mt-0">
                                            {activeTab === 'approvals' && item.status === STATUSES.WAITING_QS && canApproveQS && (
                                                <>
                                                    <button onClick={() => onUpdateStatus(item.id, item.doc_type === 'Đơn Vật Tư' ? STATUSES.PAID : STATUSES.WAITING_ACC)} className="flex-1 lg:flex-none whitespace-nowrap bg-blue-600 text-white px-3 sm:px-6 py-2 rounded-xl font-bold hover:bg-blue-700 transition flex items-center gap-1.5 sm:gap-2 justify-center shadow-lg shadow-blue-600/20"><Check size={18}/> Duyệt (QS)</button>
                                                    <button onClick={() => onUpdateStatus(item.id, STATUSES.REJECTED)} className="flex-1 lg:flex-none whitespace-nowrap bg-red-50 text-red-600 px-3 sm:px-6 py-2 rounded-xl font-bold hover:bg-red-600 hover:text-white transition flex items-center gap-1.5 sm:gap-2 justify-center border border-red-100"><X size={18}/> Từ chối</button>
                                                </>
                                            )}
                                            {activeTab === 'approvals' && item.status === STATUSES.WAITING_ACC && canApproveKT && (
                                                <>
                                                    <button onClick={() => onUpdateStatus(item.id, STATUSES.APPROVED)} className="flex-1 lg:flex-none whitespace-nowrap bg-green-600 text-white px-3 sm:px-6 py-2 rounded-xl font-bold hover:bg-green-700 transition flex items-center gap-1.5 sm:gap-2 justify-center shadow-lg shadow-green-600/20"><Check size={18}/> Duyệt (KT)</button>
                                                    <button onClick={() => onUpdateStatus(item.id, STATUSES.REJECTED)} className="flex-1 lg:flex-none whitespace-nowrap bg-red-50 text-red-600 px-3 sm:px-6 py-2 rounded-xl font-bold hover:bg-red-600 hover:text-white transition flex items-center gap-1.5 sm:gap-2 justify-center border border-red-100"><X size={18}/> Từ chối</button>
                                                </>
                                            )}
                                            {activeTab === 'approvals' && item.status === STATUSES.APPROVED && canPay && (
                                                <button 
                                                    onClick={() => onUpdateStatus(item.id, STATUSES.PAID)} 
                                                    className="flex-1 lg:flex-none whitespace-nowrap bg-indigo-600 text-white px-4 sm:px-8 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center gap-2 justify-center shadow-lg shadow-indigo-600/20"
                                                >
                                                    <Coins size={18}/> Xác nhận Chi tiền
                                                </button>
                                            )}
                                            {activeTab === 'approvals' && item.status === STATUSES.PAID && canAccount && (
                                                <button 
                                                    onClick={() => openDistributeModal(item)} 
                                                    className="flex-1 lg:flex-none whitespace-nowrap bg-amber-500 text-white px-4 sm:px-8 py-2.5 rounded-xl font-bold hover:bg-amber-600 transition flex items-center gap-2 justify-center shadow-lg shadow-amber-500/20 animate-pulse hover:animate-none"
                                                >
                                                    <FileText size={18}/> Phân phối & Hạch toán
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => openPrintPreview(item)} 
                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition" 
                                                title="In phiếu"
                                            >
                                                <Printer size={20}/>
                                            </button>
                                            {isAdminOrManager && (
                                                <button onClick={() => { 
                                                    setConfirmModal({
                                                        isOpen: true,
                                                        message: 'Chắc chắn xóa phiếu phê duyệt này?',
                                                        onConfirm: () => {
                                                            setConfirmModal({ isOpen: false, message: '', onConfirm: null });
                                                            onDeleteApproval(item.id);
                                                        }
                                                    });
                                                }} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition" title="Xóa phiếu">
                                                    <Trash2 size={20}/>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* Modal Phân bổ chi phí */}
            {distributeItem && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[1000] flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden my-auto animate-in zoom-in-95 duration-300">
                        <header className="bg-slate-900 text-white p-4 sm:p-8 flex justify-between items-start gap-4">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <Archive className="text-amber-500" />
                                    <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight">Hạch Toán Chi Phí</h3>
                                </div>
                                <p className="text-slate-400 text-xs sm:text-sm">
                                    Phiếu: <span className="text-white font-bold">#{distributeItem.id.slice(0,8)}</span> | 
                                    Công trình: <span className="text-white font-bold">{distributeItem.project_name}</span> | 
                                    Tổng tiền: <span className="text-amber-400 font-black">{formatCurrency(distributeItem.total_amount)}</span>
                                </p>
                            </div>
                            <button onClick={() => setDistributeItem(null)} className="p-2 bg-slate-800 rounded-xl text-slate-400 hover:text-white transition"><X /></button>
                        </header>
                        
                        <div className="p-4 sm:p-8 max-h-[60vh] overflow-y-auto custom-scrollbar bg-slate-50">
                            {distributeItem.doc_type === 'Đơn Vật Tư' && (
                                <div className="mb-6 flex flex-wrap gap-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                                        <input 
                                            type="radio" 
                                            name="distributeOpt" 
                                            value="auto" 
                                            checked={distributeOption === 'auto'} 
                                            onChange={() => handleDistributeOptionChange('auto')} 
                                            className="w-4 h-4 text-blue-600 focus:ring-blue-500" 
                                        /> 
                                        Lấy theo số tiền từ đơn vật tư
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                                        <input 
                                            type="radio" 
                                            name="distributeOpt" 
                                            value="manual" 
                                            checked={distributeOption === 'manual'} 
                                            onChange={() => handleDistributeOptionChange('manual')} 
                                            className="w-4 h-4 text-blue-600 focus:ring-blue-500" 
                                        /> 
                                        Nhập số tiền bằng tay
                                    </label>
                                </div>
                            )}
                            <div className="space-y-4">
                                {distributionData.map((d, idx) => (
                                    <div key={idx} className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 sm:gap-6 items-stretch md:items-center">
                                        <div className="flex-1">
                                            <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase mb-1">Nội dung đề nghị {idx + 1}</p>
                                            <p className="font-bold text-slate-800 leading-tight text-sm sm:text-base">{d.content}</p>
                                            {d.note && <p className="text-xs text-slate-500 mt-1 italic">Ghi chú: {d.note}</p>}
                                        </div>
                                        <div className="w-full md:w-64">
                                            <p className="text-[10px] text-slate-400 font-black uppercase mb-1.5 ml-1">Chọn mã chi phí phân phối</p>
                                            <select 
                                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-black text-blue-700 outline-none focus:border-blue-500 focus:bg-white transition"
                                                value={d.code}
                                                onChange={(e) => {
                                                    const newData = [...distributionData];
                                                    newData[idx].code = e.target.value;
                                                    setDistributionData(newData);
                                                }}
                                            >
                                                {EXPENSE_CATEGORIES.map(cat => (
                                                    <option key={cat.code} value={cat.code}>{cat.code} - {cat.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="w-full md:w-40">
                                            <p className="text-[10px] text-slate-400 font-black uppercase mb-1.5 mr-1 text-right">Thành tiền</p>
                                            <input 
                                                type="text"
                                                value={d.amount ? formatCurrency(d.amount) : ''}
                                                onChange={(e) => {
                                                    const newData = [...distributionData];
                                                    newData[idx].amount = parseVietnameseNumber(e.target.value);
                                                    setDistributionData(newData);
                                                }}
                                                disabled={distributeItem.doc_type === 'Đơn Vật Tư' && distributeOption === 'auto'}
                                                className={`w-full text-right bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 text-base font-bold text-slate-900 focus:border-blue-500 focus:bg-white outline-none transition ${distributeItem.doc_type === 'Đơn Vật Tư' && distributeOption === 'auto' ? 'opacity-60 bg-slate-200 cursor-not-allowed border-slate-300' : ''}`}
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <footer className="p-4 sm:p-8 bg-white border-t-2 border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 sm:gap-6">
                            <div className="flex items-center gap-4 bg-amber-50 px-6 py-3 rounded-2xl border border-amber-100 w-full md:w-auto justify-between md:justify-start">
                                <span className="text-amber-800 font-bold text-sm uppercase">Tổng phân bổ:</span>
                                <span className="text-xl sm:text-2xl font-black text-amber-900">{formatCurrency(distributionData.reduce((sum, d) => sum + d.amount, 0))}</span>
                            </div>
                            <div className="flex gap-3 w-full md:w-auto">
                                <button 
                                    onClick={() => setDistributeItem(null)}
                                    className="flex-1 md:flex-none px-6 sm:px-8 py-3 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 transition text-sm sm:text-base"
                                >
                                    Để sau
                                </button>
                                <button 
                                    onClick={handleSaveDistribution}
                                    className="flex-1 md:flex-none px-8 sm:px-12 py-3 rounded-2xl font-black bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all duration-200 text-sm sm:text-base"
                                >
                                    HOÀN TẤT HẠCH TOÁN
                                </button>
                            </div>
                        </footer>
                    </div>
                </div>
            )}

            {/* Modal In Phiếu (DNTT / DNTƯ) */}
            {printItem && (
                <div className="fixed inset-0 bg-slate-900/70 print:bg-transparent backdrop-blur-md z-[1000] flex items-center justify-center p-4 overflow-y-auto print:static print:block print:p-0 print:m-0">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden my-8 animate-in zoom-in-95 duration-300 print:shadow-none print:m-0 print:max-w-none print:w-full print:rounded-none">
                        {/* Control Bar (No Print) */}
                        <header className="bg-slate-900 text-white p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print print:hidden">
                            <div className="flex items-center gap-3">
                                <Printer className="text-blue-500" />
                                <h3 className="text-lg sm:text-xl font-bold">Xem Trước & In Phiếu</h3>
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto justify-end">
                                <button 
                                    onClick={() => window.print()}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold transition flex items-center gap-2 text-sm"
                                >
                                    <Printer size={16} /> In Phiếu (A4)
                                </button>
                                <button 
                                    onClick={() => setPrintItem(null)} 
                                    className="p-2 bg-slate-800 rounded-xl text-slate-400 hover:text-white transition"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </header>

                        {/* Print Preview Container */}
                        <div className="p-4 sm:p-8 bg-slate-100 max-h-[75vh] overflow-y-auto custom-scrollbar flex justify-center print:block print:p-0 print:bg-white print:max-h-none print:overflow-visible">
                            <div className="print-area bg-white p-4 sm:p-10 shadow-md border border-slate-200 w-full max-w-[800px] font-['Times_New_Roman',_serif] text-[15px] text-black mx-auto print:max-w-none print:w-full print:border-none print:shadow-none print:p-0 print:m-0">
                                <div>
                                    {/* Company Header */}
                                    <div className="text-center mb-8">
                                        <h1 className="font-bold text-[17px] uppercase tracking-wide">
                                            CÔNG TY TNHH TM XD TTNT QUỐC TẾ PHÚC KHANG
                                        </h1>
                                        <p className="text-[13px]">72/5 Trần Đình Xu, Phường Cô Giang, Q1, TP HCM</p>
                                    </div>

                                    {/* Title & Date */}
                                    <div className="text-center mb-6">
                                        <h2 className="text-2xl font-bold mb-2 uppercase">
                                            {printItem.parsed.docType === 'DNTU' ? 'ĐỀ NGHỊ TẠM ỨNG' : 'ĐỀ NGHỊ THANH TOÁN'}
                                        </h2>
                                        <div className="text-[14px]">
                                            {(() => {
                                                const dateParts = getPrintDateComponents(printItem.parsed.date);
                                                return `Ngày ${dateParts.day} Tháng ${dateParts.month} Năm ${dateParts.year}`;
                                            })()}
                                        </div>
                                    </div>

                                    {/* Metadata */}
                                    <div className="space-y-2 mb-6">
                                        <div className="flex border-b border-dotted border-gray-400 pb-1">
                                            <span className="font-bold min-w-[120px]">Đối tượng:</span>
                                            <span>{printItem.parsed.recipient || printItem.recipient}</span>
                                        </div>
                                        <div className="flex border-b border-dotted border-gray-400 pb-1">
                                            <span className="font-bold min-w-[120px]">Công trình:</span>
                                            <span className="font-bold">{printItem.parsed.project || printItem.project_name}</span>
                                        </div>
                                    </div>

                                    {/* Content Table */}
                                    <div className="mb-2 font-bold uppercase">
                                        A. NỘI DUNG {printItem.parsed.docType === 'DNTU' ? 'TẠM ỨNG' : 'THANH TOÁN'}
                                    </div>
                                    <div className="overflow-x-auto print:overflow-visible">
                                        <table className="w-full border-collapse border border-black mb-4 min-w-[650px] print:min-w-0">
                                            <thead>
                                                <tr className="bg-gray-50">
                                                    <th className="border border-black p-2 text-center w-12 font-bold">STT</th>
                                                    <th className="border border-black p-2 text-center font-bold">Nội dung</th>
                                                    <th className="border border-black p-2 text-center w-36 font-bold">Thành tiền</th>
                                                    <th className="border border-black p-2 text-center w-36 font-bold">Ghi chú</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {printItem.parsed.items && printItem.parsed.items.map((item, index) => (
                                                    <tr key={index}>
                                                        <td className="border border-black p-2 text-center">{index + 1}</td>
                                                        <td className="border border-black p-2">{item.content}</td>
                                                        <td className="border border-black p-2 text-right font-medium">
                                                            {item.amount ? formatCurrency(item.amount) : '-'}
                                                        </td>
                                                        <td className="border border-black p-2">{item.note || ''}</td>
                                                    </tr>
                                                ))}
                                                <tr>
                                                    <td colSpan="2" className="border border-black p-2 font-bold text-center">Tổng cộng</td>
                                                    <td className="border border-black p-2 font-bold text-right text-[16px]">
                                                        {formatCurrency(printItem.total_amount)}
                                                    </td>
                                                    <td className="border border-black p-2"></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Written Amount */}
                                    <div className="mb-6">
                                        <span className="font-bold italic">Bằng chữ: </span>
                                        <span className="italic font-medium">{docSoTiengViet(printItem.total_amount)}</span>
                                    </div>

                                    {/* Payment Method */}
                                    <div className="mb-2 font-bold">B. HÌNH THỨC NHẬN TIỀN</div>
                                    <div className="flex gap-8 mb-4 ml-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 border border-black flex justify-center items-center">
                                                {printItem.parsed.paymentMethod === 'tien_mat' ? '✓' : ''}
                                            </div>
                                            <span>Tiền mặt</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 border border-black flex justify-center items-center">
                                                {printItem.parsed.paymentMethod === 'chuyen_khoan' ? '✓' : ''}
                                            </div>
                                            <span>Chuyển khoản</span>
                                        </div>
                                    </div>

                                    {/* Bank Details Table */}
                                    {printItem.parsed.paymentMethod === 'chuyen_khoan' && (
                                        <div className="overflow-x-auto print:overflow-visible">
                                            <table className="w-full border-collapse border border-black mb-8 min-w-[650px] print:min-w-0">
                                                <thead>
                                                    <tr className="bg-gray-50 font-bold text-center">
                                                        <th className="border border-black p-2 w-1/4">Tên chủ tài khoản</th>
                                                        <th className="border border-black p-2 w-1/4">Số tài khoản</th>
                                                        <th className="border border-black p-2 w-1/4">Ngân hàng</th>
                                                        <th className="border border-black p-2 w-1/4">Chi nhánh</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr className="text-center">
                                                        <td className="border border-black p-2">{printItem.parsed.bankAccountName || '-'}</td>
                                                        <td className="border border-black p-2 font-bold">{printItem.parsed.bankAccountNumber || '-'}</td>
                                                        <td className="border border-black p-2">{printItem.parsed.bankName || '-'}</td>
                                                        <td className="border border-black p-2">{printItem.parsed.bankBranch || '-'}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                {/* Signatures Block */}
                                <div>
                                    <div className="grid grid-cols-4 gap-2 text-center font-bold text-[14px] mt-8">
                                        <div>NGƯỜI ĐỀ NGHỊ</div>
                                        <div>QS</div>
                                        <div>KẾ TOÁN</div>
                                        <div>GIÁM ĐỐC</div>
                                    </div>
                                    <div className="h-24"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal 
                isOpen={confirmModal.isOpen} 
                message={confirmModal.message} 
                onConfirm={confirmModal.onConfirm} 
                onCancel={() => setConfirmModal({ isOpen: false, message: '', onConfirm: null })} 
            />
        </div>
    );
}

function Building2({size, className}) {
    return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M16 18h.01"/></svg>;
}
