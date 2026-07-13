'use client';

import React, { useState, useMemo } from 'react';
import { PieChart, Download, Copy, Search, Printer, EyeOff } from 'lucide-react';
import { formatCurrency, EXPENSE_CATEGORIES } from '@/lib/utils';

export default function ExpenseSummary({ projects, projectDetails = {}, transactions, dashboardData = [], handleCopyTable, exportTableToExcel, onProjectDoubleClick }) {
    const [filterText, setFilterText] = useState('');
    const [hiddenProjects, setHiddenProjects] = useState([]);

    const toggleHideProject = (projectName) => {
        setHiddenProjects(prev => 
            prev.includes(projectName) 
                ? prev.filter(p => p !== projectName)
                : [...prev, projectName]
        );
    };

    const renderExpense = (val) => {
        if (!val || val === 0) return '-';
        if (val > 0) {
            return <span className="text-red-500 font-bold">({formatCurrency(val)})</span>;
        }
        return <span className="text-green-600 font-bold">{formatCurrency(Math.abs(val))}</span>;
    };

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
        return expenseMatrixData.filter(d => 
            d.project.toLowerCase().includes(filterText.toLowerCase()) && 
            !hiddenProjects.includes(d.project)
        );
    }, [expenseMatrixData, filterText, hiddenProjects]);

    const transposedRows = useMemo(() => {
        return EXPENSE_CATEGORIES.map(cat => {
            const row = { category: cat, total: 0 };
            filteredData.forEach(d => {
                row[d.project] = d[cat.code];
                row.total += d[cat.code];
            });
            return row;
        });
    }, [filteredData]);

    const transposedTotals = useMemo(() => {
        const t = { total: 0 };
        filteredData.forEach(d => {
            t[d.project] = d.total;
            t.total += d.total;
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
                            const printTableWidth = Math.max(550, 200 + filteredData.length * 220);
                            const printCSS = `
                                *{box-sizing:border-box;margin:0;padding:0}
                                body{font-family:Arial,sans-serif;font-size:10px;padding:20px;color:#000!important;background:#fff!important}
                                h2{text-align:center;font-size:16px;margin-bottom:15px;font-weight:bold;color:#000!important;text-transform:uppercase;letter-spacing:1px}
                                .print-container{display:flex;justify-content:center;width:100%;margin-top:20px}
                                table{border-collapse:collapse;width:${printTableWidth}px;max-width:100%;font-size:10px;box-shadow:0 0 10px rgba(0,0,0,0.05)}
                                th,td{border:1px solid #bbb!important;padding:6px 8px!important;text-align:left!important;vertical-align:middle!important;color:#000!important;background:#fff!important}
                                thead th:first-child,tbody td:first-child,tfoot td:first-child{text-align:left!important;font-weight:bold;font-size:10px}
                                thead th{background:#f2f2f2!important;font-weight:bold;text-align:center!important;font-size:10px}
                                tbody tr:nth-child(even) td{background:#fafafa!important}
                                tfoot td{background:#e8e8e8!important;font-weight:bold;color:#000!important;font-size:10.5px}
                                .empty-column{display:none!important}
                                button, .opacity-0, svg, .absolute{display:none!important}
                                th span{margin-left:0!important;display:block;text-align:center}
                                @media print{body{padding:10px}@page{size:landscape;margin:1cm}}
                            `;
                            const w = window.open('','_blank','width=1400,height=800');
                            w.document.write(`<html><head><title>Tổng Hợp Chi Phí</title><style>${printCSS}</style></head><body><h2>Tổng Hợp Chi Phí</h2><div class="print-container">${t.outerHTML}</div></body></html>`);
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

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden" style={{ height: 'calc(100vh - 160px)', minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
                <div className="p-4 border-b bg-slate-50 flex flex-col gap-3 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <Search size={18} className="text-slate-400" />
                        <input 
                            type="text" 
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                            placeholder="Tìm kiếm công trình..."
                            className="bg-transparent outline-none font-bold text-slate-700 w-full"
                        />
                    </div>
                    {hiddenProjects.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                            <span className="text-xs text-slate-500 font-medium">Đã ẩn:</span>
                            {hiddenProjects.map(p => (
                                <span key={p} onClick={() => toggleHideProject(p)} className="inline-flex items-center gap-1 bg-white border border-slate-200 shadow-sm text-slate-700 text-[10px] px-2 py-1 rounded-md font-bold cursor-pointer hover:bg-slate-100 transition-colors">
                                    {p} <span className="text-slate-400 hover:text-red-500 font-bold ml-1">×</span>
                                </span>
                            ))}
                        </div>
                    )}
                </div>
                <div className="overflow-auto custom-scrollbar flex-1" style={{ overflowX: 'auto', overflowY: 'auto' }}>
                    <table id="expense-table" className="w-full text-left text-sm border-collapse">
                        <thead>
                            <tr className="bg-slate-100 text-slate-700 text-[11px] uppercase tracking-wider">
                                <th className="p-3 border-b border-r border-slate-200 font-bold sticky left-0 top-0 bg-slate-100 z-30 w-[180px] min-w-[180px] max-w-[180px]">
                                    Chi tiết
                                </th>
                                {filteredData.map(d => (
                                    <th 
                                        key={d.project} 
                                        className="p-3 border-b border-r border-slate-200 font-bold text-right w-[150px] min-w-[150px] max-w-[200px] hover:bg-slate-200 transition-colors group relative sticky top-0 bg-slate-100 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-all absolute left-2">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); toggleHideProject(d.project); }}
                                                    className="p-1 text-slate-400 hover:text-red-500 rounded focus:opacity-100 bg-white shadow-sm border border-slate-200"
                                                    title="Ẩn công trình này"
                                                >
                                                    <EyeOff size={14} />
                                                </button>
                                            </div>
                                            <span className="cursor-pointer truncate ml-14" title="Nhấp đúp để xem chi tiết công trình" onDoubleClick={() => onProjectDoubleClick && onProjectDoubleClick(d.project)}>
                                                {d.project}
                                            </span>
                                        </div>
                                    </th>
                                ))}
                                <th className="p-3 border-b border-slate-200 sticky top-0 bg-slate-100 z-20 w-full min-w-[50px] empty-column"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {transposedRows.map((row) => (
                                <tr 
                                    key={row.category.code} 
                                    className="border-b transition bg-white even:bg-slate-100 hover:bg-blue-50"
                                >
                                    <td className="p-3 border-r border-slate-100 font-bold sticky left-0 bg-inherit z-10 text-slate-800 w-[180px] min-w-[180px] max-w-[180px]" title={row.category.name}>
                                        {row.category.name}
                                        <div className="text-[10px] text-slate-500 font-normal mt-0.5 leading-tight">{row.category.code}</div>
                                    </td>
                                    {filteredData.map(d => (
                                        <td key={d.project} data-excel-value={row[d.project] !== 0 ? -row[d.project] : ''} className="p-3 border-r border-slate-100 text-right w-[150px] min-w-[150px] max-w-[200px]">
                                            {renderExpense(row[d.project])}
                                        </td>
                                    ))}
                                    <td className="p-3 border-slate-100 w-full empty-column"></td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-black text-white font-bold text-xs sticky bottom-0 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                            <tr className="bg-black">
                                <td className="p-1.5 px-3 border-r border-t-[3px] border-t-slate-400 border-slate-800 sticky left-0 bg-black z-40 uppercase w-[180px] min-w-[180px] max-w-[180px]">TỔNG CHI PHÍ</td>
                                {filteredData.map(d => (
                                    <td key={d.project} data-excel-value={transposedTotals[d.project] !== 0 ? -transposedTotals[d.project] : ''} className="p-1.5 px-3 border-r border-t-[3px] border-t-slate-400 border-slate-800 bg-black text-right w-[150px] min-w-[150px] max-w-[200px]">
                                        {renderExpense(transposedTotals[d.project])}
                                    </td>
                                ))}
                                <td className="p-1.5 px-3 border-t-[3px] border-t-slate-400 border-slate-800 bg-black w-full empty-column"></td>
                            </tr>
                            <tr className="bg-black border-t border-slate-800">
                                <td className="p-1.5 px-3 border-r border-slate-800 sticky left-0 bg-black z-40 uppercase w-[180px] min-w-[180px] max-w-[180px] leading-tight">ĐÃ THU</td>
                                {filteredData.map(d => {
                                    const projData = dashboardData.find(item => item.project === d.project);
                                    const totalReceivedBeforeVat = projData ? projData.totalReceivedBeforeVat : 0;
                                    return (
                                        <td key={d.project} data-excel-value={totalReceivedBeforeVat !== 0 ? totalReceivedBeforeVat : ''} className="p-1.5 px-3 border-r border-slate-800 bg-black text-right w-[150px] min-w-[150px] max-w-[200px]">
                                            {totalReceivedBeforeVat !== 0 ? <span className="text-sky-400 font-bold">{formatCurrency(totalReceivedBeforeVat)}</span> : '-'}
                                        </td>
                                    );
                                })}
                                <td className="p-1.5 px-3 border-slate-800 bg-black w-full empty-column"></td>
                            </tr>
                            <tr className="bg-black border-t border-slate-800">
                                <td className="p-1.5 px-3 border-r border-slate-800 sticky left-0 bg-black z-40 uppercase w-[180px] min-w-[180px] max-w-[180px] leading-tight">CHƯA THU</td>
                                {filteredData.map(d => {
                                    const projData = dashboardData.find(item => item.project === d.project);
                                    const unreceivedPhaseBeforeVat = projData ? projData.unreceivedPhaseBeforeVat : 0;
                                    return (
                                        <td key={d.project} data-excel-value={unreceivedPhaseBeforeVat !== 0 ? unreceivedPhaseBeforeVat : ''} className="p-1.5 px-3 border-r border-slate-800 bg-black text-right w-[150px] min-w-[150px] max-w-[200px]">
                                            {unreceivedPhaseBeforeVat !== 0 ? <span className="text-purple-300 font-bold">{formatCurrency(unreceivedPhaseBeforeVat)}</span> : '-'}
                                        </td>
                                    );
                                })}
                                <td className="p-1.5 px-3 border-slate-800 bg-black w-full empty-column"></td>
                            </tr>
                            <tr className="bg-black border-t border-slate-800">
                                <td className="p-1.5 px-3 border-r border-slate-800 sticky left-0 bg-black z-40 uppercase w-[180px] min-w-[180px] max-w-[180px] leading-tight">LỢI NHUẬN CHƯA THU</td>
                                {filteredData.map(d => {
                                    const projData = dashboardData.find(item => item.project === d.project);
                                    const uncollectedProfit = projData ? projData.uncollectedProfit : 0;
                                    return (
                                        <td key={d.project} data-excel-value={uncollectedProfit !== 0 ? uncollectedProfit : ''} className="p-1.5 px-3 border-r border-slate-800 bg-black text-right w-[150px] min-w-[150px] max-w-[200px]">
                                            {uncollectedProfit !== 0 ? (
                                                <span className={`font-bold ${uncollectedProfit > 0 ? 'text-blue-400' : 'text-red-400'}`}>
                                                    {uncollectedProfit > 0 ? formatCurrency(uncollectedProfit) : `(${formatCurrency(Math.abs(uncollectedProfit))})`}
                                                </span>
                                            ) : '-'}
                                        </td>
                                    );
                                })}
                                <td className="p-1.5 px-3 border-slate-800 bg-black w-full empty-column"></td>
                            </tr>
                            <tr className="bg-black border-t border-slate-800">
                                <td className="p-1.5 px-3 border-r border-slate-800 sticky left-0 bg-black z-40 uppercase w-[180px] min-w-[180px] max-w-[180px]">LỢI NHUẬN</td>
                                {filteredData.map(d => {
                                    const projData = dashboardData.find(item => item.project === d.project);
                                    const profit = projData ? projData.profit : 0;
                                    return (
                                        <td key={d.project} data-excel-value={profit !== 0 ? profit : ''} className="p-1.5 px-3 border-r border-slate-800 bg-black text-right w-[150px] min-w-[150px] max-w-[200px]">
                                            {profit !== 0 ? (
                                                <span className={`font-bold ${profit > 0 ? 'text-blue-400' : 'text-red-400'}`}>
                                                    {profit > 0 ? formatCurrency(profit) : `(${formatCurrency(Math.abs(profit))})`}
                                                </span>
                                            ) : '-'}
                                        </td>
                                    );
                                })}
                                <td className="p-1.5 px-3 border-slate-800 bg-black w-full empty-column"></td>
                            </tr>

                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}
