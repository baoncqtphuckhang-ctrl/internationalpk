'use client';
import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function PurchaseInvoices({ currentUser, projects, showToast }) {
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
        const fetchAndSyncOrders = async () => {
            if (!selectedSupplier) return;

            let currentRows = [];
            const localData = localStorage.getItem('purchase_invoices_matrix');
            if (localData) {
                try {
                    const parsed = JSON.parse(localData);
                    currentRows = parsed[selectedSupplier] || [];
                } catch (e) {}
            }

            let supplierOrders = [];
            try {
                const { data, error } = await supabase
                    .from('material_orders')
                    .select('*');
                
                if (!error && data) {
                    supplierOrders = data.filter(o => {
                        const isDeleted = o.is_deleted === true || o.status === 'Đã xóa' || o.status === 'Thùng rác';
                        if (isDeleted) return false;
                        return ((o.order_company || o.company) || '').trim().toLowerCase() === (selectedSupplier || '').trim().toLowerCase();
                    });
                }
            } catch (e) {}

            try {
                const localOrders = JSON.parse(localStorage.getItem('misa_material_orders')) || [];
                const localMatching = localOrders.filter(o => ((o.order_company || o.company) || '').trim().toLowerCase() === (selectedSupplier || '').trim().toLowerCase());
                const dbIds = supplierOrders.map(o => o.id);
                localMatching.forEach(lo => {
                    if (!dbIds.includes(lo.id)) {
                        supplierOrders.push(lo);
                    }
                });
            } catch (e) {}

            let rowsChanged = false;

            supplierOrders.forEach(order => {
                const hasOrder = currentRows.some(r => r.order_id === order.id);
                if (!hasOrder) {
                    if (order.items && Array.isArray(order.items)) {
                        let hasAnyItem = false;
                        order.items.forEach((cat, catIdx) => {
                            if (cat.items && Array.isArray(cat.items)) {
                                cat.items.forEach((item, itemIdx) => {
                                    hasAnyItem = true;
                                    const q = parseFloat(item.quantity) || 0;
                                    if (q > 0) {
                                        hasAnyItem = true;
                                        const p = parseFloat(item.price) || 0;
                                        const total = q * p;
                                        const formattedValue = total > 0 ? new Intl.NumberFormat('vi-VN').format(total) : '';

                                        currentRows.push({
                                            id: `auto_${order.id}_${catIdx}_${itemIdx}_${Date.now()}`,
                                            order_id: order.id,
                                            soHD: '',
                                            ngayMua: order.order_date || '',
                                            ngayHD: '',
                                            congTrinh: order.project_name || '',
                                            dot: order.order_phase || '',
                                            matHang: item.name || '',
                                            dvt: item.unit || '',
                                            soLuong: item.quantity || '',
                                            donGia: item.price > 0 ? new Intl.NumberFormat('vi-VN').format(item.price) : '',
                                            giaTriTruocThue: formattedValue,
                                            vat: '',
                                            tienVAT: '',
                                            giaTriSauThue: ''
                                        });
                                        rowsChanged = true;
                                    }
                                });
                            }
                        });
                        
                        // Fallback if order has no items, create 1 empty row
                        if (!hasAnyItem) {
                            currentRows.push({
                                id: `auto_${order.id}_${Date.now()}`,
                                order_id: order.id,
                                soHD: '',
                                ngayMua: order.order_date || '',
                                ngayHD: '',
                                congTrinh: order.project_name || '',
                                dot: order.order_phase || '',
                                matHang: '',
                                dvt: '',
                                soLuong: '',
                                donGia: '',
                                giaTriTruocThue: '',
                                vat: '',
                                tienVAT: '',
                                giaTriSauThue: ''
                            });
                            rowsChanged = true;
                        }
                    }
                }
            });

            const oldLen = currentRows.length;
            currentRows = currentRows.filter(r => {
                if (r.id.toString().startsWith('auto_') && !r.soLuong && !r.soHD) return false;
                return true;
            });
            if (currentRows.length !== oldLen) rowsChanged = true;

            setRows([...currentRows]);
            if (rowsChanged) {
                const toSave = localData ? JSON.parse(localData) : {};
                toSave[selectedSupplier] = currentRows;
                try {
                    localStorage.setItem('purchase_invoices_matrix', JSON.stringify(toSave));
                } catch (e) {
                    console.log("Cleared old data to free up quota.");
                    try {
                        localStorage.removeItem('purchase_invoices_matrix');
                        localStorage.setItem('purchase_invoices_matrix', JSON.stringify({ [selectedSupplier]: currentRows }));
                    } catch(e2) {}
                }
            }
        };

        fetchAndSyncOrders();
    }, [selectedSupplier]);

    const saveData = (newRows) => {
        setRows(newRows);
        const localData = localStorage.getItem('purchase_invoices_matrix');
        let parsed = {};
        if (localData) {
            try {
                parsed = JSON.parse(localData);
            } catch (e) {}
        }
        parsed[selectedSupplier] = newRows;
        try {
            localStorage.setItem('purchase_invoices_matrix', JSON.stringify(parsed));
        } catch (e) {
            console.log("Cleared old data to free up quota in saveData!");
            try {
                localStorage.removeItem('purchase_invoices_matrix');
                localStorage.setItem('purchase_invoices_matrix', JSON.stringify({ [selectedSupplier]: newRows }));
            } catch(e2) {}
        }
    };

    const handleAddRow = () => {
        const newRow = {
            id: Date.now(),
            order_id: null,
            soHD: '',
            ngayMua: '',
            ngayHD: '',
            congTrinh: projects[0]?.name || '',
            dot: '',
            matHang: '',
            dvt: '',
            soLuong: '',
            donGia: '',
            giaTriTruocThue: '',
            vat: '',
            tienVAT: '',
            giaTriSauThue: ''
        };
        saveData([...rows, newRow]);
    };

    const handleSplitRow = (row) => {
        const newRow = {
            id: Date.now(),
            order_id: row.order_id,
            soHD: '',
            ngayMua: '',
            ngayHD: '',
            congTrinh: row.congTrinh,
            dot: '',
            matHang: '',
            dvt: '',
            soLuong: '',
            donGia: '',
            giaTriTruocThue: '',
            vat: '',
            tienVAT: '',
            giaTriSauThue: ''
        };
        const index = rows.findIndex(r => r.id === row.id);
        const newRows = [...rows];
        newRows.splice(index + 1, 0, newRow);
        saveData(newRows);
    };

    const parseNum = (val) => {
        if (!val) return 0;
        const v = String(val).replace(/,/g, '');
        return isNaN(v) ? 0 : Number(v);
    };
    const formatNum = (val) => {
        if (!val) return '';
        return Number(val).toLocaleString('en-US');
    };

    const handleCellChange = (id, field, value) => {
        const updated = rows.map(r => {
            if (r.id !== id) return r;
            const newR = { ...r, [field]: value };
            
            // Auto calculate if modifying related fields
            if (['soLuong', 'donGia', 'giaTriTruocThue', 'vat'].includes(field)) {
                let sl = parseNum(newR.soLuong);
                let dg = parseNum(newR.donGia);
                let vatPercent = parseNum(newR.vat);
                
                if (field === 'soLuong' || field === 'donGia') {
                    if (newR.soLuong && newR.donGia) {
                        newR.giaTriTruocThue = formatNum(sl * dg);
                    }
                }
                
                let gttt = parseNum(newR.giaTriTruocThue);
                if (newR.vat) {
                    let tvat = gttt * (vatPercent / 100);
                    newR.tienVAT = formatNum(tvat);
                    newR.giaTriSauThue = formatNum(gttt + tvat);
                } else if (field === 'giaTriTruocThue') {
                    newR.tienVAT = '';
                    newR.giaTriSauThue = newR.giaTriTruocThue;
                }
            }
            
            return newR;
        });
        saveData(updated);
    };

    const handleDeleteRow = (id) => {
        if (!confirm('Bạn có chắc muốn xóa dòng này?')) return;
        saveData(rows.filter(r => r.id !== id));
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
                <div className="flex gap-4 items-center">
                    <div className="text-[10px] text-slate-400 font-mono">
                        DB: {typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('misa_material_orders')||'[]').filter(o=>o.company?.trim().toLowerCase()===selectedSupplier?.trim().toLowerCase()).length : 0} orders
                    </div>
                    <button onClick={handleAddRow} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold flex items-center gap-2 hover:bg-emerald-700 shadow-sm transition">
                        <Plus size={16}/> Thêm dòng
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto bg-white rounded-xl shadow-sm border border-slate-200 custom-scrollbar relative">
                <table className="w-full text-sm border-collapse min-w-max">
                    <thead className="sticky top-0 z-20 bg-slate-100 shadow-sm">
                        <tr>
                            <th className="border border-slate-300 p-2 text-center bg-slate-100 font-black text-slate-700">Số HĐ</th>
                            <th className="border border-slate-300 p-2 text-center bg-slate-100 font-black text-slate-700">Ngày mua</th>
                            <th className="border border-slate-300 p-2 text-center bg-slate-100 font-black text-slate-700">Ngày HĐ</th>
                            <th className="border border-slate-300 p-2 text-center bg-slate-100 font-black text-slate-700">Công trình</th>
                            <th className="border border-slate-300 p-2 text-center bg-slate-100 font-black text-slate-700">Đợt</th>
                            <th className="border border-slate-300 p-2 text-center bg-slate-100 font-black text-slate-700">Mặt hàng</th>
                            <th className="border border-slate-300 p-2 text-center bg-slate-100 font-black text-slate-700">ĐVT</th>
                            <th className="border border-slate-300 p-2 text-center bg-slate-100 font-black text-slate-700">Số lượng</th>
                            <th className="border border-slate-300 p-2 text-center bg-slate-100 font-black text-slate-700">Đơn giá</th>
                            <th className="border border-slate-300 p-2 text-center bg-slate-100 font-black text-slate-700 min-w-[120px]">Giá trị chưa thuế</th>
                            <th className="border border-slate-300 p-2 text-center bg-slate-100 font-black text-slate-700">VAT (%)</th>
                            <th className="border border-slate-300 p-2 text-center bg-slate-100 font-black text-slate-700 min-w-[100px]">Thuế GTGT</th>
                            <th className="border border-slate-300 p-2 text-center bg-slate-100 font-black text-slate-700 min-w-[120px]">Giá trị sau VAT</th>
                            <th className="border border-slate-300 p-2 text-center bg-slate-100 w-12"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {[...rows].sort((a, b) => {
                            if (!a.ngayMua && !b.ngayMua) return 0;
                            if (!a.ngayMua) return -1;
                            if (!b.ngayMua) return 1;
                            return new Date(b.ngayMua) - new Date(a.ngayMua);
                        }).map(row => (
                            <tr key={row.id} className="hover:bg-blue-50/30 transition group">
                                <td className="border border-slate-200 p-0"><input type="text" value={row.soHD} onChange={e => handleCellChange(row.id, 'soHD', e.target.value)} className="w-full h-full p-2 outline-none bg-transparent text-center font-medium min-w-[100px]" /></td>
                                <td className="border border-slate-200 p-0"><input type="date" value={row.ngayMua} onChange={e => handleCellChange(row.id, 'ngayMua', e.target.value)} className="w-full h-full p-2 outline-none bg-transparent text-center font-medium min-w-[120px]" /></td>
                                <td className="border border-slate-200 p-0"><input type="date" value={row.ngayHD} onChange={e => handleCellChange(row.id, 'ngayHD', e.target.value)} className="w-full h-full p-2 outline-none bg-transparent text-center font-medium min-w-[120px]" /></td>
                                <td className="border border-slate-200 p-0">
                                    <select value={row.congTrinh} onChange={e => handleCellChange(row.id, 'congTrinh', e.target.value)} className="w-full h-full p-2 outline-none bg-transparent text-center font-medium text-slate-600 min-w-[150px]">
                                        <option value="">-- Chọn công trình --</option>
                                        {projects.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                                    </select>
                                </td>
                                <td className="border border-slate-200 p-0"><input type="text" value={row.dot} onChange={e => handleCellChange(row.id, 'dot', e.target.value)} className="w-full h-full p-2 outline-none bg-transparent text-center font-medium min-w-[80px]" /></td>
                                <td className="border border-slate-200 p-0"><input type="text" value={row.matHang} onChange={e => handleCellChange(row.id, 'matHang', e.target.value)} className="w-full h-full p-2 outline-none bg-transparent text-center font-bold text-slate-700 min-w-[150px]" /></td>
                                <td className="border border-slate-200 p-0"><input type="text" value={row.dvt} onChange={e => handleCellChange(row.id, 'dvt', e.target.value)} className="w-full h-full p-2 outline-none bg-transparent text-center font-medium min-w-[60px]" /></td>
                                <td className="border border-slate-200 p-0"><input type="text" value={row.soLuong} onChange={e => handleCellChange(row.id, 'soLuong', e.target.value)} className="w-full h-full p-2 outline-none bg-transparent text-center font-medium min-w-[80px]" /></td>
                                <td className="border border-slate-200 p-0"><input type="text" value={row.donGia} onChange={e => handleCellChange(row.id, 'donGia', e.target.value)} className="w-full h-full p-2 outline-none bg-transparent text-center font-medium min-w-[100px]" /></td>
                                <td className="border border-slate-200 p-0"><input type="text" value={row.giaTriTruocThue} onChange={e => handleCellChange(row.id, 'giaTriTruocThue', e.target.value)} className="w-full h-full p-2 outline-none bg-transparent text-center font-bold text-amber-600 min-w-[120px]" /></td>
                                <td className="border border-slate-200 p-0"><input type="text" value={row.vat} onChange={e => handleCellChange(row.id, 'vat', e.target.value)} className="w-full h-full p-2 outline-none bg-transparent text-center font-medium min-w-[60px]" /></td>
                                <td className="border border-slate-200 p-0"><input type="text" value={row.tienVAT} onChange={e => handleCellChange(row.id, 'tienVAT', e.target.value)} className="w-full h-full p-2 outline-none bg-transparent text-center font-medium text-slate-600 min-w-[100px]" /></td>
                                <td className="border border-slate-200 p-0"><input type="text" value={row.giaTriSauThue} onChange={e => handleCellChange(row.id, 'giaTriSauThue', e.target.value)} className="w-full h-full p-2 outline-none bg-transparent text-center font-bold text-rose-600 min-w-[120px]" /></td>
                                <td className="border border-slate-200 p-1 text-center whitespace-nowrap">
                                    <button onClick={() => handleSplitRow(row)} className="text-emerald-500 hover:text-emerald-700 p-1.5 rounded-lg hover:bg-emerald-50 transition mr-1" title="Tách thêm hóa đơn cho đơn hàng này"><Plus size={16}/></button>
                                    <button onClick={() => handleDeleteRow(row.id)} className="text-slate-300 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition" title="Xóa dòng này"><Trash2 size={16}/></button>
                                </td>
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={15} className="border border-slate-200 p-12 text-center text-slate-500 bg-slate-50/50">
                                    Chưa có dữ liệu. Bấm <b>Thêm dòng</b> để bắt đầu nhập liệu.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
