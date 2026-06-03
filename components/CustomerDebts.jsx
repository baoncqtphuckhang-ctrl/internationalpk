import React, { useMemo, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { FileText, Save, Search } from 'lucide-react';

export default function CustomerDebts({ incomes, projects }) {
    const [searchTerm, setSearchTerm] = useState('');

    const debtData = useMemo(() => {
        if (!incomes) return [];
        const grouped = {};
        
        incomes.forEach(inc => {
            const key = `${inc.project_name}_${inc.phase}`;
            if (!grouped[key]) {
                grouped[key] = {
                    id: key,
                    project_name: inc.project_name,
                    phase: inc.phase,
                    invoiceAmount: 0,
                    receivedAmount: 0,
                    invoiceNo: '',
                    voucherNo: ''
                };
            }
            
            grouped[key].invoiceAmount += (inc.post_tax_amount || 0);
            
            let actual = 0;
            if (inc.note) {
                try {
                    const parsed = JSON.parse(inc.note);
                    if (parsed && typeof parsed === 'object') {
                        if (parsed.actual_received_amount) {
                            actual = parseFloat(parsed.actual_received_amount) || 0;
                        }
                        if (parsed.invoice_no && !grouped[key].invoiceNo.includes(parsed.invoice_no)) {
                            grouped[key].invoiceNo += (grouped[key].invoiceNo ? ', ' : '') + parsed.invoice_no;
                        }
                        if (parsed.voucher_no && !grouped[key].voucherNo.includes(parsed.voucher_no)) {
                            grouped[key].voucherNo += (grouped[key].voucherNo ? ', ' : '') + parsed.voucher_no;
                        }
                    }
                } catch(e) {}
            }
            grouped[key].receivedAmount += actual;
        });
        
        return Object.values(grouped).map(g => ({
            ...g,
            remainingAmount: g.invoiceAmount - g.receivedAmount
        })).sort((a, b) => {
            if (a.project_name !== b.project_name) return a.project_name.localeCompare(b.project_name);
            const numA = parseInt(a.phase.match(/\d+/) || [0], 10);
            const numB = parseInt(b.phase.match(/\d+/) || [0], 10);
            return numA - numB;
        });
    }, [incomes]);

    const filteredDebtData = useMemo(() => {
        return debtData.filter(d => 
            d.project_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            d.phase.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.voucherNo.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [debtData, searchTerm]);

    const totalRemaining = filteredDebtData.reduce((sum, d) => sum + d.remainingAmount, 0);

    return (
        <div className="max-w-6xl mx-auto animate-in fade-in duration-500">
            <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FileText className="text-blue-600" /> Quản Lý Hóa Đơn
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Danh sách hóa đơn và tình trạng thu tiền theo từng đợt.</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                        onClick={() => {
                            const table = document.getElementById('customer-debts-table');
                            if (!table) return;
                            const html = table.outerHTML;
                            const blob = new Blob([`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"></head><body>${html}</body></html>`], { type: 'application/vnd.ms-excel;charset=utf-8' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'Cong_No_Khach_Hang.xls';
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
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-center">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Tìm kiếm</p>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Lọc theo tên công trình hoặc đợt..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition"
                        />
                    </div>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Tổng Công Nợ {searchTerm ? '(Đã lọc)' : 'Khách Hàng'}</p>
                        <p className="text-2xl font-black text-red-600">{formatCurrency(totalRemaining)}</p>
                    </div>
                </div>
            </div>

            {/* Bảng Dữ Liệu */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:shadow-none print:border-none">
                <div className="overflow-x-auto print:overflow-visible">
                    <table id="customer-debts-table" className="w-full text-left border-collapse min-w-[800px] print:min-w-0 print:text-[12px]">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                                <th className="p-4 font-black">Công Trình</th>
                                <th className="p-4 font-black text-center">Giai Đoạn / Đợt Thu</th>
                                <th className="p-4 font-black">Số Hóa Đơn</th>
                                <th className="p-4 font-black">Số Chứng Từ</th>
                                <th className="p-4 font-black text-right">Giá Trị Hóa Đơn</th>
                                <th className="p-4 font-black text-right">Đã Thực Thu</th>
                                <th className="p-4 font-black text-right text-red-600">Còn Lại (Công Nợ)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredDebtData.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="p-8 text-center text-slate-400 font-bold">Không có công nợ khách hàng nào cần thu phù hợp với tìm kiếm.</td>
                                </tr>
                            ) : (
                                filteredDebtData.map(debt => (
                                    <tr key={debt.id} className="hover:bg-slate-50/80 transition group">
                                        <td className="p-4 text-sm font-bold text-slate-700">{debt.project_name}</td>
                                        <td className="p-4 text-center">
                                            <span className="text-xs font-black px-2 py-1 rounded-md border bg-blue-50 text-blue-600 border-blue-100">
                                                {debt.phase}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm font-medium text-slate-600">{debt.invoiceNo || '-'}</td>
                                        <td className="p-4 text-sm font-medium text-slate-600">{debt.voucherNo || '-'}</td>
                                        <td className="p-4 text-right font-bold text-slate-800">{formatCurrency(debt.invoiceAmount)}</td>
                                        <td className="p-4 text-right font-bold text-emerald-600">{formatCurrency(debt.receivedAmount)}</td>
                                        <td className="p-4 text-right font-black text-red-600">{formatCurrency(debt.remainingAmount)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
