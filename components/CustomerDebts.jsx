import React, { useEffect, useMemo, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { FileText, Save, Search, Filter, Upload, Eye, EyeOff, Download, Trash2, Edit3, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import ConfirmModal from './ConfirmModal';
import CurrencyInput from './CurrencyInput';

const CUSTOMER_INVOICE_COLUMN_STORAGE_KEY = 'cbpro_customer_invoice_visible_columns_v1';
const DEFAULT_CUSTOMER_INVOICE_VISIBLE_COLUMNS = {
    project: true,
    phase: true,
    invoiceNo: true,
    invoiceDate: true,
    voucherNo: true,
    amount: true,
    vatAmount: true,
    invoiceAmount: true,
    hsttAmount: true,
    receivedAmount: true,
    remainingAmount: true,
    invoicePdf: true,
    hsttPdf: true,
    actions: true
};

export default function CustomerDebts({ incomes, projects, showToast, refreshData }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [projectFilter, setProjectFilter] = useState('');
    const [monthFilter, setMonthFilter] = useState('');
    const [unissuedOnlyFilter, setUnissuedOnlyFilter] = useState(false);
    const [uploadingId, setUploadingId] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, debt: null });
    const [visibleColumns, setVisibleColumns] = useState(() => {
        if (typeof window === 'undefined') return DEFAULT_CUSTOMER_INVOICE_VISIBLE_COLUMNS;
        try {
            const saved = localStorage.getItem(CUSTOMER_INVOICE_COLUMN_STORAGE_KEY);
            return saved ? { ...DEFAULT_CUSTOMER_INVOICE_VISIBLE_COLUMNS, ...JSON.parse(saved) } : DEFAULT_CUSTOMER_INVOICE_VISIBLE_COLUMNS;
        } catch(e) {
            return DEFAULT_CUSTOMER_INVOICE_VISIBLE_COLUMNS;
        }
    });
    const [editModal, setEditModal] = useState({
        isOpen: false,
        debt: null,
        invoiceNo: '',
        invoiceDate: '',
        voucherNo: '',
        amount: 0,
        vatAmount: 0,
        postTaxAmount: 0
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        try {
            localStorage.setItem(CUSTOMER_INVOICE_COLUMN_STORAGE_KEY, JSON.stringify(visibleColumns));
        } catch(e) {}
    }, [visibleColumns]);

    const customerInvoiceColumns = [
        { key: 'project', label: 'Công trình', align: 'center', totalLabel: true },
        { key: 'phase', label: 'Giai đoạn / Đợt thu', align: 'center' },
        { key: 'invoiceNo', label: 'Số hóa đơn', align: 'center' },
        { key: 'invoiceDate', label: 'Ngày hóa đơn', align: 'center' },
        { key: 'voucherNo', label: 'Số chứng từ', align: 'center' },
        { key: 'amount', label: 'Trước thuế', align: 'center', total: d => d.amount || 0 },
        { key: 'vatAmount', label: 'Thuế VAT', align: 'center', total: d => d.vatAmount || 0 },
        { key: 'invoiceAmount', label: 'Sau thuế', align: 'center', total: d => d.invoiceAmount || 0 },
        { key: 'hsttAmount', label: 'Giá trị HSTT', align: 'center', total: d => d.hsttAmount || 0 },
        { key: 'receivedAmount', label: 'Thực nhận', align: 'center', total: d => d.receivedAmount || 0 },
        { key: 'remainingAmount', label: 'Công nợ', align: 'center', total: d => d.remainingAmount || 0 },
        { key: 'invoicePdf', label: 'HĐ PDF', align: 'center' },
        { key: 'hsttPdf', label: 'HSTT PDF', align: 'center' },
        { key: 'actions', label: 'Thao tác', align: 'center' }
    ];

    const visibleInvoiceColumns = customerInvoiceColumns.filter(col => visibleColumns[col.key] !== false);

    const invoiceTableLayout = useMemo(() => {
        const count = visibleInvoiceColumns.length || 1;
        if (count <= 8) return { minWidth: 980, fontSize: '13px', headerFontSize: '11px', cellPaddingX: '14px' };
        if (count <= 11) return { minWidth: 1180, fontSize: '12px', headerFontSize: '10.5px', cellPaddingX: '12px' };
        return { minWidth: 1380, fontSize: '12px', headerFontSize: '10px', cellPaddingX: '10px' };
    }, [visibleInvoiceColumns.length]);

    const toggleColumn = (key) => {
        setVisibleColumns(prev => ({ ...prev, [key]: prev[key] === false }));
    };

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
            const isInvoice = (inc.amount || 0) > 0 || (inc.post_tax_amount || 0) > 0;
            if (!grouped[key]) {
                grouped[key] = {
                    id: key,
                    first_income_id: inc.id,
                    project_name: inc.project_name,
                    phase: inc.phase,
                    beforeTaxAmount: 0,
                    vatAmount: 0,
                    invoiceAmount: 0,
                    hsttAmount: 0,
                    receivedAmount: 0,
                    invoiceNo: '',
                    voucherNo: '',
                    invoiceDate: '',
                    invoicePdf: null,
                    hsttPdf: null,
                    noteRaw: inc.note,
                    invoice_id: isInvoice ? inc.id : null,
                    invoice_noteRaw: isInvoice ? inc.note : null,
                    invoice_date_col: isInvoice ? inc.date : null
                };
            } else {
                if (isInvoice && !grouped[key].invoice_id) {
                    grouped[key].invoice_id = inc.id;
                    grouped[key].invoice_noteRaw = inc.note;
                    grouped[key].invoice_date_col = inc.date;
                }
            }
            
            if (isInvoice) {
                grouped[key].beforeTaxAmount += (inc.amount || 0);
                grouped[key].vatAmount += (inc.vat_amount || 0);
                grouped[key].invoiceAmount += (inc.post_tax_amount || 0);
                
                if (inc.note) {
                    try {
                        const parsed = JSON.parse(inc.note);
                        if (parsed && typeof parsed === 'object') {
                            grouped[key].hsttAmount += parseFloat(parsed.actual_received_amount) || inc.post_tax_amount || 0;
                            if (parsed.invoice_no && !grouped[key].invoiceNo.split(', ').includes(parsed.invoice_no)) {
                                grouped[key].invoiceNo += (grouped[key].invoiceNo ? ', ' : '') + parsed.invoice_no;
                            }
                            if (parsed.voucher_no && !grouped[key].voucherNo.split(', ').includes(parsed.voucher_no)) {
                                grouped[key].voucherNo += (grouped[key].voucherNo ? ', ' : '') + parsed.voucher_no;
                            }
                            
                            let invDate = parsed.invoice_date || '';
                            if (!invDate && inc.date) {
                                invDate = inc.date;
                            }
                            
                            if (invDate && !grouped[key].invoiceDate.split(', ').includes(invDate)) {
                                grouped[key].invoiceDate += (grouped[key].invoiceDate ? ', ' : '') + invDate;
                            }
                            
                            if (parsed.invoice_pdf) grouped[key].invoicePdf = parsed.invoice_pdf;
                            if (parsed.hstt_pdf) grouped[key].hsttPdf = parsed.hstt_pdf;
                        }
                    } catch(e) {}
                } else {
                    grouped[key].hsttAmount += inc.post_tax_amount || 0;
                }
            } else {
                // Real receipt (type INCOME_REAL)
                if (inc.note) {
                    try {
                        const parsed = JSON.parse(inc.note);
                        if (parsed && typeof parsed === 'object') {
                            const act = parseFloat(parsed.actual_received_amount) || 0;
                            const ded = parseFloat(parsed.deduction_amount) || 0;
                            grouped[key].receivedAmount += (act + ded);
                            
                            if (parsed.invoice_no && !grouped[key].invoiceNo.split(', ').includes(parsed.invoice_no)) {
                                grouped[key].invoiceNo += (grouped[key].invoiceNo ? ', ' : '') + parsed.invoice_no;
                            }
                            if (parsed.voucher_no && !grouped[key].voucherNo.split(', ').includes(parsed.voucher_no)) {
                                grouped[key].voucherNo += (grouped[key].voucherNo ? ', ' : '') + parsed.voucher_no;
                            }
                            
                            let invDate = parsed.invoice_date || '';
                            if (invDate && !grouped[key].invoiceDate.split(', ').includes(invDate)) {
                                grouped[key].invoiceDate += (grouped[key].invoiceDate ? ', ' : '') + invDate;
                            }
                            
                            if (parsed.invoice_pdf) grouped[key].invoicePdf = parsed.invoice_pdf;
                            if (parsed.hstt_pdf) grouped[key].hsttPdf = parsed.hstt_pdf;
                        }
                    } catch(e) {}
                }
            }
        });
        
        return Object.values(grouped).map(g => ({
            ...g,
            amount: g.beforeTaxAmount, // For compatibility
            remainingAmount: g.hsttAmount - g.receivedAmount
        })).sort((a, b) => {
            if (a.project_name !== b.project_name) return a.project_name.localeCompare(b.project_name);
            
            const numA = parseInt((a.phase || '').match(/\d+/) || [0], 10);
            const numB = parseInt((b.phase || '').match(/\d+/) || [0], 10);
            return numA - numB;
        });
    }, [incomes]);


    const filteredDebtData = useMemo(() => {
        const filtered = debtData.filter(d => {
            const matchProject = projectFilter === '' || d.project_name === projectFilter;
            const matchSearch = d.project_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
             d.phase.toLowerCase().includes(searchTerm.toLowerCase()) ||
             d.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
             d.voucherNo.toLowerCase().includes(searchTerm.toLowerCase());
            
            let matchMonth = true;
            if (monthFilter) {
                matchMonth = d.invoiceDate && d.invoiceDate.includes(monthFilter);
            }
            
            let matchUnissued = true;
            if (unissuedOnlyFilter) {
                const hasInvoice = d.invoiceNo && d.invoiceNo.trim() !== '' && d.invoiceNo !== '-';
                const isAdvance = d.phase.toLowerCase().includes('tạm ứng') || d.phase.toLowerCase().includes('tam ung');
                matchUnissued = !hasInvoice && !isAdvance;
            }
            
            return matchProject && matchSearch && matchMonth && matchUnissued;
        });

        if (monthFilter) {
            return [...filtered].sort((a, b) => {
                const hasInvoiceA = a.invoiceNo && a.invoiceNo !== '-' ? 1 : 0;
                const hasInvoiceB = b.invoiceNo && b.invoiceNo !== '-' ? 1 : 0;
                
                if (hasInvoiceA !== hasInvoiceB) {
                    return hasInvoiceB - hasInvoiceA; // 1 (has invoice) comes first, 0 (no invoice) goes to bottom
                }
                
                if (a.project_name !== b.project_name) return a.project_name.localeCompare(b.project_name);
                
                const numA = parseInt((a.phase || '').match(/\d+/) || [0], 10);
                const numB = parseInt((b.phase || '').match(/\d+/) || [0], 10);
                return numA - numB;
            });
        }
        return filtered;
    }, [debtData, searchTerm, projectFilter, monthFilter, unissuedOnlyFilter]);

    const totalRemaining = filteredDebtData.reduce((sum, d) => sum + d.remainingAmount, 0);

    const handleUpload = async (e, debt, type = 'invoice') => {
        const file = e.target.files[0];
        if (!file) return;

        setUploadingId(`${debt.id}_${type}`);
        try {
            const fileExt = file.name.split('.').pop();
            const originalName = file.name.substring(0, file.name.lastIndexOf('.')) || type;
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
            if (type === 'invoice') {
                parsedNote.invoice_pdf = publicUrl;
            } else {
                parsedNote.hstt_pdf = publicUrl;
            }
            
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

    const handleDeletePdf = async (debt, type = 'invoice') => {
        try {
            let parsedNote = {};
            if (debt.noteRaw) {
                try {
                    parsedNote = JSON.parse(debt.noteRaw);
                } catch(e){}
            }
            
            const fileUrl = type === 'invoice' ? parsedNote.invoice_pdf : parsedNote.hstt_pdf;
            if (fileUrl && fileUrl.includes('/public/invoices/')) {
                const parts = fileUrl.split('/public/invoices/');
                if (parts.length > 1) {
                    const filePath = decodeURIComponent(parts[1]);
                    const { error: storageError } = await supabase.storage.from('invoices').remove([filePath]);
                    if (storageError) console.warn('Lỗi khi xóa file khỏi Storage:', storageError);
                }
            }

            if (type === 'invoice') {
                delete parsedNote.invoice_pdf;
            } else {
                delete parsedNote.hstt_pdf;
            }
            
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

    const handleOpenEditModal = (debt) => {
        let parsedNote = {};
        const noteToParse = debt.invoice_noteRaw || debt.noteRaw;
        if (noteToParse) {
            try {
                parsedNote = JSON.parse(noteToParse);
            } catch(e){}
        }
        
        let defaultDate = parsedNote.invoice_date || '';
        if (!defaultDate && debt.invoice_date_col) {
            defaultDate = debt.invoice_date_col;
        }
        
        setEditModal({
            isOpen: true,
            debt,
            invoiceNo: parsedNote.invoice_no || '',
            invoiceDate: defaultDate,
            voucherNo: parsedNote.voucher_no || '',
            amount: debt.amount || 0,
            vatAmount: debt.vatAmount || 0,
            postTaxAmount: debt.invoiceAmount || 0
        });
    };

    const handleSaveEdit = async () => {
        if (!editModal.debt) return;
        setIsSaving(true);
        try {
            const targetId = editModal.debt.invoice_id || editModal.debt.first_income_id;
            
            let parsedNote = {};
            const noteToParse = editModal.debt.invoice_noteRaw || editModal.debt.noteRaw;
            if (noteToParse) {
                try {
                    parsedNote = JSON.parse(noteToParse);
                } catch(e){}
            }
            
            parsedNote.invoice_no = editModal.invoiceNo;
            parsedNote.invoice_date = editModal.invoiceDate;
            parsedNote.voucher_no = editModal.voucherNo;
            
            const { error } = await supabase.from('incomes')
                .update({
                    amount: editModal.amount,
                    vat_amount: editModal.vatAmount,
                    post_tax_amount: editModal.postTaxAmount,
                    date: editModal.invoiceDate || null,
                    note: JSON.stringify(parsedNote)
                })
                .eq('id', targetId);
                
            if (error) throw error;
            
            if (showToast) {
                showToast('Cập nhật thông tin hóa đơn thành công!', 'success');
            }
            setEditModal({
                isOpen: false,
                debt: null,
                invoiceNo: '',
                invoiceDate: '',
                voucherNo: '',
                amount: 0,
                vatAmount: 0,
                postTaxAmount: 0
            });
            if (refreshData) refreshData();
        } catch (err) {
            console.error('Lỗi khi cập nhật hóa đơn:', err);
            if (showToast) {
                showToast(err.message || 'Lỗi khi cập nhật hóa đơn!', 'error');
            }
        } finally {
            setIsSaving(false);
        }
    };

    const renderInvoiceDate = (value) => {
        if (!value) return '-';
        return value.split(', ').map(d => {
            const parts = d.split('-');
            if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
            return d;
        }).join(', ');
    };

    const renderDebtCell = (debt, key) => {
        switch (key) {
            case 'project':
                return (
                    <span className={`inline-block text-[11px] font-bold px-2 py-1 rounded-md border shadow-sm leading-tight break-words max-w-[180px] ${projectColors[debt.project_name] || 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                        {debt.project_name}
                    </span>
                );
            case 'phase':
                return (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200/60 whitespace-nowrap">
                        {debt.phase}
                    </span>
                );
            case 'invoiceNo':
                return debt.invoiceNo || '-';
            case 'invoiceDate':
                return renderInvoiceDate(debt.invoiceDate);
            case 'voucherNo':
                return debt.voucherNo || '-';
            case 'amount':
                return formatCurrency(debt.amount);
            case 'vatAmount':
                return formatCurrency(debt.vatAmount);
            case 'invoiceAmount':
                return <span className="text-blue-600">{formatCurrency(debt.invoiceAmount)}</span>;
            case 'hsttAmount':
                return formatCurrency(debt.hsttAmount);
            case 'receivedAmount':
                return <span className="text-emerald-600">{formatCurrency(debt.receivedAmount)}</span>;
            case 'remainingAmount':
                return debt.remainingAmount <= 0 ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 tracking-wider">HT</span>
                ) : (
                    <span className="text-red-600">{formatCurrency(debt.remainingAmount)}</span>
                );
            case 'invoicePdf':
                return debt.invoicePdf ? (
                    <div className="flex items-center justify-center gap-1.5">
                        <a href={debt.invoicePdf} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-all duration-200" title="Xem HĐ PDF">
                            <Eye size={15} />
                        </a>
                        <button onClick={() => setConfirmDelete({ isOpen: true, debt, type: 'invoice' })} className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition-all duration-200" title="Xóa HĐ PDF">
                            <Trash2 size={15} />
                        </button>
                    </div>
                ) : (
                    <div className="relative group/upload flex items-center justify-center">
                        <input
                            type="file"
                            accept=".pdf"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            onChange={(e) => handleUpload(e, debt, 'invoice')}
                            disabled={uploadingId === `${debt.id}_invoice`}
                            title="Tải lên HĐ PDF"
                        />
                        <button className={`p-1.5 ${uploadingId === `${debt.id}_invoice` ? 'bg-slate-100 text-slate-400' : 'bg-slate-50 text-slate-600 border border-slate-200/60 group-hover/upload:bg-blue-600 group-hover/upload:text-white group-hover/upload:border-blue-600 group-hover/upload:scale-105'} rounded-lg transition-all duration-200`} title="Tải lên HĐ PDF">
                            <Upload size={15} className={uploadingId === `${debt.id}_invoice` ? 'animate-bounce' : ''} />
                        </button>
                    </div>
                );
            case 'hsttPdf':
                return debt.hsttPdf ? (
                    <div className="flex items-center justify-center gap-1.5">
                        <a href={debt.hsttPdf} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-purple-50 text-purple-600 hover:bg-purple-600 hover:text-white rounded-lg transition-all duration-200" title="Xem HSTT PDF">
                            <Eye size={15} />
                        </a>
                        <button onClick={() => setConfirmDelete({ isOpen: true, debt, type: 'hstt' })} className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition-all duration-200" title="Xóa HSTT PDF">
                            <Trash2 size={15} />
                        </button>
                    </div>
                ) : (
                    <div className="relative group/upload flex items-center justify-center">
                        <input
                            type="file"
                            accept=".pdf"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            onChange={(e) => handleUpload(e, debt, 'hstt')}
                            disabled={uploadingId === `${debt.id}_hstt`}
                            title="Tải lên HSTT PDF"
                        />
                        <button className={`p-1.5 ${uploadingId === `${debt.id}_hstt` ? 'bg-slate-100 text-slate-400' : 'bg-slate-50 text-slate-600 border border-slate-200/60 group-hover/upload:bg-purple-600 group-hover/upload:text-white group-hover/upload:border-purple-600 group-hover/upload:scale-105'} rounded-lg transition-all duration-200`} title="Tải lên HSTT PDF">
                            <Upload size={15} className={uploadingId === `${debt.id}_hstt` ? 'animate-bounce' : ''} />
                        </button>
                    </div>
                );
            case 'actions':
                return (
                    <button
                        onClick={() => handleOpenEditModal(debt)}
                        className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-all duration-200 hover:scale-105 border border-blue-100 hover:border-blue-600 cursor-pointer"
                        title="Sửa thông tin hóa đơn"
                    >
                        <Edit3 size={15} />
                    </button>
                );
            default:
                return '-';
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
                    <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={unissuedOnlyFilter}
                                onChange={(e) => setUnissuedOnlyFilter(e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 transition duration-150 ease-in-out cursor-pointer"
                            />
                            <span className="text-xs font-bold text-slate-600">Chỉ hiện hóa đơn chưa xuất chính (trừ tạm ứng)</span>
                        </label>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Tổng Công Nợ {searchTerm || projectFilter ? '(Đã lọc)' : 'Khách Hàng'}</p>
                        <p className="text-2xl font-black text-red-600">{formatCurrency(totalRemaining)}</p>
                    </div>
                </div>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm print:hidden">
                <span className="mr-1 text-xs font-black uppercase tracking-wide text-slate-500">Ẩn/hiện cột:</span>
                {customerInvoiceColumns.map(col => {
                    const isVisible = visibleColumns[col.key] !== false;
                    return (
                        <button
                            key={col.key}
                            type="button"
                            onClick={() => toggleColumn(col.key)}
                            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-black transition ${isVisible ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                            title={`${isVisible ? 'Ẩn' : 'Hiện'} cột ${col.label}`}
                        >
                            {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                            {col.label}
                        </button>
                    );
                })}
            </div>

            {/* Bảng Dữ Liệu */}
            <div className="expected-print-report bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden print:rounded-none print:border-none print:shadow-none print:overflow-visible">
                <div className="expected-print-scroll overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)] print:overflow-visible print:max-h-none">
                    <div className="expected-print-title">
                        BẢNG QUẢN LÝ HÓA ĐƠN VÀ THU CÔNG NỢ
                    </div>
                    <table id="customer-debts-table" className="w-full text-left border-collapse print:w-full print:min-w-0" style={{ minWidth: `${invoiceTableLayout.minWidth}px` }}>
                        <thead>
                            <tr className="bg-slate-900 text-white border-b border-slate-200 sticky top-0 z-10 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                {visibleInvoiceColumns.map(col => (
                                    <th
                                        key={col.key}
                                        className={`py-3.5 font-bold ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.key === 'receivedAmount' ? 'text-emerald-300' : ''} ${col.key === 'remainingAmount' ? 'text-red-300' : ''}`}
                                        style={{ paddingLeft: invoiceTableLayout.cellPaddingX, paddingRight: invoiceTableLayout.cellPaddingX, fontSize: invoiceTableLayout.headerFontSize }}
                                    >
                                        <div className={`flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''}`}>
                                            <button
                                                type="button"
                                                onClick={() => toggleColumn(col.key)}
                                                className="print:hidden rounded-md border border-white/15 bg-white/10 p-1 text-white/80 hover:bg-white/20 hover:text-white"
                                                title={`Ẩn cột ${col.label}`}
                                            >
                                                <Eye size={13} />
                                            </button>
                                            <span>{col.label}</span>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredDebtData.length === 0 ? (
                                <tr>
                                    <td colSpan={visibleInvoiceColumns.length || 1} className="p-8 text-center text-slate-400 font-bold">Không có hóa đơn nào phù hợp với tìm kiếm.</td>
                                </tr>
                            ) : (
                                filteredDebtData.map(debt => (
                                    <tr id={"row-" + debt.id} key={debt.id} className="hover:bg-slate-50/50 transition duration-150 group">
                                        {visibleInvoiceColumns.map(col => (
                                            <td
                                                key={col.key}
                                                className={`py-3.5 align-middle tabular-nums ${col.align === 'right' ? 'text-right font-semibold' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.key === 'remainingAmount' ? 'font-bold' : 'text-slate-600'}`}
                                                style={{ paddingLeft: invoiceTableLayout.cellPaddingX, paddingRight: invoiceTableLayout.cellPaddingX, fontSize: invoiceTableLayout.fontSize }}
                                            >
                                                {renderDebtCell(debt, col.key)}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                            {filteredDebtData.length > 0 && (
                                <tr className="bg-slate-100 font-black border-t-2 border-slate-300 text-slate-800 text-xs sticky bottom-0 z-10 shadow-[0_-2px_4px_rgba(0,0,0,0.05)]">
                                    {visibleInvoiceColumns.map((col, idx) => {
                                        if (idx === 0) {
                                            return <td key={col.key} className="py-4 px-4 align-middle text-center uppercase tracking-wider">Tổng cộng:</td>;
                                        }
                                        if (col.total) {
                                            const total = filteredDebtData.reduce((sum, d) => sum + col.total(d), 0);
                                            const colorClass =
                                                col.key === 'invoiceAmount' ? 'text-blue-700' :
                                                col.key === 'receivedAmount' ? 'text-emerald-700' :
                                                col.key === 'remainingAmount' ? 'text-red-700' :
                                                col.key === 'vatAmount' ? 'text-slate-500' : 'text-slate-900';
                                            return (
                                                <td key={col.key} className={`py-4 align-middle text-center tabular-nums ${colorClass}`} style={{ paddingLeft: invoiceTableLayout.cellPaddingX, paddingRight: invoiceTableLayout.cellPaddingX }}>
                                                    {formatCurrency(total)}
                                                </td>
                                            );
                                        }
                                        return <td key={col.key} className="py-4 align-middle"></td>;
                                    })}
                                </tr>
                            )}
                        </tbody>
                    </table>
                    <div className="expected-print-signatures hidden">
                        <div className="expected-print-signature-box">
                            <div className="expected-print-signature-title">NGƯỜI LẬP BIỂU</div>
                            <div className="expected-print-signature-space"></div>
                        </div>
                        <div className="expected-print-signature-box">
                            <div className="expected-print-signature-title">KẾ TOÁN TRƯỞNG</div>
                            <div className="expected-print-signature-space"></div>
                        </div>
                        <div className="expected-print-signature-box">
                            <div className="expected-print-signature-title">GIÁM ĐỐC</div>
                            <div className="expected-print-signature-space"></div>
                        </div>
                    </div>
                </div>
            </div>
            <ConfirmModal 
                isOpen={confirmDelete.isOpen}
                title="Xóa hóa đơn PDF"
                message="Bạn có chắc chắn muốn xóa file PDF hóa đơn này khỏi hệ thống không?"
                confirmText="Xóa tệp"
                type="danger"
                onConfirm={async () => {
                    const { debt, type } = confirmDelete;
                    setConfirmDelete({ isOpen: false, debt: null, type: null });
                    if (debt) {
                        await handleDeletePdf(debt, type);
                    }
                }}
                onCancel={() => setConfirmDelete({ isOpen: false, debt: null, type: null })}
            />

            {/* Modal chỉnh sửa thông tin hóa đơn */}
            {editModal.isOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden transform transition-all animate-in scale-in duration-200">
                        <header className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                    <Edit3 className="text-blue-600" size={18} /> Điều Chỉnh Thông Tin Hóa Đơn
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Công trình: <span className="font-semibold text-slate-700">{editModal.debt?.project_name}</span> | <span className="font-semibold text-slate-700">{editModal.debt?.phase}</span>
                                </p>
                            </div>
                            <button 
                                onClick={() => setEditModal(prev => ({ ...prev, isOpen: false, debt: null }))}
                                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
                            >
                                <X size={18} />
                            </button>
                        </header>
                        
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Số Hóa Đơn</label>
                                    <input 
                                        type="text"
                                        placeholder="Nhập số hóa đơn..."
                                        value={editModal.invoiceNo}
                                        onChange={(e) => setEditModal(prev => ({ ...prev, invoiceNo: e.target.value }))}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Ngày Hóa Đơn</label>
                                    <input 
                                        type="date"
                                        value={editModal.invoiceDate}
                                        onChange={(e) => setEditModal(prev => ({ ...prev, invoiceDate: e.target.value }))}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Số Chứng Từ</label>
                                <input 
                                    type="text"
                                    placeholder="Nhập số chứng từ..."
                                    value={editModal.voucherNo}
                                    onChange={(e) => setEditModal(prev => ({ ...prev, voucherNo: e.target.value }))}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition"
                                />
                            </div>

                            <hr className="border-slate-100 my-2" />

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Trước Thuế</label>
                                    <CurrencyInput 
                                        placeholder="Nhập số tiền..."
                                        value={editModal.amount}
                                        onChange={(val) => {
                                            setEditModal(prev => {
                                                const vat = prev.vatAmount;
                                                return {
                                                    ...prev,
                                                    amount: val,
                                                    postTaxAmount: val + vat
                                                };
                                            });
                                        }}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-bold text-green-600 outline-none focus:border-blue-500 focus:bg-white transition text-right"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Thuế VAT</label>
                                    <CurrencyInput 
                                        placeholder="Nhập VAT..."
                                        value={editModal.vatAmount}
                                        onChange={(val) => {
                                            setEditModal(prev => {
                                                const amt = prev.amount;
                                                return {
                                                    ...prev,
                                                    vatAmount: val,
                                                    postTaxAmount: amt + val
                                                };
                                            });
                                        }}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-600 outline-none focus:border-blue-500 focus:bg-white transition text-right"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Sau Thuế</label>
                                <CurrencyInput 
                                    placeholder="Nhập số tiền sau thuế..."
                                    value={editModal.postTaxAmount}
                                    onChange={(val) => {
                                        setEditModal(prev => ({
                                            ...prev,
                                            postTaxAmount: val,
                                            amount: val - prev.vatAmount
                                        }));
                                    }}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-bold text-blue-600 outline-none focus:border-blue-500 focus:bg-white transition text-right"
                                />
                            </div>
                        </div>

                        <footer className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                            <button 
                                onClick={() => setEditModal(prev => ({ ...prev, isOpen: false, debt: null }))}
                                className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-semibold text-sm hover:bg-slate-100 transition cursor-pointer"
                                disabled={isSaving}
                            >
                                Hủy
                            </button>
                            <button 
                                onClick={handleSaveEdit}
                                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition flex items-center gap-1.5 cursor-pointer disabled:bg-blue-400"
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-1.5 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Đang lưu...
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} /> Lưu Thay Đổi
                                    </>
                                )}
                            </button>
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );
}
