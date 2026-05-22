'use client';
/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

import React, { useState, useEffect } from 'react';
import { Search, Upload, Copy, Download, Edit, Trash2, Lock, Filter } from 'lucide-react';
import { formatCurrency, formatDateVN } from '@/lib/utils';

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
                    <div className="absolute left-0 mt-2 w-64 bg-white border border-slate-300 shadow-2xl rounded-lg z-[70] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
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
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-tight">Lọc dữ liệu: {title}</p>
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
                                    <span className="text-xs text-slate-600 flex-1 truncate">{opt || '(Trống)'}</span>
                                    <button 
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClear(); onToggle(opt); }}
                                        className="text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 hover:underline"
                                    >
                                        Chỉ mục này
                                    </button>
                                </label>
                            ))}
                        </div>

                        <div className="p-2 border-t border-slate-200 flex justify-end gap-2 bg-slate-50">
                            <button onClick={onClear} className="px-3 py-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-800 transition">Xóa bộ lọc</button>
                            <button onClick={() => setIsOpen(false)} className="px-5 py-1.5 bg-blue-600 text-white text-[11px] font-bold rounded hover:bg-blue-700 shadow-sm transition">OK</button>
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
    expenseCategories
}) {
    const [sortConfig, setSortConfig] = useState({ key: 'accounting_date', direction: 'desc' });

    const getUnique = (key) => {
        const unique = [...new Set(transactions.map(t => t[key]))].sort();
        if (key === 'accounting_date' || key === 'invoice_date') {
            return unique.reverse();
        }
        return unique;
    };
    
    const [filterState, setFilterState] = useState({
        accountingDate: getUnique('accounting_date'),
        invoiceDate: getUnique('invoice_date'),
        code: getUnique('code'),
        correspondingAccount: getUnique('corresponding_account'),
        recipient: getUnique('recipient'),
        createdBy: getUnique('created_by'),
        projectName: getUnique('project_name')
    });

    const [textFilters, setTextFilters] = useState({
        invoiceNo: '', note: ''
    });

    const handleSort = (key, direction) => {
        setSortConfig({ key, direction });
    };

    // Cập nhật filterState khi transactions thay đổi (ví dụ: sau khi fetch mới)
    useEffect(() => {
        setFilterState({
            accountingDate: getUnique('accounting_date'),
            invoiceDate: getUnique('invoice_date'),
            code: getUnique('code'),
            correspondingAccount: getUnique('corresponding_account'),
            recipient: getUnique('recipient'),
            createdBy: getUnique('created_by'),
            projectName: getUnique('project_name')
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
        
        if (sortConfig.key === 'accounting_date' || sortConfig.key === 'invoice_date') {
            return sortConfig.direction === 'asc' 
                ? new Date(valA) - new Date(valB)
                : new Date(valB) - new Date(valA);
        }
        
        const strA = (valA || '').toString().toLowerCase();
        const strB = (valB || '').toString().toLowerCase();
        
        if (sortConfig.direction === 'asc') {
            return strA.localeCompare(strB, 'vi');
        } else {
            return strB.localeCompare(strA, 'vi');
        }
    });

    return (
        <div className="animate-in fade-in duration-500">
            <div className="mb-6 flex flex-wrap justify-between items-end gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Lịch sử chi tiền</h2>
                    <p className="text-slate-500 text-sm mt-1">
                        Dự án: <span className="font-bold text-blue-600">{selectedProject || 'Tất cả'}</span>
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => setIsPasting(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2 shadow-lg transition">
                        <Upload size={16} /> Nhập từ Excel
                    </button>
                    <button onClick={() => handleCopyTable('history-table')} className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-700 flex items-center gap-2 shadow-lg transition">
                        <Copy size={16} /> Copy cho Excel
                    </button>
                    <button onClick={() => exportTableToExcel('history-table', 'LichSuChiTien')} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 flex items-center gap-2 shadow-lg transition">
                        <Download size={16} /> Xuất Excel
                    </button>
                    {canDelete && isAdmin && handleDeleteAll && selectedProject && (
                        <button onClick={() => { if(window.confirm(`Bạn có chắc chắn muốn xóa TOÀN BỘ dữ liệu giao dịch của công trình "${selectedProject}"? Hành động này không thể hoàn tác!`)) handleDeleteAll(); }} className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700 flex items-center gap-2 shadow-lg transition">
                            <Trash2 size={16} /> Xóa tất cả
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 320px)' }}>
                <div className="overflow-auto custom-scrollbar flex-1" style={{ minHeight: '400px' }}>
                    <table id="history-table" className="w-full text-left text-[13px] border-collapse sticky-header">
                        <thead className="bg-slate-100 sticky top-0 z-20 shadow-sm">
                            <tr>
                                <th className="p-3 border-b border-r border-slate-200 font-bold text-slate-700 text-center w-12 align-middle">STT</th>
                                <th className="p-3 border-b border-r border-slate-200 font-bold text-slate-700 whitespace-nowrap align-middle">
                                    Công trình
                                    <TableFilter title="Công trình" options={getUnique('project_name')} selectedValues={filterState.projectName} onToggle={(v) => handleToggle('projectName', v)} onSelectAll={() => handleSelectAll('projectName')} onClear={() => handleClear('projectName')} onSort={(dir) => handleSort('project_name', dir)} />
                                </th>
                                <th className="p-3 border-b border-r border-slate-200 font-bold text-slate-700 whitespace-nowrap align-middle">
                                    Ngày hạch toán
                                    <TableFilter title="Ngày hạch toán" options={getUnique('accounting_date')} selectedValues={filterState.accountingDate} onToggle={(v) => handleToggle('accountingDate', v)} onSelectAll={() => handleSelectAll('accountingDate')} onClear={() => handleClear('accountingDate')} onSort={(dir) => handleSort('accounting_date', dir)} />
                                </th>
                                <th className="p-3 border-b border-r border-slate-200 font-bold text-slate-700 whitespace-nowrap align-middle">
                                    Ngày hóa đơn
                                    <TableFilter title="Ngày hóa đơn" options={getUnique('invoice_date')} selectedValues={filterState.invoiceDate} onToggle={(v) => handleToggle('invoiceDate', v)} onSelectAll={() => handleSelectAll('invoiceDate')} onClear={() => handleClear('invoiceDate')} onSort={(dir) => handleSort('invoice_date', dir)} />
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
                                    <TableFilter title="Tài khoản" options={getUnique('code')} selectedValues={filterState.code} onToggle={(v) => handleToggle('code', v)} onSelectAll={() => handleSelectAll('code')} onClear={() => handleClear('code')} onSort={(dir) => handleSort('code', dir)} />
                                </th>
                                <th className="p-3 border-b border-r border-slate-200 font-bold text-slate-700 align-middle">
                                    TK đối ứng
                                    <TableFilter title="TK đối ứng" options={getUnique('corresponding_account')} selectedValues={filterState.correspondingAccount} onToggle={(v) => handleToggle('correspondingAccount', v)} onSelectAll={() => handleSelectAll('correspondingAccount')} onClear={() => handleClear('correspondingAccount')} onSort={(dir) => handleSort('corresponding_account', dir)} />
                                </th>
                                <th className="p-3 border-b border-r border-slate-200 font-bold text-slate-700 text-right align-middle">Phát sinh Nợ</th>
                                <th className="p-3 border-b border-r border-slate-200 font-bold text-slate-700 text-right align-middle">Phát sinh Có</th>
                                <th className="p-3 border-b border-r border-slate-200 font-bold text-slate-700 text-right align-middle">Số tiền</th>
                                <th className="p-3 border-b border-r border-slate-200 font-bold text-slate-700 align-middle">
                                    Tên đối tượng
                                    <TableFilter title="Tên đối tượng" options={getUnique('recipient')} selectedValues={filterState.recipient} onToggle={(v) => handleToggle('recipient', v)} onSelectAll={() => handleSelectAll('recipient')} onClear={() => handleClear('recipient')} onSort={(dir) => handleSort('recipient', dir)} />
                                </th>
                                <th className="p-3 border-b border-r border-slate-200 font-bold text-slate-700 align-middle">
                                    Người nhập
                                    <TableFilter title="Người nhập" options={getUnique('created_by')} selectedValues={filterState.createdBy} onToggle={(v) => handleToggle('createdBy', v)} onSelectAll={() => handleSelectAll('createdBy')} onClear={() => handleClear('createdBy')} onSort={(dir) => handleSort('created_by', dir)} />
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
                                    <td className="p-3 border-r border-slate-100 max-w-[250px] truncate" title={t.note}>{t.note}</td>
                                    <td className="p-3 border-r border-slate-100 font-bold text-blue-700">{t.code}</td>
                                    <td className="p-3 border-r border-slate-100 font-bold text-slate-600">{t.corresponding_account || '-'}</td>
                                    <td className="p-3 border-r border-slate-100 text-right text-red-600 font-medium">{t.debit > 0 ? formatCurrency(t.debit) : ''}</td>
                                    <td className="p-3 border-r border-slate-100 text-right text-green-600 font-medium">{t.credit > 0 ? formatCurrency(t.credit) : ''}</td>
                                    <td className={`p-3 border-r border-slate-100 text-right font-bold ${(t.credit - t.debit) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                        {formatCurrency(t.credit - t.debit)}
                                    </td>
                                    <td className="p-3 border-r border-slate-100">{t.recipient || '-'}</td>
                                    <td className="p-3 border-r border-slate-100 text-slate-500 italic">{t.created_by || '-'}</td>
                                    <td className="p-3 text-center align-middle">
                                        <div className="flex justify-center gap-2">
                                            <button onClick={() => handleEdit(t)} className="text-amber-500 hover:bg-amber-50 p-1 rounded transition"><Edit size={14} /></button>
                                            <button onClick={() => { if(window.confirm('Bạn có chắc chắn muốn xóa?')) handleDelete(t.id); }} className="text-red-500 hover:bg-red-50 p-1 rounded transition"><Trash2 size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredTransactions.length === 0 && (
                                <tr>
                                    <td colSpan="13" className="p-8 text-center text-slate-400 italic">Không có dữ liệu phù hợp.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

