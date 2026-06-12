import React, { useMemo, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { FileText, Save, Search, Filter, Upload, Eye, Download, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import ConfirmModal from './ConfirmModal';

export default function CustomerDebts({ incomes, projects, showToast, refreshData }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [projectFilter, setProjectFilter] = useState('');
    const [monthFilter, setMonthFilter] = useState('');
    const [uploadingId, setUploadingId] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, debt: null });

    const projectColors = useMemo(() => {
        const colors = [
            'bg-blue-50 text-blue-700 border-blue-200',
            'bg-emerald-50 text-emerald-700 border-emerald-200',
            'bg-amber-50 text-amber-700 border-amber-200',
            'bg-purple-50 text-purple-700 border-purple-200',
            'bg-rose-50 text-rose-700 border-rose-200',
            'bg-cyan-50 text-cyan-700 border-cyan-200',
            'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
            'bg-orange-50 text-orange-700 border-orange-200',
            'bg-teal-50 text-teal-700 border-teal-200',
            'bg-indigo-50 text-indigo-700 border-indigo-200'
        ];
        const map = {};
        if (projects) {
            projects.forEach((p, idx) => {
                map[p.name] = colors[idx % colors.length];
            });
        }
        return map;
    }, [projects]);

    const debtData = useMemo(() => {
        if (!incomes) return [];
        const grouped = {};
        
        incomes.forEach(inc => {
            const key = `${inc.project_name}_${inc.phase}`;
            if (!grouped[key]) {
                grouped[key] = {
                    id: key,
                    first_income_id: inc.id,
                    project_name: inc.project_name,
                    phase: inc.phase,
                    amount: 0,
                    vatAmount: 0,
                    invoiceAmount: 0,
                    receivedAmount: 0,
                    invoiceNo: '',
                    voucherNo: '',
                    invoiceDate: '',
                    invoicePdf: null,
                    noteRaw: inc.note
                };
            }
            
            grouped[key].amount += (inc.amount || 0);
            grouped[key].vatAmount += (inc.vat_amount || 0);
            grouped[key].invoiceAmount += (inc.post_tax_amount || 0);
            
            let actual = 0;
            if (inc.note) {
                try {
                    const parsed = JSON.parse(inc.note);
                    if (parsed && typeof parsed === 'object') {
                        const act = parseFloat(parsed.actual_received_amount) || 0;
                        const ded = parseFloat(parsed.deduction_amount) || 0;
                        actual = act + ded;
                        if (parsed.invoice_no && !grouped[key].invoiceNo.includes(parsed.invoice_no)) {
                            grouped[key].invoiceNo += (grouped[key].invoiceNo ? ', ' : '') + parsed.invoice_no;
                        }
                        if (parsed.voucher_no && !grouped[key].voucherNo.includes(parsed.voucher_no)) {
                            grouped[key].voucherNo += (grouped[key].voucherNo ? ', ' : '') + parsed.voucher_no;
                        }
                        
                        let invDate = parsed.invoice_date || '';
                        if (!invDate && inc.date && (inc.post_tax_amount > 0 || inc.amount > 0)) {
                            invDate = inc.date;
                        }
                        
                        if (invDate && !grouped[key].invoiceDate.includes(invDate)) {
                            grouped[key].invoiceDate += (grouped[key].invoiceDate ? ', ' : '') + invDate;
                        }
                        
                        if (parsed.invoice_pdf && !grouped[key].invoicePdf) {
                            grouped[key].invoicePdf = parsed.invoice_pdf;
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
        return debtData.filter(d => {
            const matchProject = projectFilter === '' || d.project_name === projectFilter;
            const matchSearch = d.project_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
             d.phase.toLowerCase().includes(searchTerm.toLowerCase()) ||
             d.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
             d.voucherNo.toLowerCase().includes(searchTerm.toLowerCase());
            
            let matchMonth = true;
            if (monthFilter) {
                matchMonth = d.invoiceDate && d.invoiceDate.includes(monthFilter);
            }
            
            return matchProject && matchSearch && matchMonth;
        });
    }, [debtData, searchTerm, projectFilter, monthFilter]);

    const totalRemaining = filteredDebtData.reduce((sum, d) => sum + d.remainingAmount, 0);

    const handleUpload = async (e, debt) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploadingId(debt.id);
        try {
            const fileExt = file.name.split('.').pop();
            const originalName = file.name.substring(0, file.name.lastIndexOf('.')) || 'invoice';
            const sanitizedName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
            const sanitizedProject = debt.project_name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
            
            const fileName = `${Date.now()}_${sanitizedName}.${fileExt}`;
            const filePath = `${sanitizedProject}/${fileName}`;

            // Upload the file directly to Supabase Storage client-side
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('invoices')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) {
                throw new Error(
                    uploadError.message === 'Bucket not found' 
                    ? 'Không tìm thấy bucket "invoices". Hãy tạo bucket tên "invoices" ở chế độ Public trong Supabase Console -> Storage.'
                    : uploadError.message
                );
            }

            // Retrieve the public URL
            const { data: { publicUrl } } = supabase.storage
                .from('invoices')
                .getPublicUrl(filePath);
            
            let parsedNote = {};
            if (debt.noteRaw) {
                try {
                    parsedNote = JSON.parse(debt.noteRaw);
                } catch(e){}
            }
            parsedNote.invoice_pdf = publicUrl;
            
            const { error } = await supabase.from('incomes')
                .update({ note: JSON.stringify(parsedNote) })
                .eq('id', debt.first_income_id);
            
            if (error) throw error;
            
            if (showToast) {
                showToast('Tải lên PDF thành công!', 'success');
            }
            if (refreshData) refreshData();
        } catch (err) {
            console.error('Lỗi khi tải lên file:', err);
            if (showToast) {
                showToast(err.message || 'Lỗi khi tải lên file!', 'error');
            }
        } finally {
            setUploadingId(null);
        }
    };

    const handleDeletePdf = async (debt) => {
        try {
            let parsedNote = {};
            if (debt.noteRaw) {
                try {
                    parsedNote = JSON.parse(debt.noteRaw);
                } catch(e){}
            }
            
            const fileUrl = parsedNote.invoice_pdf;
            if (fileUrl && fileUrl.includes('/public/invoices/')) {
                const parts = fileUrl.split('/public/invoices/');
                if (parts.length > 1) {
                    const filePath = decodeURIComponent(parts[1]);
                    const { error: storageError } = await supabase.storage.from('invoices').remove([filePath]);
                    if (storageError) console.warn('Lỗi khi xóa file khỏi Storage:', storageError);
                }
            }

            delete parsedNote.invoice_pdf;
            
            const { error } = await supabase.from('incomes')
                .update({ note: JSON.stringify(parsedNote) })
                .eq('id', debt.first_income_id);
            
            if (error) throw error;
            
            if (showToast) {
                showToast('Xóa file PDF thành công!', 'success');
            }
            if (refreshData) refreshData();
        } catch (err) {
            console.error(err);
            if (showToast) {
                showToast('Lỗi khi xóa file PDF!', 'error');
            }
        }
    };

    return (
        <div className="w-full animate-in fade-in duration-500">
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
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-center gap-3">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Tìm kiếm & Lọc</p>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                                type="text" 
                                placeholder="Lọc theo đợt, số hóa đơn..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition"
                            />
                        </div>
                        <div className="relative flex-1">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <select
                                value={projectFilter}
                                onChange={(e) => setProjectFilter(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition appearance-none"
                            >
                                <option value="">Tất cả công trình</option>
                                {projects?.map(p => (
                                    <option key={p.id} value={p.name}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="relative w-full sm:w-48">
                            <input
                                type="month"
                                value={monthFilter}
                                onChange={(e) => setMonthFilter(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition"
                                title="Lọc theo tháng hóa đơn"
                            />
                        </div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Tổng Công Nợ {searchTerm || projectFilter ? '(Đã lọc)' : 'Khách Hàng'}</p>
                        <p className="text-2xl font-black text-red-600">{formatCurrency(totalRemaining)}</p>
                    </div>
                </div>
            </div>

            {/* Bảng Dữ Liệu */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden print:shadow-none print:border-none">
                <div className="overflow-x-auto print:overflow-visible">
                    <table id="customer-debts-table" className="w-full text-left border-collapse min-w-[1000px] print:min-w-0 print:text-[12px]">
                        <thead>
                            <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                <th className="py-3.5 px-4 font-bold text-left">Công Trình</th>
                                <th className="py-3.5 px-3 font-bold text-center">Giai Đoạn / Đợt Thu</th>
                                <th className="py-3.5 px-3 font-bold text-left">Số Hóa Đơn</th>
                                <th className="py-3.5 px-3 font-bold text-left">Ngày Hóa Đơn</th>
                                <th className="py-3.5 px-3 font-bold text-left">Số Chứng Từ</th>
                                <th className="py-3.5 px-3 font-bold text-right">Trước Thuế</th>
                                <th className="py-3.5 px-3 font-bold text-right">Thuế VAT</th>
                                <th className="py-3.5 px-3 font-bold text-right">Sau Thuế</th>
                                <th className="py-3.5 px-3 font-bold text-right">Giá Trị HSTT</th>
                                <th className="py-3.5 px-3 font-bold text-right text-red-600">Công Nợ</th>
                                <th className="py-3.5 px-4 font-bold text-center">PDF</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredDebtData.length === 0 ? (
                                <tr>
                                    <td colSpan="11" className="p-8 text-center text-slate-400 font-bold">Không có hóa đơn nào phù hợp với tìm kiếm.</td>
                                </tr>
                            ) : (
                                filteredDebtData.map(debt => (
                                    <tr key={debt.id} className="hover:bg-slate-50/50 transition duration-150 group">
                                        <td className="py-3.5 px-4 align-middle">
                                            <span className={`inline-block text-[11px] font-bold px-2 py-1 rounded-md border shadow-sm leading-tight break-words max-w-[160px] ${projectColors[debt.project_name] || 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                                                {debt.project_name}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-3 align-middle text-center">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200/60 whitespace-nowrap">
                                                {debt.phase}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-3 align-middle text-sm font-medium text-slate-600 tabular-nums">{debt.invoiceNo || '-'}</td>
                                        <td className="py-3.5 px-3 align-middle text-sm font-medium text-slate-600 tabular-nums">
                                            {debt.invoiceDate ? debt.invoiceDate.split(', ').map(d => {
                                                const parts = d.split('-');
                                                if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
                                                return d;
                                            }).join(', ') : '-'}
                                        </td>
                                        <td className="py-3.5 px-3 align-middle text-sm font-medium text-slate-600 tabular-nums">{debt.voucherNo || '-'}</td>
                                        <td className="py-3.5 px-3 align-middle text-right text-sm font-semibold text-slate-700 tabular-nums">{formatCurrency(debt.amount)}</td>
                                        <td className="py-3.5 px-3 align-middle text-right text-sm font-medium text-slate-500 tabular-nums">{formatCurrency(debt.vatAmount)}</td>
                                        <td className="py-3.5 px-3 align-middle text-right text-sm font-semibold text-blue-600 tabular-nums">{formatCurrency(debt.invoiceAmount)}</td>
                                        <td className="py-3.5 px-3 align-middle text-right text-sm font-semibold text-emerald-600 tabular-nums">{formatCurrency(debt.receivedAmount)}</td>
                                        <td className="py-3.5 px-3 align-middle text-right text-sm font-bold tabular-nums">
                                            {debt.remainingAmount <= 0 ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 tracking-wider">HT</span>
                                            ) : (
                                                <span className="text-red-600">{formatCurrency(debt.remainingAmount)}</span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4 align-middle text-center">
                                            {debt.invoicePdf ? (
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <a href={debt.invoicePdf} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-all duration-200 hover:scale-105 border border-blue-100 hover:border-blue-600" title="Xem PDF">
                                                        <Eye size={15} />
                                                    </a>
                                                    <a href={debt.invoicePdf} download className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg transition-all duration-200 hover:scale-105 border border-emerald-100 hover:border-emerald-600" title="Tải xuống">
                                                        <Download size={15} />
                                                    </a>
                                                    <button onClick={() => setConfirmDelete({ isOpen: true, debt })} className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition-all duration-200 hover:scale-105 border border-rose-100 hover:border-rose-600 cursor-pointer" title="Xóa PDF">
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center relative group/upload">
                                                    <input 
                                                        type="file" 
                                                        accept=".pdf"
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                        onChange={(e) => handleUpload(e, debt)}
                                                        disabled={uploadingId === debt.id}
                                                        title="Tải lên PDF"
                                                    />
                                                    <button className={`p-1.5 ${uploadingId === debt.id ? 'bg-slate-100 text-slate-400' : 'bg-slate-50 text-slate-600 border border-slate-200/60 group-hover/upload:bg-blue-600 group-hover/upload:text-white group-hover/upload:border-blue-600 group-hover/upload:scale-105'} rounded-lg transition-all duration-200`} title="Tải lên PDF">
                                                        <Upload size={15} className={uploadingId === debt.id ? 'animate-bounce' : ''} />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <ConfirmModal 
                isOpen={confirmDelete.isOpen}
                title="Xóa hóa đơn PDF"
                message="Bạn có chắc chắn muốn xóa file PDF hóa đơn này khỏi hệ thống không?"
                confirmText="Xóa tệp"
                type="danger"
                onConfirm={async () => {
                    const debt = confirmDelete.debt;
                    setConfirmDelete({ isOpen: false, debt: null });
                    if (debt) {
                        await handleDeletePdf(debt);
                    }
                }}
                onCancel={() => setConfirmDelete({ isOpen: false, debt: null })}
            />
        </div>
    );
}
