'use client';
/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

import React, { useState, useEffect } from 'react';
import { Search, Upload, Copy, Download, Edit, Trash2, Filter, Printer } from 'lucide-react';
import { formatCurrency, formatDateVN } from '@/lib/utils';
import ConfirmModal from '@/components/ConfirmModal';

function TableFilter({ title, options = [], selectedValues, onToggle, onSelectAll, onClear, onSort }) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');

    const filteredOptions = options.filter(opt => 
        (opt || 'Trống').toString().toLowerCase().includes(search.toLowerCase())
    );

    const isAllSelected = options.length > 0 && options.every(opt => selectedValues.includes(opt));

    return (
        <div className="relative inline-block ml-1">
            <button 
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                className={`p-1 rounded hover:bg-slate-200 transition ${selectedValues.length < options.length ? 'text-blue-600 bg-blue-100' : 'text-slate-400'}`}
            >
                <Filter size={12} fill={selectedValues.length < options.length ? 'currentColor' : 'none'} />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setIsOpen(false)}></div>
                    <div className="absolute left-0 mt-2 min-w-[300px] w-max max-w-[85vw] bg-white border border-slate-300 shadow-2xl rounded-lg z-[70] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        {/* Sort Options */}
                        <div className="p-1 border-b border-slate-100">
                            <button onClick={() => { onSort('asc'); setIsOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-xs text-slate-700 hover:bg-blue-50 rounded transition">
                                <span className="w-5 h-5 flex items-center justify-center bg-slate-100 rounded text-[10px] font-bold">AZ</span>
                                Sắp xếp từ A đến Z
                            </button>
                            <button onClick={() => { onSort('desc'); setIsOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-xs text-slate-700 hover:bg-blue-50 rounded transition">
                                <span className="w-5 h-5 flex items-center justify-center bg-slate-100 rounded text-[10px] font-bold">ZA</span>
                                Sắp xếp từ Z đến A
                            </button>
                        </div>

                        {/* Search and Filter */}
                        <div className="p-3 bg-slate-50 border-b border-slate-200">
                            <div className="flex justify-between items-center mb-2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Lọc dữ liệu: {title}</p>
                                <div className="flex gap-2">
                                    <button onClick={onClear} className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-800 transition bg-white border border-slate-200 rounded">Xóa bộ lọc</button>
                                    <button onClick={() => setIsOpen(false)} className="px-3 py-1 bg-blue-600 text-white text-[10px] font-bold rounded hover:bg-blue-700 shadow-sm transition">OK</button>
                                </div>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 text-slate-400" size={14} />
                                <input 
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Tìm kiếm..."
                                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none shadow-inner"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="max-h-56 overflow-y-auto custom-scrollbar p-1">
                            <label className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-100 rounded cursor-pointer group">
                                <input 
                                    type="checkbox" 
                                    checked={isAllSelected}
                                    onChange={onSelectAll}
                                    className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                                />
                                <span className="text-xs font-bold text-slate-800">(Chọn tất cả)</span>
                            </label>
                            {filteredOptions.map((opt, i) => (
                                <label key={i} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-100 rounded cursor-pointer group">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedValues.includes(opt)}
                                        onChange={() => onToggle(opt)}
                                        className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                                    />
                                    <span className="text-xs text-slate-600 flex-1 break-words whitespace-normal leading-tight">{opt || '(Trống)'}</span>
                                    <button 
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClear(); onToggle(opt); }}
                                        className="text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 hover:underline"
                                    >
                                        Chỉ mục này
                                    </button>
                                </label>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default function HistoryTable({ 
    transactions, 
    selectedProject, 
    projects,
    handleEdit,
    handleDelete,
    handleDeleteAll,
    canDelete,
    isAdmin,
    setIsPasting,
    handleCopyTable,
    exportTableToExcel,
    expenseCategories,
    systemConfig
}) {
    const [confirmState, setConfirmState] = useState({ isOpen: false, message: '', onConfirm: null, title: 'Xác nhận xóa', requirePassword: false });

    const openConfirm = (message, onConfirm, title = 'Xác nhận xóa', requirePassword = false) => {
        setConfirmState({ isOpen: true, message, onConfirm, title, requirePassword });
    };
    const closeConfirm = () => setConfirmState({ isOpen: false, message: '', onConfirm: null, title: 'Xác nhận xóa', requirePassword: false });
    const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });

    const getUnique = (key) => {
        const unique = [...new Set(transactions.map(t => t[key]))].sort();
        if (key === 'accounting_date' || key === 'invoice_date') {
            return unique.reverse();
        }
        return unique;
    };

    const getAvailableOptions = (stateKey, dbField) => {
        const availableT = transactions.filter(t => {
            if (selectedProject && t.project_name !== selectedProject) return false;
            
            if (!(t.invoice_no || '').toLowerCase().includes(textFilters.invoiceNo.toLowerCase())) return false;
            if (!(t.note || '').toLowerCase().includes(textFilters.note.toLowerCase())) return false;

            if (stateKey !== 'accountingDate' && !filterState.accountingDate.includes(t.accounting_date)) return false;
            if (stateKey !== 'invoiceDate' && !filterState.invoiceDate.includes(t.invoice_date)) return false;
            if (stateKey !== 'code' && !filterState.code.includes(t.code)) return false;
            if (stateKey !== 'correspondingAccount' && !filterState.correspondingAccount.includes(t.corresponding_account)) return false;
            if (stateKey !== 'recipient' && !filterState.recipient.includes(t.recipient)) return false;
            if (stateKey !== 'createdBy' && !filterState.createdBy.includes(t.created_by)) return false;
            if (stateKey !== 'projectName' && !filterState.projectName.includes(t.project_name)) return false;
            
            return true;
        });

        const unique = [...new Set(availableT.map(t => t[dbField]))].sort();
        if (dbField === 'accounting_date' || dbField === 'invoice_date') {
            return unique.reverse();
        }
        return unique;
    };

    
    const [filterState, setFilterState] = useState({
        accountingDate: [],
        invoiceDate: [],
        code: [],
        correspondingAccount: [],
        recipient: [],
        createdBy: [],
        projectName: []
    });

    const [textFilters, setTextFilters] = useState({
        invoiceNo: '', note: ''
    });

    const handleSort = (key, direction) => {
        setSortConfig({ key, direction });
    };

    const prevUniqueRef = React.useRef({});

    // Cập nhật filterState khi transactions thay đổi (ví dụ: sau khi fetch mới)
    useEffect(() => {
        const mappings = [
            { stateKey: 'accountingDate', dbField: 'accounting_date' },
            { stateKey: 'invoiceDate', dbField: 'invoice_date' },
            { stateKey: 'code', dbField: 'code' },
            { stateKey: 'correspondingAccount', dbField: 'corresponding_account' },
            { stateKey: 'recipient', dbField: 'recipient' },
            { stateKey: 'createdBy', dbField: 'created_by' },
            { stateKey: 'projectName', dbField: 'project_name' }
        ];

        if (Object.keys(prevUniqueRef.current).length === 0) {
            const initial = {};
            const initialPrev = {};
            mappings.forEach(m => {
                const u = getUnique(m.dbField);
                initial[m.stateKey] = u;
                initialPrev[m.stateKey] = u;
            });
            prevUniqueRef.current = initialPrev;
            setFilterState(initial);
            return;
        }

        setFilterState(prev => {
            const next = { ...prev };
            const nextPrev = {};
            mappings.forEach(m => {
                const currentUnique = getUnique(m.dbField);
                const previousUnique = prevUniqueRef.current[m.stateKey] || [];
                
                const newlyAdded = currentUnique.filter(x => !previousUnique.includes(x));
                const prevSelected = prev[m.stateKey] || [];
                
                const nextSelected = currentUnique.filter(x => 
                    prevSelected.includes(x) || newlyAdded.includes(x)
                );
                
                next[m.stateKey] = nextSelected;
                nextPrev[m.stateKey] = currentUnique;
            });
            prevUniqueRef.current = nextPrev;
            return next;
        });
    }, [transactions]);

    const handleToggle = (key, val) => {
        const current = filterState[key];
        const next = current.includes(val) 
            ? current.filter(v => v !== val)
            : [...current, val];
        setFilterState({ ...filterState, [key]: next });
    };

    const handleSelectAll = (key) => {
        const all = getUnique(key === 'accountingDate' ? 'accounting_date' : 
                             key === 'invoiceDate' ? 'invoice_date' : 
                             key === 'correspondingAccount' ? 'corresponding_account' : 
                             key === 'createdBy' ? 'created_by' : 
                             key === 'projectName' ? 'project_name' : key);
        setFilterState({ ...filterState, [key]: all });
    };

    const handleClear = (key) => {
        setFilterState({ ...filterState, [key]: [] });
    };

    const filteredTransactions = transactions.filter(t => {
        if (selectedProject && t.project_name !== selectedProject) return false;
        
        return (
            filterState.accountingDate.includes(t.accounting_date) &&
            filterState.invoiceDate.includes(t.invoice_date) &&
            filterState.code.includes(t.code) &&
            filterState.correspondingAccount.includes(t.corresponding_account) &&
            filterState.recipient.includes(t.recipient) &&
            filterState.createdBy.includes(t.created_by) &&
            filterState.projectName.includes(t.project_name) &&
            (t.invoice_no || '').toLowerCase().includes(textFilters.invoiceNo.toLowerCase()) &&
            (t.note || '').toLowerCase().includes(textFilters.note.toLowerCase())
        );
    }).sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        
        if (sortConfig.key === 'accounting_date' || sortConfig.key === 'invoice_date' || sortConfig.key === 'created_at') {
            const dateA = new Date(valA).getTime();
            const dateB = new Date(valB).getTime();
            if (dateA !== dateB) {
                return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
            }
            // Fallback to created_at if dates are same
            const createA = new Date(a.created_at).getTime();
            const createB = new Date(b.created_at).getTime();
            return sortConfig.direction === 'asc' ? createA - createB : createB - createA;
        }
        
        const strA = (valA || '').toString().toLowerCase();
        const strB = (valB || '').toString().toLowerCase();
        
        if (sortConfig.direction === 'asc') {
            return strA.localeCompare(strB, 'vi');
        } else {
            return strB.localeCompare(strA, 'vi');
        }
    });

    const totalDebit = filteredTransactions.reduce((sum, t) => sum + (Number(t.debit) || 0), 0);
    const totalCredit = filteredTransactions.reduce((sum, t) => sum + (Number(t.credit) || 0), 0);
    const totalAmount = totalCredit - totalDebit;

    return (
        <div className="animate-in fade-in duration-500">
            <ConfirmModal
                isOpen={confirmState.isOpen}
                title={confirmState.title}
                message={confirmState.message}
                requirePassword={confirmState.requirePassword}
                onConfirm={(pwd) => { confirmState.onConfirm?.(pwd); closeConfirm(); }}
                onCancel={closeConfirm}
                type="danger"
            />

            <div className="mb-6 flex flex-wrap justify-between items-end gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Lịch sử chi tiền</h2>
                    <p className="text-slate-500 text-sm mt-1">
                        Dự án: <span className="font-bold text-blue-600">{selectedProject || 'Tất cả'}</span>
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 print:hidden">
                    <button onClick={() => {
                        if (systemConfig?.edit_transaction && !isAdmin) return alert('Thử lại sau');
                        setIsPasting(true);
                    }} className={`text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg transition ${systemConfig?.edit_transaction && !isAdmin ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
                        <Upload size={16} /> Nhập từ Excel
                    </button>
                    <button onClick={() => {
                        const el = document.getElementById('history-table');
                        if(el) {
                            el.classList.add('print-area');
                            window.print();
                            el.classList.remove('print-area');
                        }
                    }} className="bg-slate-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-700 flex items-center gap-2 shadow-lg transition">
                        <Printer size={16} /> In
                    </button>
                    <button onClick={() => handleCopyTable('history-table')} className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-700 flex items-center gap-2 shadow-lg transition">
                        <Copy size={16} /> Copy cho Excel
                    </button>
                    <button onClick={() => exportTableToExcel('history-table', 'LichSuChiTien')} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 flex items-center gap-2 shadow-lg transition">
                        <Download size={16} /> Xuất Excel
                    </button>
                    {canDelete && isAdmin && handleDeleteAll && selectedProject && (
                        <button
                            onClick={() => {
                                if (systemConfig?.edit_transaction && !isAdmin) return alert('Thử lại sau');
                                openConfirm(
                                    `Bạn sắp xóa TOÀN BỘ dữ liệu giao dịch của công trình "${selectedProject}". Hành động này không thể hoàn tác!`,
                                    (pwd) => handleDeleteAll(pwd),
                                    'Xóa toàn bộ dữ liệu',
                                    true
                                );
                            }}
                            className={`text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg transition ${systemConfig?.edit_transaction && !isAdmin ? 'bg-slate-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
                        >
                            <Trash2 size={16} /> Xóa tất cả
                        </button>
                    )}
                </div>
            </div>

            {/* Bảng: sticky scrollbar ngang bằng cách giới hạn chiều cao container */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden" style={{ height: 'calc(100vh - 260px)', minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
                <div className="overflow-auto custom-scrollbar flex-1" style={{ overflowX: 'auto', overflowY: 'auto' }}>
                    <table id="history-table" className="w-full text-left text-[13px] border-collapse sticky-header min-w-[1500px]">
                        <thead className="bg-slate-100 sticky top-0 z-20 shadow-sm">
                            <tr>
                                <th className="p-3 border-b border-r border-slate-200 font-bold text-slate-700 text-center w-12 align-middle">STT</th>
                                <th className="p-3 border-b border-r border-slate-200 font-bold text-slate-700 whitespace-nowrap align-middle">
                                    Công trình
                                    <TableFilter title="Công trình" options={getAvailableOptions('projectName', 'project_name')} selectedValues={filterState.projectName} onToggle={(v) => handleToggle('projectName', v)} onSelectAll={() => handleSelectAll('projectName')} onClear={() => handleClear('projectName')} onSort={(dir) => handleSort('project_name', dir)} />
                                </th>
                                <th className="p-3 border-b border-r border-slate-200 font-bold text-slate-700 whitespace-nowrap align-middle">
                                    Ngày hạch toán
                                    <TableFilter title="Ngày hạch toán" options={getAvailableOptions('accountingDate', 'accounting_date')} selectedValues={filterState.accountingDate} onToggle={(v) => handleToggle('accountingDate', v)} onSelectAll={() => handleSelectAll('accountingDate')} onClear={() => handleClear('accountingDate')} onSort={(dir) => handleSort('accounting_date', dir)} />
                                </th>
                                <th className="p-3 border-b border-r border-slate-200 font-bold text-slate-700 whitespace-nowrap align-middle">
                                    Ngày hóa đơn
                                    <TableFilter title="Ngày hóa đơn" options={getAvailableOptions('invoiceDate', 'invoice_date')} selectedValues={filterState.invoiceDate} onToggle={(v) => handleToggle('invoiceDate', v)} onSelectAll={() => handleSelectAll('invoiceDate')} onClear={() => handleClear('invoiceDate')} onSort={(dir) => handleSort('invoice_date', dir)} />
                                </th>
                                <th className="p-3 border-b border-r border-slate-200 font-bold text-slate-700 whitespace-nowrap align-middle">
                                    Số hóa đơn
                                    <div className="mt-1"><input type="text" value={textFilters.invoiceNo} onChange={(e) => setTextFilters({...textFilters, invoiceNo: e.target.value})} placeholder="Tìm..." className="w-full p-1 text-[10px] border border-slate-200 rounded outline-none" /></div>
                                </th>
                                <th className="p-3 border-b border-r border-slate-200 font-bold text-slate-700 align-middle min-w-[200px]">
                                    Diễn giải
                                    <div className="mt-1"><input type="text" value={textFilters.note} onChange={(e) => setTextFilters({...textFilters, note: e.target.value})} placeholder="Tìm..." className="w-full p-1 text-[10px] border border-slate-200 rounded outline-none" /></div>
                                </th>
                                <th className="p-3 border-b border-r border-slate-200 font-bold text-slate-700 align-middle">
                                    Tài khoản
                                    <TableFilter title="Tài khoản" options={getAvailableOptions('code', 'code')} selectedValues={filterState.code} onToggle={(v) => handleToggle('code', v)} onSelectAll={() => handleSelectAll('code')} onClear={() => handleClear('code')} onSort={(dir) => handleSort('code', dir)} />
                                </th>
                                <th className="p-3 border-b border-r border-slate-200 font-bold text-slate-700 align-middle">
                                    TK đối ứng
                                    <TableFilter title="TK đối ứng" options={getAvailableOptions('correspondingAccount', 'corresponding_account')} selectedValues={filterState.correspondingAccount} onToggle={(v) => handleToggle('correspondingAccount', v)} onSelectAll={() => handleSelectAll('correspondingAccount')} onClear={() => handleClear('correspondingAccount')} onSort={(dir) => handleSort('corresponding_account', dir)} />
                                </th>
                                <th className="p-3 border-b border-r border-slate-200 font-bold text-slate-700 text-right align-middle">Phát sinh Nợ</th>
                                <th className="p-3 border-b border-r border-slate-200 font-bold text-slate-700 text-right align-middle">Phát sinh Có</th>
                                <th className="p-3 border-b border-r border-slate-200 font-bold text-slate-700 text-right align-middle">Số tiền</th>
                                <th className="p-3 border-b border-r border-slate-200 font-bold text-slate-700 align-middle">
                                    Tên đối tượng
                                    <TableFilter title="Tên đối tượng" options={getAvailableOptions('recipient', 'recipient')} selectedValues={filterState.recipient} onToggle={(v) => handleToggle('recipient', v)} onSelectAll={() => handleSelectAll('recipient')} onClear={() => handleClear('recipient')} onSort={(dir) => handleSort('recipient', dir)} />
                                </th>
                                <th className="p-3 border-b border-r border-slate-200 font-bold text-slate-700 align-middle">
                                    Người nhập
                                    <TableFilter title="Người nhập" options={getAvailableOptions('createdBy', 'created_by')} selectedValues={filterState.createdBy} onToggle={(v) => handleToggle('createdBy', v)} onSelectAll={() => handleSelectAll('createdBy')} onClear={() => handleClear('createdBy')} onSort={(dir) => handleSort('created_by', dir)} />
                                </th>
                                <th className="p-3 border-b border-slate-200 font-bold text-slate-700 text-center align-middle">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTransactions.map((t, idx) => (
                                <tr key={t.id} className="border-b hover:bg-slate-50 transition text-slate-700">
                                    <td className="p-3 border-r border-slate-100 text-center text-slate-400 font-bold">{idx + 1}</td>
                                    <td className="p-3 border-r border-slate-100 font-bold text-slate-900">{t.project_name}</td>
                                    <td className="p-3 border-r border-slate-100 whitespace-nowrap">{formatDateVN(t.accounting_date)}</td>
                                    <td className="p-3 border-r border-slate-100 whitespace-nowrap">{formatDateVN(t.invoice_date)}</td>
                                    <td className="p-3 border-r border-slate-100 font-mono">{t.invoice_no || '-'}</td>
                                    <td className="p-3 border-r border-slate-100 min-w-[200px] max-w-[300px]" title={t.note?.replace(/\[ID:[a-zA-Z0-9-]+\]\s*/g, '')}>
                                        <div className="line-clamp-3 break-words whitespace-normal leading-relaxed">{t.note?.replace(/\[ID:[a-zA-Z0-9-]+\]\s*/g, '')}</div>
                                    </td>
                                    <td className="p-3 border-r border-slate-100 font-bold text-blue-700">{t.code}</td>
                                    <td className="p-3 border-r border-slate-100 font-bold text-slate-600">{t.corresponding_account || '-'}</td>
                                    <td className="p-3 border-r border-slate-100 text-right text-red-600 font-medium">{t.debit > 0 ? formatCurrency(t.debit) : ''}</td>
                                    <td className="p-3 border-r border-slate-100 text-right text-green-600 font-medium">{t.credit > 0 ? formatCurrency(t.credit) : ''}</td>
                                    <td className={`p-3 border-r border-slate-100 text-right font-bold ${(t.credit - t.debit) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                        {formatCurrency(t.credit - t.debit)}
                                    </td>
                                    <td className="p-3 border-r border-slate-100">{t.recipient || '-'}</td>
                                    <td className="p-3 border-r border-slate-100">
                                        <div className="text-slate-500 italic">{t.created_by || '-'}</div>
                                        {t.created_at && (
                                            <div className="text-[10px] text-slate-400 mt-0.5" title="Thời gian thao tác">
                                                {new Date(t.created_at).toLocaleDateString('vi-VN')} {new Date(t.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-3 text-center align-middle">
                                        <div className="flex justify-center gap-2">
                                            <button
                                                onClick={() => {
                                                    if (systemConfig?.edit_transaction && !isAdmin) return alert('Thử lại sau');
                                                    handleEdit(t);
                                                }}
                                                title="Sửa dòng này"
                                                className={`p-1.5 rounded-lg transition ${systemConfig?.edit_transaction && !isAdmin ? 'text-slate-300 cursor-not-allowed' : 'text-amber-500 hover:bg-amber-50'}`}
                                            >
                                                <Edit size={14} />
                                            </button>
                                            {isAdmin && (
                                                <button
                                                    onClick={() => {
                                                        if (systemConfig?.edit_transaction && !isAdmin) return alert('Thử lại sau');
                                                        openConfirm(
                                                            `Xóa giao dịch ngày ${formatDateVN(t.accounting_date)} — ${t.note || 'không có diễn giải'}?`,
                                                            () => handleDelete(t.id)
                                                        );
                                                    }}
                                                    title="Xóa dòng này"
                                                    className={`p-1.5 rounded-lg transition ${systemConfig?.edit_transaction && !isAdmin ? 'text-slate-300 cursor-not-allowed' : 'text-red-500 hover:bg-red-50'}`}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredTransactions.length > 0 && (
                                <tr className="bg-slate-200 font-bold sticky bottom-0 z-10 border-t-2 border-slate-300 shadow-[0_-2px_4px_rgba(0,0,0,0.05)] text-slate-800">
                                    <td colSpan="8" className="p-3 border-r border-slate-300 text-center uppercase tracking-wider text-sm">
                                        Tổng Cộng {filteredTransactions.length} Giao Dịch Đã Lọc
                                    </td>
                                    <td className="p-3 border-r border-slate-300 text-right text-red-700">{totalDebit > 0 ? formatCurrency(totalDebit) : ''}</td>
                                    <td className="p-3 border-r border-slate-300 text-right text-green-700">{totalCredit > 0 ? formatCurrency(totalCredit) : ''}</td>
                                    <td className={`p-3 border-r border-slate-300 text-right ${totalAmount >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                                        {formatCurrency(totalAmount)}
                                    </td>
                                    <td colSpan="3" className="p-3"></td>
                                </tr>
                            )}
                            {filteredTransactions.length === 0 && (
                                <tr>
                                    <td colSpan="14" className="p-8 text-center text-slate-400 italic">Không có dữ liệu phù hợp.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

