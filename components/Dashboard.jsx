'use client';

import React, { useState, useMemo } from 'react';
import { Copy, Download, Check, Search, X, Printer, EyeOff } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function Dashboard({ 
    filteredDashboardData, 
    allPhases,
    handleTogglePhasePaid,
    handleSaveRemainingCost,
    handleSaveRecoveredAdvance,
    handleSaveUtilityValue,
    handleCopyTable,
    exportTableToExcel,
    onProjectDoubleClick
}) {
    const [filterText, setFilterText] = useState('');
    const [hiddenCols, setHiddenCols] = useState([]);
    const [promptModal, setPromptModal] = useState({ isOpen: false, project: '', value: '', type: '', title: '' });

    const toggleCol = (colId) => {
        setHiddenCols(prev => prev.includes(colId) ? prev.filter(c => c !== colId) : [...prev, colId]);
    };

    const COLUMN_NAMES = {
        contractValueAfterTax: 'Giá trị HĐ',
        debtToCollect: 'Công Nợ Cần Thu',
        totalExpense: 'Tổng Chi Phí',
        totalPhaseReceived: 'Thực nhận các đợt',
        totalReceivedAmount: 'Tổng G.Trị Thực nhận',
        profit: 'Lợi nhuận',
        totalActualIncome: 'Tổng SẢN LƯỢNG',
        phases: 'Chi tiết thu các đợt',
        advanceValue: 'Giá trị Tạm ứng',
        recoveredAdvance: 'Giá trị thu hồi',
        utilityValue: 'Giá trị tiện ích',
        remainingCost: 'Chi phí còn lại'
    };

    const handleOpenPrompt = (project, currentValue, type, title) => {
        setPromptModal({ isOpen: true, project, value: currentValue ? currentValue.toString() : '', type, title });
    };

    const handleClosePrompt = () => {
        setPromptModal({ isOpen: false, project: '', value: '', type: '', title: '' });
    };

    const handleSubmitPrompt = () => {
        if (promptModal.type === 'REMAINING_COST' && handleSaveRemainingCost) {
            handleSaveRemainingCost(promptModal.project, promptModal.value);
        } else if (promptModal.type === 'RECOVERED_ADVANCE' && handleSaveRecoveredAdvance) {
            handleSaveRecoveredAdvance(promptModal.project, promptModal.value);
        } else if (promptModal.type === 'UTILITY_VALUE' && handleSaveUtilityValue) {
            handleSaveUtilityValue(promptModal.project, promptModal.value);
        }
        handleClosePrompt();
    };

    const filteredData = useMemo(() => {
        return filteredDashboardData.filter(row => 
            row.project.toLowerCase().includes(filterText.toLowerCase())
        );
    }, [filteredDashboardData, filterText]);

    const computedTotals = useMemo(() => {
        return filteredData.reduce((acc, row) => ({
            contractValueAfterTax: acc.contractValueAfterTax + (row.contractValueAfterTax || 0),
            debtToCollect: acc.debtToCollect + (row.debtToCollect || 0),
            totalExpense: acc.totalExpense + row.totalExpense,
            totalActualIncome: acc.totalActualIncome + row.totalActualIncome,
            advanceValue: acc.advanceValue + (row.advanceValue || 0),
            totalReceivedAmount: acc.totalReceivedAmount + row.totalReceivedAmount,
            remainingCost: acc.remainingCost + (row.remainingCost || 0),
            recoveredAdvance: acc.recoveredAdvance + (row.recoveredAdvance || 0),
            utilityValue: acc.utilityValue + (row.utilityValue || 0),
            profit: acc.profit + row.profit
        }), { contractValueAfterTax: 0, debtToCollect: 0, totalExpense: 0, totalActualIncome: 0, advanceValue: 0, totalReceivedAmount: 0, remainingCost: 0, recoveredAdvance: 0, utilityValue: 0, profit: 0 });
    }, [filteredData]);

    return (
        <div className="animate-in fade-in duration-500 max-w-full mx-auto">
            <header className="mb-6 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Bảng Tổng Hợp Thu - Chi</h2>
                    <p className="text-slate-500 text-sm mt-1">Tick chọn vào ô tương ứng ở Đợt thu để xác nhận đã nhận tiền.</p>
                </div>
                <div className="flex gap-2 w-full lg:w-auto">
                    <button onClick={() => handleCopyTable('dashboard-table')} className="flex-1 lg:flex-none justify-center bg-slate-800 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-slate-700 flex items-center gap-2 shadow-lg transition">
                        <Copy size={16} /> Copy Bảng
                    </button>
                    <button onClick={() => {
                        const t = document.getElementById('dashboard-table');
                        if(t){
                            const printCSS = `
                                *{box-sizing:border-box;margin:0;padding:0}
                                body{font-family:Arial,sans-serif;font-size:10px;padding:8px;color:#000!important;background:#fff!important}
                                h2{text-align:center;font-size:13px;margin-bottom:8px;font-weight:bold;color:#000!important}
                                table{border-collapse:collapse;width:100%;font-size:9px}
                                th,td{border:1px solid #aaa!important;padding:3px 5px!important;text-align:right!important;color:#000!important;background:#fff!important}
                                thead th:first-child,tbody td:first-child,tfoot td:first-child{text-align:left!important;font-weight:bold}
                                thead th{background:#e8e8e8!important;font-weight:bold;text-align:center!important}
                                tbody tr:nth-child(even) td{background:#f5f5f5!important}
                                tfoot td{background:#ddd!important;font-weight:bold;color:#000!important}
                                button,svg{display:none!important}
                                @media print{body{padding:4px}}
                            `;
                            const w = window.open('','_blank','width=1200,height=800');
                            w.document.write(`<html><head><title>B\u1ea3ng T\u1ed5ng H\u1ee3p Thu - Chi</title><style>${printCSS}</style></head><body><h2>B\u1ea3ng T\u1ed5ng H\u1ee3p Thu - Chi</h2>${t.outerHTML}</body></html>`);
                            w.document.close();
                            setTimeout(()=>{w.print();},800);
                        }
                    }} className="flex-1 lg:flex-none justify-center bg-purple-600 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-purple-700 flex items-center gap-2 shadow-lg transition">
                        <Printer size={16} /> In Bảng
                    </button>
                    <button onClick={() => exportTableToExcel('dashboard-table', 'TongHopThuChi')} className="flex-1 lg:flex-none justify-center bg-green-600 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-green-700 flex items-center gap-2 shadow-lg transition">
                        <Download size={16} /> Xuất Excel
                    </button>
                </div>
            </header>

            <div className="md:hidden text-xs text-blue-600 mb-2 flex items-center gap-1 font-medium bg-blue-50 p-2 rounded-lg border border-blue-100">
                <span>👉</span> Vuốt ngang bảng để xem đầy đủ thông tin thu chi
            </div>

            {/* Bảng: giới hạn chiều cao để thanh scroll ngang luôn hiển thị */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden w-full" style={{ height: 'calc(100vh - 220px)', minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
                <div className="p-4 border-b bg-slate-50 flex flex-col gap-3 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <Search size={18} className="text-slate-400" />
                        <div className="relative w-full flex items-center">
                            <input 
                                type="text" 
                                value={filterText}
                                onChange={(e) => setFilterText(e.target.value)}
                                placeholder="Tìm kiếm công trình..."
                                className="bg-transparent outline-none font-bold text-slate-700 w-full pr-8"
                                list="dashboard-projects"
                            />
                            {filterText && (
                                <button 
                                    onClick={() => setFilterText('')}
                                    className="absolute right-0 p-1 text-slate-400 hover:text-red-500 rounded-full hover:bg-slate-200 transition-colors"
                                    title="Xóa tìm kiếm"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                    </div>
                    {hiddenCols.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                            <span className="text-xs text-slate-500 font-medium">Cột đã ẩn:</span>
                            {hiddenCols.map(colId => (
                                <span key={colId} onClick={() => toggleCol(colId)} className="inline-flex items-center gap-1 bg-white border border-slate-200 shadow-sm text-slate-700 text-[10px] px-2 py-1 rounded-md font-bold cursor-pointer hover:bg-slate-100 transition-colors">
                                    {COLUMN_NAMES[colId]} <span className="text-slate-400 hover:text-red-500 font-bold ml-1">×</span>
                                </span>
                            ))}
                        </div>
                    )}
                    <datalist id="dashboard-projects">
                        {filteredDashboardData.map(row => (
                            <option key={row.project} value={row.project} />
                        ))}
                    </datalist>
                </div>
                <div className="overflow-auto custom-scrollbar flex-1" style={{ overflowX: 'auto', overflowY: 'auto' }}>
                    <table id="dashboard-table" className="w-full text-left text-[11px] md:text-sm border-separate border-spacing-0 min-w-[1200px] lg:min-w-[1500px]">
                        <thead className="sticky top-0 z-30 bg-slate-100">
                            <tr className="text-slate-700 uppercase tracking-wider">
                                <th className="p-3 border-b border-r border-slate-200 font-bold sticky left-0 top-0 bg-slate-100 z-40 min-w-[100px] max-w-[110px] lg:min-w-[150px] lg:max-w-[250px] whitespace-normal break-words align-middle" rowSpan="2">
                                    Công trình
                                </th>
                                {!hiddenCols.includes('contractValueAfterTax') && <th className="p-3 border-b border-r border-slate-200 font-bold text-right align-top bg-slate-100 min-w-[120px] group relative" rowSpan="2">
                                    <button onClick={() => toggleCol('contractValueAfterTax')} className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all p-1 bg-slate-200/50 rounded" title="Ẩn cột này"><EyeOff size={14} /></button>
                                    Giá trị HĐ<br />(Trước thuế)
                                </th>}
                                {!hiddenCols.includes('debtToCollect') && <th className="p-3 border-b border-r border-slate-200 font-black text-right text-orange-600 bg-orange-50 align-top min-w-[120px] group relative" rowSpan="2">
                                    <button onClick={() => toggleCol('debtToCollect')} className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 text-orange-400 hover:text-red-500 transition-all p-1 bg-orange-100/50 rounded" title="Ẩn cột này"><EyeOff size={14} /></button>
                                    Công Nợ<br />Cần Thu
                                </th>}
                                {!hiddenCols.includes('totalExpense') && <th className="p-3 border-b border-r border-slate-200 font-bold text-right text-red-600 bg-red-50 align-top min-w-[120px] group relative" rowSpan="2">
                                    <button onClick={() => toggleCol('totalExpense')} className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-700 transition-all p-1 bg-red-100/50 rounded" title="Ẩn cột này"><EyeOff size={14} /></button>
                                    Tổng Chi Phí
                                </th>}
                                {!hiddenCols.includes('totalPhaseReceived') && <th className="p-3 border-b border-r border-slate-200 font-bold text-right text-emerald-700 bg-emerald-50 align-top min-w-[120px] group relative" rowSpan="2">
                                    <button onClick={() => toggleCol('totalPhaseReceived')} className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 text-emerald-400 hover:text-red-500 transition-all p-1 bg-emerald-100/50 rounded" title="Ẩn cột này"><EyeOff size={14} /></button>
                                    Thực nhận<br/>các đợt
                                </th>}
                                {!hiddenCols.includes('totalReceivedAmount') && <th className="p-3 border-b border-r border-slate-200 font-bold text-right text-teal-700 bg-teal-50 align-top min-w-[120px] group relative" rowSpan="2">
                                    <button onClick={() => toggleCol('totalReceivedAmount')} className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 text-teal-400 hover:text-red-500 transition-all p-1 bg-teal-100/50 rounded" title="Ẩn cột này"><EyeOff size={14} /></button>
                                    Tổng G.Trị<br/>Thực nhận
                                </th>}
                                {!hiddenCols.includes('profit') && <th className="p-3 border-b border-r border-slate-200 font-bold text-right text-indigo-700 bg-indigo-50 align-top min-w-[120px] group relative" rowSpan="2">
                                    <button onClick={() => toggleCol('profit')} className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 text-indigo-400 hover:text-red-500 transition-all p-1 bg-indigo-100/50 rounded" title="Ẩn cột này"><EyeOff size={14} /></button>
                                    Lợi nhuận
                                </th>}
                                {!hiddenCols.includes('totalActualIncome') && <th className="p-3 border-b border-r-2 border-slate-300 font-bold text-right text-green-600 bg-green-50 align-top min-w-[120px] group relative" rowSpan="2">
                                    <button onClick={() => toggleCol('totalActualIncome')} className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 text-green-400 hover:text-red-500 transition-all p-1 bg-green-100/50 rounded" title="Ẩn cột này"><EyeOff size={14} /></button>
                                    Tổng SẢN LƯỢNG
                                </th>}
                                {!hiddenCols.includes('phases') && allPhases.length > 0 && <th className="p-2 border-b border-slate-200 font-bold text-center bg-yellow-50 text-yellow-800 relative group" colSpan={allPhases.length}>
                                    <button onClick={() => toggleCol('phases')} className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 text-yellow-600 hover:text-red-500 transition-all p-1 bg-yellow-100/50 rounded" title="Ẩn nhóm cột này"><EyeOff size={14} /></button>
                                    CHI TIẾT THU CÁC ĐỢT
                                </th>}
                                {!hiddenCols.includes('advanceValue') && <th className="p-3 border-b border-l-2 border-slate-300 border-r border-slate-300 font-bold text-right text-amber-700 bg-amber-50 align-top min-w-[120px] group relative" rowSpan="2">
                                    <button onClick={() => toggleCol('advanceValue')} className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 text-amber-400 hover:text-red-500 transition-all p-1 bg-amber-100/50 rounded" title="Ẩn cột này"><EyeOff size={14} /></button>
                                    Giá trị<br />Tạm ứng
                                </th>}
                                {!hiddenCols.includes('recoveredAdvance') && <th className="p-3 border-b border-r border-slate-300 font-bold text-right text-cyan-700 bg-cyan-50 align-top min-w-[120px] group relative" rowSpan="2">
                                    <button onClick={() => toggleCol('recoveredAdvance')} className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 text-cyan-400 hover:text-red-500 transition-all p-1 bg-cyan-100/50 rounded" title="Ẩn cột này"><EyeOff size={14} /></button>
                                    Giá trị<br />thu hồi tạm ứng
                                </th>}
                                {!hiddenCols.includes('utilityValue') && <th className="p-3 border-b border-r border-slate-300 font-bold text-right text-violet-700 bg-violet-50 align-top min-w-[120px] group relative" rowSpan="2">
                                    <button onClick={() => toggleCol('utilityValue')} className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 text-violet-400 hover:text-red-500 transition-all p-1 bg-violet-100/50 rounded" title="Ẩn cột này"><EyeOff size={14} /></button>
                                    Giá trị<br />tiện ích
                                </th>}
                                {!hiddenCols.includes('remainingCost') && <th className="p-3 border-b border-slate-300 font-bold text-right text-pink-700 bg-pink-50 align-top min-w-[120px] group relative" rowSpan="2">
                                    <button onClick={() => toggleCol('remainingCost')} className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 text-pink-400 hover:text-red-500 transition-all p-1 bg-pink-100/50 rounded" title="Ẩn cột này"><EyeOff size={14} /></button>
                                    Chi phí<br />còn lại
                                </th>}
                            </tr>
                            {!hiddenCols.includes('phases') && allPhases.length > 0 && (
                                <tr className="bg-yellow-50 text-slate-600">
                                    {allPhases.map(phase => (<th key={phase} className="p-2 border-b border-r border-slate-200 text-center font-bold text-xs min-w-[100px] bg-yellow-50">{phase}</th>))}
                                </tr>
                            )}
                        </thead>
                        <tbody>
                            {filteredData.map((row, idx) => (
                                <tr key={row.project} className={`hover:bg-slate-100 transition ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                                    <td 
                                        className="p-3 font-bold text-slate-800 border-b border-r border-slate-100 sticky left-0 bg-inherit z-10 max-w-[110px] lg:max-w-[250px] whitespace-normal break-words cursor-pointer hover:text-indigo-700 hover:underline transition-colors"
                                        onDoubleClick={() => onProjectDoubleClick && onProjectDoubleClick(row.project)}
                                        title="Nhấp đúp để xem chi tiết công trình"
                                    >{row.project}</td>
                                    {!hiddenCols.includes('contractValueAfterTax') && <td className="p-3 text-right font-medium border-b border-r border-slate-100 text-[13px] tabular-nums">{formatCurrency(row.contractValueAfterTax)}</td>}
                                    {!hiddenCols.includes('debtToCollect') && <td className="p-3 text-right font-black border-b border-r border-slate-100 text-[14px] text-orange-600 bg-orange-50/30 tabular-nums">{formatCurrency(row.debtToCollect)}</td>}
                                    {!hiddenCols.includes('totalExpense') && <td className="p-3 text-right font-bold border-b border-r border-slate-100 text-[14px] text-red-600 bg-red-50/30 tabular-nums">{formatCurrency(row.totalExpense)}</td>}
                                    {!hiddenCols.includes('totalPhaseReceived') && <td className="p-3 text-right font-bold border-b border-r border-slate-100 text-[14px] text-emerald-700 bg-emerald-50/30 tabular-nums">{formatCurrency(row.totalPhaseReceived || 0)}</td>}
                                    {!hiddenCols.includes('totalReceivedAmount') && <td className="p-3 text-right font-bold border-b border-r border-slate-100 text-[14px] text-teal-700 bg-teal-50/30 tabular-nums">{formatCurrency(row.totalReceivedAmount)}</td>}
                                    {!hiddenCols.includes('profit') && <td className="p-3 text-right font-bold border-b border-r border-slate-100 text-[14px] text-indigo-700 bg-indigo-50/30 tabular-nums">{formatCurrency(row.profit)}</td>}
                                    {!hiddenCols.includes('totalActualIncome') && <td className="p-3 text-right font-bold border-b border-r-2 border-slate-200 text-[14px] text-green-600 bg-green-50/30 tabular-nums">{formatCurrency(row.totalActualIncome)}</td>}
                                    {!hiddenCols.includes('phases') && allPhases.map(phase => {
                                        const pTotal = row.phases[phase]?.total || 0;
                                        const pPaid = row.phases[phase]?.paid || 0;
                                        const pActual = row.phases[phase]?.actual_received || 0;
                                        const pExpected = row.phases[phase]?.expected_amount || 0;
                                        const isFullyPaid = pTotal > 0 && pPaid === pTotal;
                                        const displayAmount = pActual;
                                        return (
                                            <td key={phase} className="p-2 border-b border-r border-slate-100 text-right">
                                                {pTotal > 0 ? (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => handleTogglePhasePaid(row.project, phase, isFullyPaid)}
                                                            className={`w-5 h-5 min-w-[20px] rounded-md flex items-center justify-center transition-all duration-300 ease-spring ${isFullyPaid ? 'bg-green-600 text-white shadow-[0_0_10px_rgba(22,163,74,0.4)] scale-110' : 'bg-slate-200 text-transparent hover:bg-slate-300 shadow-inner'}`}
                                                            title={isFullyPaid ? 'Đã thu - Nhấn để hủy' : 'Chưa thu - Nhấn để xác nhận thu'}
                                                        >
                                                            <Check size={14} strokeWidth={4} />
                                                        </button>
                                                        <span className={`font-bold text-[13px] tabular-nums transition-colors duration-300 ${isFullyPaid ? 'text-green-700' : 'text-slate-600'}`}>
                                                            {formatCurrency(displayAmount)}
                                                        </span>
                                                    </div>
                                                ) : '-'}
                                            </td>
                                        );
                                    })}
                                    {!hiddenCols.includes('advanceValue') && <td className="p-3 text-right border-b border-l-2 border-slate-200 border-r border-slate-200 font-bold text-amber-700 bg-amber-50/30 text-[14px] tabular-nums">{formatCurrency(row.advanceValue || 0)}</td>}
                                    {!hiddenCols.includes('recoveredAdvance') && <td 
                                        className="p-3 text-right border-b border-r border-slate-200 bg-cyan-50/50 transition-colors hover:bg-cyan-100 cursor-pointer font-bold text-cyan-700 text-[14px] tabular-nums"
                                        onClick={() => {
                                            if (handleSaveRecoveredAdvance) {
                                                handleOpenPrompt(row.project, row.recoveredAdvance, 'RECOVERED_ADVANCE', 'Giá trị thu hồi tạm ứng');
                                            }
                                        }}
                                        title="Nhấn để nhập"
                                    >
                                        {row.recoveredAdvance > 0 ? formatCurrency(row.recoveredAdvance) : <span className="text-cyan-300 text-[11px] font-normal italic">Nhập số...</span>}
                                    </td>}
                                    {!hiddenCols.includes('utilityValue') && <td 
                                        className="p-3 text-right border-b border-r border-slate-200 bg-violet-50/50 transition-colors hover:bg-violet-100 cursor-pointer font-bold text-violet-700 text-[14px] tabular-nums"
                                        onClick={() => {
                                            if (handleSaveUtilityValue) {
                                                handleOpenPrompt(row.project, row.utilityValue, 'UTILITY_VALUE', 'Giá trị tiện ích');
                                            }
                                        }}
                                        title="Nhấn để nhập"
                                    >
                                        {row.utilityValue > 0 ? formatCurrency(row.utilityValue) : <span className="text-violet-300 text-[11px] font-normal italic">Nhập số...</span>}
                                    </td>}
                                    {!hiddenCols.includes('remainingCost') && <td 
                                        className="p-3 text-right border-b border-slate-200 bg-pink-50/50 transition-colors hover:bg-pink-100 cursor-pointer font-bold text-pink-700 text-[14px] tabular-nums"
                                        onClick={() => {
                                            if (handleSaveRemainingCost) {
                                                handleOpenPrompt(row.project, row.remainingCost, 'REMAINING_COST', 'Chi phí còn lại (dự trù)');
                                            }
                                        }}
                                        title="Nhấn để nhập"
                                    >
                                        {row.remainingCost > 0 ? formatCurrency(row.remainingCost) : <span className="text-pink-300 text-[11px] font-normal italic">Nhập số...</span>}
                                    </td>}
                                </tr>
                            ))}
                            <tr className="bg-slate-200 font-bold">
                                <td className="p-3 sticky left-0 bg-slate-200 z-10">TỔNG CỘNG</td>
                                {!hiddenCols.includes('contractValueAfterTax') && <td className="p-3 text-right tabular-nums">{formatCurrency(computedTotals.contractValueAfterTax)}</td>}
                                {!hiddenCols.includes('debtToCollect') && <td className="p-3 text-right text-orange-600 tabular-nums">{formatCurrency(computedTotals.debtToCollect)}</td>}
                                {!hiddenCols.includes('totalExpense') && <td className="p-3 text-right text-red-700 tabular-nums">{formatCurrency(computedTotals.totalExpense)}</td>}
                                {!hiddenCols.includes('totalPhaseReceived') && <td className="p-3 text-right text-emerald-800 tabular-nums">{formatCurrency(computedTotals.totalPhaseReceived || 0)}</td>}
                                {!hiddenCols.includes('totalReceivedAmount') && <td className="p-3 text-right text-teal-800 tabular-nums">{formatCurrency(computedTotals.totalReceivedAmount)}</td>}
                                {!hiddenCols.includes('profit') && <td className="p-3 text-right text-indigo-800 tabular-nums">{formatCurrency(computedTotals.profit)}</td>}
                                {!hiddenCols.includes('totalActualIncome') && <td className="p-3 text-right text-green-700 tabular-nums">{formatCurrency(computedTotals.totalActualIncome)}</td>}
                                {!hiddenCols.includes('phases') && allPhases.map(phase => (
                                    <td key={phase} className="p-2 text-right border-r border-slate-300">-</td>
                                ))}
                                {!hiddenCols.includes('advanceValue') && <td className="p-3 text-right text-amber-800 bg-slate-300 border-l-2 border-slate-400 border-r border-slate-400 tabular-nums">{formatCurrency(computedTotals.advanceValue || 0)}</td>}
                                {!hiddenCols.includes('recoveredAdvance') && <td className="p-3 text-right text-cyan-800 bg-slate-300 border-r border-slate-400 tabular-nums">{formatCurrency(computedTotals.recoveredAdvance || 0)}</td>}
                                {!hiddenCols.includes('utilityValue') && <td className="p-3 text-right text-violet-800 bg-slate-300 border-r border-slate-400 tabular-nums">{formatCurrency(computedTotals.utilityValue || 0)}</td>}
                                {!hiddenCols.includes('remainingCost') && <td className="p-3 text-right text-pink-800 bg-slate-300 border-slate-400 tabular-nums">
                                    {formatCurrency(computedTotals.remainingCost || 0)}
                                </td>}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Custom Prompt Modal */}
            {promptModal.isOpen && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={handleClosePrompt}></div>
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200">
                        <div className="bg-slate-50 border-b border-slate-200 px-5 py-4">
                            <h3 className="font-bold text-slate-800 text-lg">{promptModal.title || 'Nhập số tiền'}</h3>
                            <p className="text-slate-500 text-sm mt-1">Công trình: <span className="font-bold text-blue-600">{promptModal.project}</span></p>
                        </div>
                        <div className="p-5">
                            <input 
                                type="text"
                                autoFocus
                                value={promptModal.value}
                                onChange={(e) => setPromptModal({ ...promptModal, value: e.target.value })}
                                onKeyDown={(e) => {
                                    if(e.key === 'Enter') handleSubmitPrompt();
                                    if(e.key === 'Escape') handleClosePrompt();
                                }}
                                placeholder="Ví dụ: 10,000,000"
                                className="w-full text-center text-xl font-bold p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-pink-500 focus:ring-4 focus:ring-pink-500/20 text-pink-700 transition-all placeholder:text-slate-300 placeholder:font-normal"
                            />
                        </div>
                        <div className="flex gap-2 p-4 bg-slate-50 border-t border-slate-100">
                            <button onClick={handleClosePrompt} className="flex-1 py-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition shadow-sm">Hủy</button>
                            <button onClick={handleSubmitPrompt} className="flex-1 py-2.5 bg-pink-600 rounded-xl font-bold text-white hover:bg-pink-700 transition shadow-lg shadow-pink-600/30">Lưu lại</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
