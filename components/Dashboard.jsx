'use client';

import React from 'react';
import { Copy, Download, Check } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function Dashboard({ 
    filteredDashboardData, 
    dashboardProjectFilter, 
    setDashboardProjectFilter, 
    allPhases,
    handleTogglePhasePaid,
    handleCopyTable,
    exportTableToExcel,
    totals
}) {
    return (
        <div className="animate-in fade-in duration-500 max-w-full mx-auto print:hidden">
            <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Bảng Tổng Hợp Thu - Chi</h2>
                    <p className="text-slate-500 text-sm mt-1">Tick chọn vào ô tương ứng ở Đợt thu để xác nhận đã nhận tiền.</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={() => handleCopyTable('dashboard-table')} className="flex-1 md:flex-none justify-center bg-slate-800 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-slate-700 flex items-center gap-2 shadow-lg transition">
                        <Copy size={16} /> Copy Bảng
                    </button>
                    <button onClick={() => exportTableToExcel('dashboard-table', 'TongHopThuChi')} className="flex-1 md:flex-none justify-center bg-green-600 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-green-700 flex items-center gap-2 shadow-lg transition">
                        <Download size={16} /> Xuất Excel
                    </button>
                </div>
            </header>

            <div className="md:hidden text-xs text-blue-600 mb-2 flex items-center gap-1 font-medium bg-blue-50 p-2 rounded-lg border border-blue-100">
                <span>👉</span> Vuốt ngang bảng để xem đầy đủ thông tin thu chi
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden w-full">
                <div className="overflow-x-auto custom-scrollbar w-full">
                    <table id="dashboard-table" className="w-full text-left text-[11px] md:text-sm border-collapse min-w-[1200px] md:min-w-[1500px]">
                        <thead>
                            <tr className="bg-slate-100 text-slate-700 uppercase tracking-wider">
                                <th className="p-3 border-b border-r border-slate-200 font-bold sticky left-0 bg-slate-100 z-20 min-w-[150px] align-top" rowSpan="2">
                                    Công trình
                                    <input 
                                        type="text" 
                                        value={dashboardProjectFilter} 
                                        onChange={(e) => setDashboardProjectFilter(e.target.value)}
                                        placeholder="Lọc..."
                                        className="block mt-1 w-full p-1 text-xs border rounded outline-none"
                                    />
                                </th>
                                <th className="p-3 border-b border-r border-slate-200 font-bold text-right align-top" rowSpan="2">Giá trị HĐ<br />(Trước thuế)</th>
                                <th className="p-3 border-b border-r border-slate-200 font-black text-right text-orange-600 bg-orange-50/50 align-top" rowSpan="2">Công Nợ<br />Cần Thu</th>
                                <th className="p-3 border-b border-r border-slate-200 font-bold text-right text-red-600 bg-red-50/50 align-top" rowSpan="2">Tổng Chi Phí</th>
                                <th className="p-3 border-b border-r-2 border-slate-300 font-bold text-right text-green-600 bg-green-50/50 align-top" rowSpan="2">Tổng Thu TT</th>
                                <th className="p-3 border-b border-r-2 border-slate-300 font-bold text-right text-indigo-700 bg-indigo-50/50 align-top" rowSpan="2">Lợi nhuận</th>
                                {allPhases.length > 0 && <th className="p-2 border-b border-slate-200 font-bold text-center bg-yellow-50 text-yellow-800" colSpan={allPhases.length}>CHI TIẾT THU CÁC ĐỢT</th>}
                            </tr>
                            {allPhases.length > 0 && (
                                <tr className="bg-yellow-50/30 text-slate-600">
                                    {allPhases.map(phase => (<th key={phase} className="p-2 border-b border-r border-slate-200 text-center font-bold text-xs">{phase}</th>))}
                                </tr>
                            )}
                        </thead>
                        <tbody>
                            {filteredDashboardData.map((row, idx) => (
                                <tr key={row.project} className={`hover:bg-slate-100 transition ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                                    <td className="p-3 font-bold text-slate-800 border-b border-r border-slate-100 sticky left-0 bg-inherit z-10">{row.project}</td>
                                    <td className="p-3 text-right font-medium border-b border-r border-slate-100 text-[13px]">{formatCurrency(row.contractValueAfterTax)}</td>
                                    <td className="p-3 text-right font-black border-b border-r border-slate-100 text-[14px] text-orange-600 bg-orange-50/30">{formatCurrency(row.debtToCollect)}</td>
                                    <td className="p-3 text-right font-bold border-b border-r border-slate-100 text-[14px] text-red-600 bg-red-50/30">{formatCurrency(row.totalExpense)}</td>
                                    <td className="p-3 text-right font-bold border-b border-r-2 border-slate-200 text-[14px] text-green-600 bg-green-50/30">{formatCurrency(row.totalActualIncome)}</td>
                                    <td className="p-3 text-right font-bold border-b border-r-2 border-slate-200 text-[14px] text-indigo-700 bg-indigo-50/30">{formatCurrency(row.profit)}</td>
                                    {allPhases.map(phase => {
                                        const pTotal = row.phases[phase]?.total || 0;
                                        const pPaid = row.phases[phase]?.paid || 0;
                                        const isFullyPaid = pTotal > 0 && pPaid === pTotal;
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
                                                        <span className={`font-bold text-[13px] transition-colors duration-300 ${isFullyPaid ? 'text-green-700' : 'text-slate-600'}`}>
                                                            {formatCurrency(pTotal)}
                                                        </span>
                                                    </div>
                                                ) : '-'}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                            <tr className="bg-slate-200 font-bold">
                                <td className="p-3 sticky left-0 bg-slate-200 z-10">TỔNG CỘNG</td>
                                <td className="p-3 text-right">{formatCurrency(totals.contractValueAfterTax)}</td>
                                <td className="p-3 text-right text-orange-600">{formatCurrency(totals.debtToCollect)}</td>
                                <td className="p-3 text-right text-red-700">{formatCurrency(totals.totalExpense)}</td>
                                <td className="p-3 text-right text-green-700">{formatCurrency(totals.totalActualIncome)}</td>
                                <td className="p-3 text-right text-indigo-800">{formatCurrency(totals.profit)}</td>
                                {allPhases.map(phase => (
                                    <td key={phase} className="p-2 text-right border-r border-slate-300">-</td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
