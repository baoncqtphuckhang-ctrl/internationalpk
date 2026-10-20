'use client';
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const formatDateInputDisplay = (dateVal = '') => {
    if (!dateVal) return '';
    const s = String(dateVal).trim().split('T')[0];
    if (s.includes('-')) {
        const parts = s.split('-');
        if (parts.length === 3) {
            const [y, m, d] = parts;
            if (y.length === 4) {
                return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
            }
        }
    }
    if (s.includes('/')) {
        const parts = s.split('/');
        if (parts.length === 3) {
            if (parts[0].length === 4) {
                return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
            }
            return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
        }
    }
    return s;
};

const normalizeDateTextInput = (value = '') => {
    const digits = String(value).replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const parseDateDisplayToIso = (value = '') => {
    if (!value) return '';
    const clean = String(value).trim();
    const match = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (!match) return '';
    let [, day, month, year] = match;
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    if (d < 1 || d > 31 || m < 1 || m > 12) return '';
    day = String(d).padStart(2, '0');
    month = String(m).padStart(2, '0');
    if (year.length === 2) year = '20' + year;
    return `${year}-${month}-${day}`;
};

function DateInputCell({ value, onChange, disabled = false, className = '' }) {
    const [text, setText] = useState(() => formatDateInputDisplay(value));

    useEffect(() => {
        setText(formatDateInputDisplay(value));
    }, [value]);

    const handleTextChange = (e) => {
        const raw = e.target.value;
        if (e.nativeEvent?.inputType?.includes('delete')) {
            setText(raw);
            if (!raw) onChange('');
            return;
        }
        const normalized = normalizeDateTextInput(raw);
        setText(normalized);
        if (normalized.length === 10) {
            const iso = parseDateDisplayToIso(normalized);
            if (iso) onChange(iso);
        }
    };

    const handleBlur = () => {
        if (!text) {
            onChange('');
            return;
        }
        const iso = parseDateDisplayToIso(text);
        if (iso) {
            onChange(iso);
            setText(formatDateInputDisplay(iso));
        } else {
            setText(formatDateInputDisplay(value));
        }
    };

    const handlePickerChange = (e) => {
        const val = e.target.value;
        if (val) {
            onChange(val);
            setText(formatDateInputDisplay(val));
        }
    };

    const pickerValue = value ? String(value).split('T')[0] : '';

    return (
        <div className={`relative w-full h-full flex items-center group/date ${className}`}>
            <input
                type="text"
                disabled={disabled}
                value={text}
                onChange={handleTextChange}
                onBlur={handleBlur}
                placeholder="dd/mm/yyyy"
                className={`w-full h-full p-2 pr-7 outline-none bg-transparent text-center font-medium text-slate-700 text-sm ${disabled ? 'cursor-not-allowed' : ''}`}
            />
            {!disabled && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center">
                    <input
                        type="date"
                        value={pickerValue}
                        onChange={handlePickerChange}
                        className="opacity-0 absolute inset-0 cursor-pointer w-6 h-6 z-10"
                        tabIndex={-1}
                    />
                    <Calendar size={15} className="text-slate-400 group-hover/date:text-blue-600 transition pointer-events-none" />
                </div>
            )}
        </div>
    );
}

export default function SupplierDebt({ currentUser, projects, showToast }) {
    const defaultSuppliers = [
        "CÔNG TY TNHH AKZO NOBEL VIỆT NAM",
        "CÔNG TY TNHH THƯƠNG MẠI VÀ XÂY DỰNG THẾ HỆ MỚI",
        "Công ty TNHH Sơn Jotun Việt Nam",
        "CÔNG TY CỔ PHẦN ĐẦU TƯ SẢN XUẤT LÊ TRẦN",
        "CÔNG TY TNHH DT TM DV XÂY DỰNG HOÀNG KIM",
        "CÔNG TY CỔ PHẦN XÂY DỰNG VÀ THIẾT KẾ SỐ 1",
        "CÔNG TY CP NAM VIỆT ÚC",
        "CÔNG TY TNHH MỘT THÀNH VIÊN THƯƠNG MẠI SƠN MINH PHÁT",
        "CÔNG TY TNHH SƠN NGHĨA PHÁT"
    ];
    const [suppliers, setSuppliers] = useState(defaultSuppliers);
    const [selectedSupplier, setSelectedSupplier] = useState(defaultSuppliers[0]);
    const [rows, setRows] = useState([]);

    useEffect(() => {
        const fetchSuppliers = async () => {
            const { data, error } = await supabase
                .from('material_orders')
                .select('company')
                .eq('is_deleted', false);
            
            let loadedSuppliers = [];
            if (!error && data) {
                const unique = [...new Set(data.map(d => d.company).filter(c => c && c.trim()))];
                loadedSuppliers = unique;
            }

            // Fallback: Lấy thêm từ local storage nếu dùng tạm
            try {
                const localOrders = JSON.parse(localStorage.getItem('misa_material_orders')) || [];
                const localCompanies = localOrders.map(o => o.company).filter(c => c && c.trim());
                loadedSuppliers = [...loadedSuppliers, ...localCompanies];
            } catch (e) {}
            
            const stored = localStorage.getItem('supplier_list');
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    loadedSuppliers = [...loadedSuppliers, ...parsed];
                } catch(e) {}
            }
            
            loadedSuppliers = [...new Set(loadedSuppliers)].sort();
            
            if (loadedSuppliers.length === 0) loadedSuppliers = [...defaultSuppliers];
            else {
                // Đảm bảo các NCC mặc định luôn có mặt
                loadedSuppliers = [...new Set([...defaultSuppliers, ...loadedSuppliers])].sort();
            }
            setSuppliers(loadedSuppliers);
            if (loadedSuppliers.length > 0 && !loadedSuppliers.includes(selectedSupplier)) {
                setSelectedSupplier(loadedSuppliers[0]);
            }
        };
        fetchSuppliers();
    }, []);

    const handleAddSupplier = () => {
        const name = prompt('Nhập tên nhà cung cấp mới:');
        if (name && name.trim()) {
            const newName = name.trim();
            if (!suppliers.includes(newName)) {
                const newSuppliers = [...suppliers, newName];
                setSuppliers(newSuppliers);
                setSelectedSupplier(newName);
                localStorage.setItem('supplier_list', JSON.stringify(newSuppliers));
            } else {
                setSelectedSupplier(newName);
            }
        }
    };

    useEffect(() => {
        const fetchAndSyncOrders = () => {
            if (!selectedSupplier) return;

            const invoicesData = localStorage.getItem('purchase_invoices_matrix');
            let invoices = [];
            if (invoicesData) {
                try {
                    const parsed = JSON.parse(invoicesData);
                    invoices = parsed[selectedSupplier] || [];
                } catch(e) {}
            }

            const parseNum = (val) => {
                if (!val) return 0;
                const v = String(val).replace(/,/g, '');
                return isNaN(parseFloat(v)) ? 0 : parseFloat(v);
            };

            const groups = {};
            invoices.forEach(row => {
                const invoiceKey = row.soHD ? `soHD_${row.soHD.trim().toLowerCase()}` : `order_${row.order_id || 'manual_' + row.id}`;
                if (!groups[invoiceKey]) {
                    groups[invoiceKey] = {
                        id: invoiceKey,
                        soHD: row.soHD || '',
                        ngayHD: row.ngayHD || row.ngayMua || '',
                        congTrinh: row.congTrinh || '',
                        giaTriTotal: 0
                    };
                }
                
                let val = 0;
                if (row.giaTriSauThue && parseNum(row.giaTriSauThue) > 0) val = parseNum(row.giaTriSauThue);
                else val = parseNum(row.giaTriTruocThue) + parseNum(row.tienVAT || row.vat || 0);
                
                groups[invoiceKey].giaTriTotal += val;
            });

            const paymentsData = localStorage.getItem('supplier_debt_payments');
            let payments = {};
            if (paymentsData) {
                try {
                    const parsed = JSON.parse(paymentsData);
                    payments = parsed[selectedSupplier] || {};
                } catch(e) {}
            }

            const computedRows = Object.values(groups).map(g => {
                const p = payments[g.id] || {};
                return {
                    id: g.id,
                    soHD: g.soHD,
                    ngayHD: g.ngayHD,
                    congTrinh: g.congTrinh,
                    giaTri: g.giaTriTotal > 0 ? new Intl.NumberFormat('vi-VN').format(g.giaTriTotal) : '',
                    hanTT: p.hanTT || '',
                    ngayTra: p.ngayTra || '',
                    trangThai: p.trangThai || 'Chưa trả'
                };
            }).sort((a, b) => {
                if (!a.ngayHD && !b.ngayHD) return 0;
                if (!a.ngayHD) return 1;
                if (!b.ngayHD) return -1;
                return new Date(b.ngayHD) - new Date(a.ngayHD);
            });

            setRows(computedRows);
        };

        fetchAndSyncOrders();
        
        // Refresh every 2 seconds to catch updates from Purchase Invoices tab
        const interval = setInterval(fetchAndSyncOrders, 2000);
        return () => clearInterval(interval);
    }, [selectedSupplier]);

    const handleCellChange = (id, field, value) => {
        // Chỉ lưu hanTT, ngayTra, trangThai
        if (['hanTT', 'ngayTra', 'trangThai'].includes(field)) {
            const updated = rows.map(r => r.id === id ? { ...r, [field]: value } : r);
            setRows(updated);
            
            const paymentsData = localStorage.getItem('supplier_debt_payments');
            let paymentsAll = {};
            if (paymentsData) {
                try { paymentsAll = JSON.parse(paymentsData); } catch(e) {}
            }
            if (!paymentsAll[selectedSupplier]) paymentsAll[selectedSupplier] = {};
            
            const p = paymentsAll[selectedSupplier][id] || {};
            p[field] = value;
            paymentsAll[selectedSupplier][id] = p;
            
            localStorage.setItem('supplier_debt_payments', JSON.stringify(paymentsAll));
        } else {
            showToast('Vui lòng cập nhật trường này ở tab HĐ Mua Vào.', 'info');
        }
    };

    return (
        <div className="w-full flex flex-col h-[calc(100vh-120px)] animate-in fade-in pb-10">
            <div className="flex flex-col md:flex-row items-center justify-between mb-4 bg-white p-3 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-4">
                    <select 
                        value={selectedSupplier} 
                        onChange={e => setSelectedSupplier(e.target.value)}
                        className="p-2.5 border-2 border-slate-200 rounded-lg outline-none font-bold min-w-[200px] text-slate-700 bg-slate-50 focus:border-blue-500 transition"
                    >
                        {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button onClick={handleAddSupplier} className="px-3 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg font-bold text-sm transition whitespace-nowrap">
                        + Thêm NCC
                    </button>
                </div>
                <div>
                    <span className="text-xs text-slate-500 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200 shadow-sm font-medium">💡 Dữ liệu Công nợ và Số hóa đơn được liên kết và tính toán tự động từ tab HĐ Mua Vào.</span>
                </div>
            </div>

            <div className="flex-1 overflow-auto bg-white rounded-xl shadow-sm border border-slate-200 custom-scrollbar relative">
                <table className="w-full text-sm border-collapse min-w-max">
                    <thead className="sticky top-0 z-20 bg-slate-100 shadow-sm">
                        <tr>
                            <th className="border border-slate-300 p-2 text-center bg-slate-100 font-black text-slate-700">Số HĐ</th>
                            <th className="border border-slate-300 p-2 text-center bg-slate-100 font-black text-slate-700">Ngày HĐ</th>
                            <th className="border border-slate-300 p-2 text-center bg-slate-100 font-black text-slate-700">Công trình</th>
                            <th className="border border-slate-300 p-2 text-center bg-slate-100 font-black text-slate-700">Hạn TT</th>
                            <th className="border border-slate-300 p-2 text-center bg-slate-100 font-black text-slate-700">Giá trị</th>
                            <th className="border border-slate-300 p-2 text-center bg-slate-100 font-black text-slate-700">Đã trả vào ngày</th>
                            <th className="border border-slate-300 p-2 text-center bg-slate-100 font-black text-slate-700">Trạng thái</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(row => (
                            <tr key={row.id} className="hover:bg-blue-50/30 transition group">
                                <td className="border border-slate-200 p-0 bg-slate-50/50">
                                    <input type="text" value={row.soHD} disabled className="w-full h-full p-2 outline-none bg-transparent text-center font-bold min-w-[120px] cursor-not-allowed" />
                                </td>
                                <td className="border border-slate-200 p-0 bg-slate-50/50">
                                    <input type="text" value={formatDateInputDisplay(row.ngayHD)} disabled placeholder="-" className="w-full h-full p-2 outline-none bg-transparent text-center font-medium min-w-[120px] cursor-not-allowed text-slate-700" />
                                </td>
                                <td className="border border-slate-200 p-0 bg-slate-50/50">
                                    <input type="text" value={row.congTrinh} disabled className="w-full h-full p-2 outline-none bg-transparent text-center font-medium text-slate-600 min-w-[150px] cursor-not-allowed" />
                                </td>
                                <td className="border border-slate-200 p-0 relative">
                                    <DateInputCell value={row.hanTT} onChange={val => handleCellChange(row.id, 'hanTT', val)} />
                                </td>
                                <td className="border border-slate-200 p-0 bg-slate-50/50">
                                    <input type="text" value={row.giaTri} disabled className="w-full h-full p-2 outline-none bg-transparent text-center font-bold text-rose-600 min-w-[120px] cursor-not-allowed" />
                                </td>
                                <td className="border border-slate-200 p-0 relative">
                                    <DateInputCell value={row.ngayTra} onChange={val => handleCellChange(row.id, 'ngayTra', val)} />
                                </td>
                                <td className="border border-slate-200 p-0">
                                    <select value={row.trangThai} onChange={e => handleCellChange(row.id, 'trangThai', e.target.value)} className={`w-full h-full p-2 outline-none bg-transparent text-center font-bold cursor-pointer min-w-[120px] hover:bg-slate-50 ${row.trangThai === 'Đã trả' ? 'text-emerald-600' : row.trangThai === 'Đã trừ CK' ? 'text-blue-600' : 'text-slate-700'}`}>
                                        <option value="Chưa trả">Chưa trả</option>
                                        <option value="Đã trừ CK">Đã trừ CK</option>
                                        <option value="Đã trả">Đã trả</option>
                                    </select>
                                </td>
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={7} className="border border-slate-200 p-12 text-center text-slate-500 bg-slate-50/50">
                                    Chưa có dữ liệu Hóa Đơn Mua Vào nào của NCC này để tổng hợp.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
