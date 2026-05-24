'use client';

import React, { useState, useMemo } from 'react';
import { PieChart, Download, Copy, Search, Printer } from 'lucide-react';
import { formatCurrency, EXPENSE_CATEGORIES } from '@/lib/utils';

export default function ExpenseSummary({ projects, projectDetails = {}, transactions, handleCopyTable, exportTableToExcel, onProjectDoubleClick }) {
    const [filterText, setFilterText] = useState('');

    const expenseMatrixData = useMemo(() => {
        return projects.map(p => {
            const row = { project: p.name, total: 0 };
            EXPENSE_CATEGORIES.forEach(cat => {
                const amount = transactions
                    .filter(t => t.project_name === p.name && t.code?.toString().trim().replace(',', '.') === cat.code)
                    .reduce((sum, t) => sum + (t.debit || 0) - (t.credit || 0), 0);
                row[cat.code] = amount;
                row.total += amount;
            });
            return row;
        });
    }, [transactions, projects]);

    const filteredData = useMemo(() => {
        return expenseMatrixData.filter(d => d.project.toLowerCase().includes(filterText.toLowerCase()));
    }, [expenseMatrixData, filterText]);

    const totals = useMemo(() => {
        const t = { total: 0 };
        EXPENSE_CATEGORIES.forEach(cat => {
            const sum = filteredData.reduce((acc, row) => acc + row[cat.code], 0);
            t[cat.code] = sum;
            t.total += sum;
        });
        return t;
    }, [filteredData]);

    return (
        <div className="animate-in fade-in duration-500">
            <header className="mb-6 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <PieChart className="text-blue-600" /> Tổng Hợp Chi Phí
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Phân tích chi tiết các khoản chi theo từng mã chi phí cho các công trình. (Nhấp đúp vào dòng để xem chi tiết)</p>
                </div>
                <div className="flex gap-2 w-full lg:w-auto">
                    <button onClick={() => handleCopyTable('expense-table')} className="flex-1 lg:flex-none justify-center bg-slate-800 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-700 transition flex items-center gap-2">
                        <Copy size={16} /> Copy Bảng
                    </button>
                    <button onClick={() => {
                        const t = document.getElementById('expense-table');
                        if(t){
                            const printCSS = `
                                *{box-sizing:border-box;margin:0;padding:0}
                                body{font-family:Arial,sans-serif;font-size:9px;padding:8px;color:#000!important;background:#fff!important}
                                h2{text-align:center;font-size:13px;margin-bottom:8px;font-weight:bold;color:#000!important}
                                table{border-collapse:collapse;width:100%;font-size:8px}
                                th,td{border:1px solid #aaa!important;padding:3px 4px!important;text-align:right!important;color:#000!important;background:#fff!important}
                                thead th:first-child,tbody td:first-child,tfoot td:first-child{text-align:left!important;font-weight:bold}
                                thead th{background:#e8e8e8!important;font-weight:bold;text-align:center!important}
                                tbody tr:nth-child(even) td{background:#f5f5f5!important}
                                tfoot td{background:#ddd!important;font-weight:bold;color:#000!important}
                                @media print{body{padding:4px}@page{size:landscape}}
                            `;
                            const w = window.open('','_blank','width=1400,height=800');
                            w.document.write(`<html><head><title>Tổng Hợp Chi Phí</title><style>${printCSS}</style></head><body><h2>Tổng Hợp Chi Phí</h2>${t.outerHTML}</body></html>`);
                            w.document.close();
                            setTimeout(()=>{w.print();},800);
                        }
                    }} className="flex-1 lg:flex-none justify-center bg-purple-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-purple-700 transition flex items-center gap-2">
                        <Printer size={16} /> In Bảng
                    </button>
                    <button onClick={() => exportTableToExcel('expense-table', 'TongHopChiPhi')} className="flex-1 lg:flex-none justify-center bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 transition flex items-center gap-2">
                        <Download size={16} /> Xuất Excel
                    </button>
                </div>
            </header>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden" style={{ height: 'calc(100vh - 220px)', minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
                <div className="p-4 border-b bg-slate-50 flex items-center gap-3 flex-shrink-0">
                    <Search size={18} className="text-slate-400" />
                    <input 
                        type="text" 
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        placeholder="Tìm kiếm công trình..."
                        className="bg-transparent outline-none font-bold text-slate-700 w-full"
                    />
                </div>
                <div className="overflow-auto custom-scrollbar flex-1" style={{ overflowX: 'auto', overflowY: 'auto' }}>
                    <table id="expense-table" className="w-full text-left text-sm border-collapse min-w-[2000px]">
                        <thead>
                            <tr className="bg-slate-100 text-slate-700 text-[11px] uppercase tracking-wider">
                                <th className="p-3 border-b border-r border-slate-200 font-bold sticky left-0 bg-slate-100 z-20 min-w-[200px]">
                                    Công trình
                                </th>
                                <th className="p-3 border-b border-r border-slate-200 font-black text-red-600 text-right bg-red-50 min-w-[145px]">
                                    TỔNG CHI PHÍ
                                </th>
                                {EXPENSE_CATEGORIES.map(cat => (
                                    <th key={cat.code} className="p-3 border-b border-r border-slate-200 font-bold text-right min-w-[120px]" title={cat.name}>
                                        {cat.code}
                                        <div className="text-[9px] text-slate-400 font-normal normal-case mt-0.5">{cat.name}</div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.map((row, idx) => (
                                <tr 
                                    key={row.project} 
                                    className={`border-b transition cursor-pointer group bg-white odd:bg-slate-50/50 hover:bg-blue-50/50`}
                                    onDoubleClick={() => onProjectDoubleClick && onProjectDoubleClick(row.project)}
                                    title="Nhấp đúp để xem chi tiết công trình"
                                >
                                    <td className="p-3 border-r border-slate-100 font-bold sticky left-0 bg-inherit z-10 text-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                        {row.project}
                                    </td>
                                    <td className="p-3 border-r border-slate-100 font-black text-red-600 text-right bg-red-50/30">
                                        {formatCurrency(row.total)}
                                    </td>
                                    {EXPENSE_CATEGORIES.map(cat => (
                                        <td key={cat.code} className="p-3 border-r border-slate-100 text-right text-slate-600">
                                            {row[cat.code] !== 0 ? formatCurrency(row[cat.code]) : '-'}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-800 text-white font-bold sticky bottom-0 z-30">
                            <tr>
                                <td className="p-3 border-r border-slate-700 sticky left-0 bg-slate-800 z-40 uppercase">TỔNG CỘNG</td>
                                <td className="p-3 border-r border-slate-700 text-right text-red-400 font-black bg-slate-900/50">{formatCurrency(totals.total)}</td>
                                {EXPENSE_CATEGORIES.map(cat => (
                                    <td key={cat.code} className="p-3 border-r border-slate-700 text-right">{totals[cat.code] !== 0 ? formatCurrency(totals[cat.code]) : '-'}</td>
                                ))}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}
