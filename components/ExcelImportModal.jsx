'use client';
/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

import React, { useState, useEffect, useRef } from 'react';
import { X, Check, AlertCircle, Info, Table as TableIcon, Trash2, Clipboard } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import ConfirmModal from '@/components/ConfirmModal';

export default function ExcelImportModal({ 
    isOpen, 
    onClose, 
    onConfirm, 
    projectName,
    parseVietnameseNumber,
    parseDateVN
}) {
    const [gridData, setGridData] = useState([]);
    const [errors, setErrors] = useState([]);
    const [confirmClear, setConfirmClear] = useState(false);
    const tableRef = useRef(null);

    const headers = [
        'Ngày HT', 'Ngày HĐ', 'Số HĐ', 'Diễn giải', 'Mã CP', 
        'TK Đối ứng', 'Nợ', 'Có', 'Số tiền', 'Đối tượng'
    ];

    // Khởi tạo bảng trống
    useEffect(() => {
        if (isOpen && gridData.length === 0) {
            const emptyRows = Array(10).fill(Array(headers.length).fill(''));
            setGridData(emptyRows);
        }
    }, [isOpen]);

    const handleCellChange = (rowIndex, colIndex, value) => {
        const newData = [...gridData];
        newData[rowIndex] = [...newData[rowIndex]];
        newData[rowIndex][colIndex] = value;
        setGridData(newData);
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const clipboardData = e.clipboardData || window.clipboardData;
        const pastedData = clipboardData.getData('Text');
        
        const rows = pastedData.split(/\r?\n/).filter(row => row.trim() !== '');
        const newGridRows = rows.map(row => {
            const cols = row.split('\t');
            // Đảm bảo đủ số cột
            const filledCols = Array(headers.length).fill('');
            cols.forEach((val, i) => { if (i < headers.length) filledCols[i] = val; });
            return filledCols;
        });

        // Nếu bảng hiện tại trống (toàn ô rỗng), thay thế hoàn toàn. Nếu không, nối thêm.
        const isEmpty = gridData.every(row => row.every(cell => cell === ''));
        if (isEmpty) {
            setGridData(newGridRows);
        } else {
            setGridData([...gridData, ...newGridRows]);
        }
    };

    const removeRow = (index) => {
        setGridData(gridData.filter((_, i) => i !== index));
    };

    const validateAndConfirm = () => {
        const processedTransactions = [];
        const newErrors = [];
        
        gridData.forEach((cols, rowIndex) => {
            const rowNum = rowIndex + 1;
            const isEmptyRow = cols.every(cell => !cell || cell.toString().trim() === '');
            if (isEmptyRow) return;

            if (cols.length < 5) {
                newErrors.push(`Dòng ${rowNum}: Thiếu dữ liệu quan trọng.`);
                return;
            }

            try {
                const accountingDate = parseDateVN(cols[0]);
                if (!accountingDate) {
                    newErrors.push(`Dòng ${rowNum}: Ngày hạch toán "${cols[0]}" không đúng (DD/MM/YYYY).`);
                    return;
                }

                const invoiceDate = parseDateVN(cols[1]) || accountingDate;
                const note = cols[3]?.toString().trim() || '';
                let codeRaw = cols[4]?.toString().trim() || '621';
                const code = (codeRaw.split(' ')[0] || codeRaw).replace(',', '.');
                const correspondingAccount = cols[5]?.toString().trim() || '';
                const debitRaw = parseVietnameseNumber(cols[6]);
                const creditRaw = parseVietnameseNumber(cols[7]);
                const recipient = cols[9]?.toString().trim() || '';
                const invoiceNo = cols[2]?.toString().trim() || '';
                
                let debit = Math.abs(debitRaw);
                let credit = Math.abs(creditRaw);
                
                if (debit === 0 && credit === 0) {
                    const amount = parseVietnameseNumber(cols[8]);
                    if (amount < 0) debit = Math.abs(amount);
                    else if (amount > 0) credit = amount;
                }

                processedTransactions.push({
                    project_name: projectName,
                    accounting_date: accountingDate,
                    invoice_date: invoiceDate,
                    invoice_no: invoiceNo,
                    note,
                    code,
                    corresponding_account: correspondingAccount,
                    debit,
                    credit,
                    recipient
                });
            } catch (err) {
                newErrors.push(`Dòng ${rowNum}: Lỗi xử lý dữ liệu.`);
            }
        });

        if (newErrors.length > 0) {
            setErrors(newErrors);
            return;
        }

        if (processedTransactions.length === 0) {
            alert("Không có dữ liệu hợp lệ để nhập!");
            return;
        }

        onConfirm(processedTransactions);
        setGridData([]);
        setErrors([]);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[1000] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-[95vw] h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                <header className="bg-blue-600 p-6 text-white flex justify-between items-center shadow-lg">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-xl">
                            <TableIcon size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black uppercase tracking-tight">Nhập Dữ Liệu Từ Excel</h3>
                            <p className="text-blue-100 text-xs mt-0.5">Dự án: <span className="font-bold underline">{projectName}</span> | Giao diện bảng tính thông minh</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition"><X /></button>
                </header>

                <div className="flex-1 flex flex-col overflow-hidden p-6 bg-slate-50">
                    <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-sm flex items-start gap-3">
                            <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><Info size={18} /></div>
                            <div>
                                <p className="text-xs font-bold text-slate-800 uppercase mb-1">Cách nhập liệu</p>
                                <p className="text-xs text-slate-500 leading-relaxed">Copy vùng dữ liệu từ Excel (không tiêu đề) rồi nhấn <b>Ctrl+V</b> vào bất kỳ đâu trong bảng.</p>
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-sm flex items-start gap-3">
                            <div className="bg-amber-100 p-2 rounded-lg text-amber-600"><Clipboard size={18} /></div>
                            <div>
                                <p className="text-xs font-bold text-slate-800 uppercase mb-1">Thứ tự cột Excel</p>
                                <p className="text-[10px] text-slate-500 font-mono leading-tight">
                                    Ngày HT | Ngày HĐ | Số HĐ | Diễn giải | Mã CP | TK Đối ứng | Nợ | Có | Số tiền | Đối tượng
                                </p>
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm flex items-start gap-3">
                            <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600"><Check size={18} /></div>
                            <div>
                                <p className="text-xs font-bold text-slate-800 uppercase mb-1">Kiểm tra & Sửa</p>
                                <p className="text-xs text-slate-500 leading-relaxed">Bạn có thể sửa trực tiếp trong các ô bên dưới trước khi bấm xác nhận nhập.</p>
                            </div>
                        </div>
                    </div>

                    {errors.length > 0 && (
                        <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-2xl animate-in slide-in-from-top">
                            <div className="flex items-center gap-2 text-red-700 font-black text-sm mb-2 uppercase">
                                <AlertCircle size={18} /> Phát hiện {errors.length} lỗi cần xử lý:
                            </div>
                            <div className="max-h-24 overflow-y-auto text-xs text-red-600 space-y-1 custom-scrollbar">
                                {errors.map((err, i) => <p key={i}>• {err}</p>)}
                            </div>
                        </div>
                    )}

                    <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-inner overflow-hidden flex flex-col">
                        <div className="flex-1 overflow-auto custom-scrollbar" onPaste={handlePaste}>
                            <table className="w-full border-collapse text-[13px]" ref={tableRef}>
                                <thead className="sticky top-0 z-10">
                                    <tr className="bg-slate-800 text-white shadow-sm">
                                        <th className="p-3 border-r border-slate-700 w-12 text-center">STT</th>
                                        {headers.map((h, i) => (
                                            <th key={i} className="p-3 border-r border-slate-700 font-bold whitespace-nowrap text-left">{h}</th>
                                        ))}
                                        <th className="p-3 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {gridData.map((row, rowIndex) => (
                                        <tr key={rowIndex} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors group">
                                            <td className="p-2 border-r bg-slate-50 text-slate-400 font-mono text-center text-xs">{rowIndex + 1}</td>
                                            {row.map((cell, colIndex) => (
                                                <td key={colIndex} className="p-0 border-r border-slate-100 relative focus-within:ring-2 focus-within:ring-blue-500 focus-within:z-10">
                                                    <input 
                                                        type="text" 
                                                        value={cell} 
                                                        onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                                                        className="w-full p-2.5 outline-none bg-transparent font-medium text-slate-700 placeholder-slate-200"
                                                        placeholder="..."
                                                    />
                                                </td>
                                            ))}
                                            <td className="p-2 text-center">
                                                <button 
                                                    onClick={() => removeRow(rowIndex)}
                                                    className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    <tr>
                                        <td colSpan={headers.length + 2} className="p-4 text-center">
                                            <button 
                                                onClick={() => setGridData([...gridData, Array(headers.length).fill('')])}
                                                className="text-blue-600 font-bold hover:underline flex items-center gap-1 mx-auto"
                                            >
                                                + Thêm dòng trống
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <footer className="p-6 bg-white border-t flex flex-col md:flex-row justify-between items-center gap-6 shadow-2xl">
                    <div className="text-slate-500 text-sm flex items-center gap-2">
                        <span className="bg-slate-100 px-3 py-1 rounded-full font-bold text-slate-700">
                            {gridData.filter(row => row.some(cell => cell)).length} dòng dữ liệu
                        </span>
                        <span>Sẵn sàng để nhập</span>
                    </div>
                    <div className="flex gap-4 w-full md:w-auto">
                        <button 
                            type="button"
                            onClick={() => setConfirmClear(true)}
                            className="flex-1 md:flex-none px-6 py-3 rounded-2xl font-bold text-red-600 hover:bg-red-50 hover:text-red-700 border border-red-200 transition flex items-center justify-center gap-2"
                        >
                            <Trash2 size={18} /> Xóa toàn bộ
                        </button>
                        <button 
                            onClick={onClose}
                            className="flex-1 md:flex-none px-8 py-3 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 transition"
                        >
                            Hủy bỏ
                        </button>
                        <button 
                            onClick={validateAndConfirm}
                            className="flex-1 md:flex-none px-12 py-3 rounded-2xl font-black bg-blue-600 text-white shadow-xl shadow-blue-600/30 hover:bg-blue-700 hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2"
                        >
                            <Check size={20} /> XÁC NHẬN NHẬP DỮ LIỆU
                        </button>
                    </div>
                </footer>
            </div>
            
            <ConfirmModal
                isOpen={confirmClear}
                title="Xóa dữ liệu đang nhập"
                message="Bạn có chắc chắn muốn xóa toàn bộ dữ liệu đang có trong bảng để nhập lại?"
                onConfirm={() => {
                    setGridData(Array(10).fill(Array(headers.length).fill('')));
                    setErrors([]);
                    setConfirmClear(false);
                }}
                onCancel={() => setConfirmClear(false)}
            />
        </div>
    );
}
