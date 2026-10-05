'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Download, Printer, Save, Trash2, Filter } from 'lucide-react';
import ConfirmModal from './ConfirmModal';

export default function MaterialWarehouse({ currentUser, projects, showToast, setMaterialSubTab }) {
    const [selectedProject, setSelectedProject] = useState(projects[0]?.name || '');
    const [allTemplates, setAllTemplates] = useState({});
    const [matrixData, setMatrixData] = useState({});
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false });
    const [quickReceiveModalOpen, setQuickReceiveModalOpen] = useState(false);
    const [adminPassword, setAdminPassword] = useState('123456');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            // Load templates
            let data = [];
            try {
                const res = await supabase.from('material_templates').select('project_name, data');
                if (res.error) throw res.error;
                data = res.data || [];
            } catch (err) {
                console.warn("Could not load material_templates", err);
            }
            const tmplMap = {};
            data.forEach(r => tmplMap[r.project_name] = r.data);
            setAllTemplates(tmplMap);

            let ordersData = [];
            try {
                const res = await supabase.from('material_orders').select('*').order('created_at', { ascending: true });
                if (!res.error) {
                    ordersData = res.data.filter(o => o.items?.[0]?._status !== 'Từ chối');
                }
            } catch (err) {
                console.warn("Could not load material_orders", err);
            }
            setOrders(ordersData);

            const localMatrix = localStorage.getItem('material_warehouse_matrix');
            if (localMatrix) {
                setMatrixData(JSON.parse(localMatrix));
            } else {
                setMatrixData({});
            }

            try {
                const res = await supabase.from('users').select('*');
                if (res.data) {
                    const admin = res.data.find(u => u.role?.toUpperCase() === 'ADMIN' || u.username?.toLowerCase() === 'admin');
                    if (admin) setAdminPassword(admin.password);
                }
            } catch (err) {}
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const saveData = (newMatrixData) => {
        setMatrixData(newMatrixData);
        localStorage.setItem('material_warehouse_matrix', JSON.stringify(newMatrixData));
    };

    // Derived columns
    const columns = [];
    if (selectedProject && allTemplates[selectedProject]) {
        const tmpl = allTemplates[selectedProject];
        const activeVer = tmpl.versions[tmpl.versions.length - 1]; // pick latest
        if (activeVer && activeVer.categories) {
            activeVer.categories.forEach(cat => {
                cat.items.forEach(item => {
                    if (item.name) {
                        columns.push({
                            id: `${item.name}_${item.colorCode||''}`,
                            category: cat.name,
                            name: item.name,
                            color: item.colorCode
                        });
                    }
                });
            });
        }
    }

    const projectOrders = orders.filter(o => (o.project_name || '').toUpperCase() === (selectedProject || '').toUpperCase());
    
    const orderRows = projectOrders.map(order => {
        const orderId = `order_${order.id}`;
        const savedDataObj = (matrixData[selectedProject] || []).find(r => r.id === orderId);
        if (savedDataObj?.isDeleted) return null;
        const savedData = savedDataObj?.data || {};
        
        const rowData = { ...savedData };
        const orderItems = order.items || order.categories;
        if (orderItems) {
            orderItems.forEach(cat => {
                if (!cat.items) return;
                cat.items.forEach(item => {
                    if (item.name) {
                        const colId = `${item.name}_${item.colorCode||''}`;
                        if (!rowData[colId]) rowData[colId] = {};
                        if (item.quantity) {
                            rowData[colId].yeuCau = item.quantity;
                        }
                    }
                });
            });
        }
        
        return {
            id: orderId,
            date: order.created_at ? order.created_at.split('T')[0] : '',
            receiveDate: savedDataObj?.receiveDate || '',
            poBatch: order.order_phase ? order.order_phase.toUpperCase() : 'ĐƠN MỚI',
            isOrder: true,
            data: rowData
        };
    }).filter(Boolean);

    const manualRows = (matrixData[selectedProject] || []).filter(r => !String(r.id).startsWith('order_'));
    const rows = [...orderRows, ...manualRows];

    const handleAddRow = () => {
        const newRow = { id: Date.now(), date: new Date().toISOString().split('T')[0], receiveDate: '', poBatch: '', data: {} };
        const updated = { ...matrixData, [selectedProject]: [...rows, newRow] };
        saveData(updated);
    };

    const handleSaveQuickReceive = (rowId, formData, receiveDate) => {
        const currentSavedRows = matrixData[selectedProject] || [];
        const existingRowIndex = currentSavedRows.findIndex(r => String(r.id) === String(rowId));
        
        let updatedRows = [...currentSavedRows];
        const rowFromOrder = rows.find(r => String(r.id) === String(rowId));
        
        // Check if the parent row ALREADY has any 'nhan' values
        let parentHasNhan = false;
        if (existingRowIndex >= 0) {
            const data = updatedRows[existingRowIndex].data;
            columns.forEach(col => {
                if (data[col.id]?.nhan) parentHasNhan = true;
            });
        }

        if (!parentHasNhan) {
            // First time receiving -> update the parent row directly
            if (existingRowIndex >= 0) {
                const newData = { ...updatedRows[existingRowIndex].data };
                Object.keys(formData).forEach(colId => {
                    if (!newData[colId]) newData[colId] = {};
                    newData[colId].nhan = formData[colId];
                });
                updatedRows[existingRowIndex] = {
                    ...updatedRows[existingRowIndex],
                    data: newData,
                    receiveDate: receiveDate
                };
            } else {
                const newData = { ...rowFromOrder.data };
                Object.keys(formData).forEach(colId => {
                    if (!newData[colId]) newData[colId] = {};
                    newData[colId].nhan = formData[colId];
                });
                updatedRows.push({
                    id: rowId,
                    date: rowFromOrder.date,
                    receiveDate: receiveDate,
                    data: newData
                });
            }
        } else {
            // It already has some receipts, so create a NEW child row
            const newRowId = Date.now();
            const newData = {};
            Object.keys(formData).forEach(colId => {
                if (formData[colId]) {
                    newData[colId] = { nhan: formData[colId] };
                }
            });
            updatedRows.push({
                id: newRowId,
                parentOrderId: rowId,
                poBatch: rowFromOrder.poBatch,
                date: rowFromOrder.date,
                receiveDate: receiveDate,
                data: newData
            });
        }
        
        saveData({ ...matrixData, [selectedProject]: updatedRows });
        showToast('Đã nhập vật tư thành công!');
    };

    const handleReceiveDateChange = (rowId, receiveDate) => {
        const currentSavedRows = matrixData[selectedProject] || [];
        const existingRowIndex = currentSavedRows.findIndex(r => String(r.id) === String(rowId));
        
        let updatedRows = [...currentSavedRows];
        if (existingRowIndex >= 0) {
            updatedRows[existingRowIndex] = { ...updatedRows[existingRowIndex], receiveDate };
        } else {
            const rowFromOrder = rows.find(r => String(r.id) === String(rowId));
            updatedRows.push({
                id: rowId,
                date: rowFromOrder.date,
                receiveDate: receiveDate,
                data: rowFromOrder.data
            });
        }
        saveData({ ...matrixData, [selectedProject]: updatedRows });
    };

    const handlePoBatchChange = (rowId, poBatch) => {
        const updatedRows = rows.map(r => r.id === rowId ? { ...r, poBatch } : r);
        saveData({ ...matrixData, [selectedProject]: updatedRows });
    };

    const handleCellChange = (rowId, colId, field, value) => {
        const currentSavedRows = matrixData[selectedProject] || [];
        const existingRowIndex = currentSavedRows.findIndex(r => r.id === rowId);
        
        let updatedRows = [...currentSavedRows];
        if (existingRowIndex >= 0) {
            updatedRows[existingRowIndex] = {
                ...updatedRows[existingRowIndex],
                data: {
                    ...updatedRows[existingRowIndex].data,
                    [colId]: { ...(updatedRows[existingRowIndex].data[colId] || {}), [field]: value }
                }
            };
        } else {
            const rowFromOrder = rows.find(r => r.id === rowId);
            updatedRows.push({
                id: rowId,
                date: rowFromOrder.date,
                data: {
                    ...rowFromOrder.data,
                    [colId]: { ...(rowFromOrder.data[colId] || {}), [field]: value }
                }
            });
        }
        saveData({ ...matrixData, [selectedProject]: updatedRows });
    };

    const handleDateChange = (rowId, date) => {
        const updatedRows = rows.map(r => r.id === rowId ? { ...r, date } : r);
        saveData({ ...matrixData, [selectedProject]: updatedRows });
    };

    const handleDeleteRow = (rowId) => {
        const isAuthorizer = currentUser?.role?.toUpperCase() === 'ADMIN';
        
        if (!isAuthorizer) {
            setConfirmModal({
                isOpen: true,
                title: 'Đề nghị xóa dòng dữ liệu kho',
                message: 'Gửi đề nghị admin xóa dòng dữ liệu này.',
                type: 'info',
                requireReason: true,
                reasonLabel: 'Lý do đề nghị xóa',
                reasonPlaceholder: 'Ví dụ: Nhập sai dòng, dư thừa...',
                confirmText: 'Gửi đề nghị',
                onConfirm: async (reason) => {
                    setConfirmModal({ isOpen: false, message: '', onConfirm: null });
                    if (!reason || !reason.trim()) {
                        showToast('Vui lòng nhập lý do!', 'error');
                        return;
                    }
                    setIsLoading(true);
                    const recordName = `Dòng dữ liệu kho (${rowId}) - Công trình ${selectedProject}`;
                    const payload = {
                        original_table: 'material_warehouse_matrix',
                        record_id: rowId,
                        record_name: recordName,
                        requested_by: currentUser?.username || 'unknown',
                        reason: reason.trim(),
                        status: 'pending'
                    };
                    const { error } = await supabase.from('delete_requests').insert([payload]);
                    setIsLoading(false);
                    if (error) {
                        showToast('Lỗi khi gửi đề nghị: ' + error.message, 'error');
                    } else {
                        showToast('Đã gửi đề nghị xóa dòng dữ liệu tới Admin!');
                    }
                }
            });
            return;
        }

        setConfirmModal({
            isOpen: true,
            title: 'Xác nhận xóa',
            type: 'danger',
            requirePassword: true,
            message: 'Bạn có chắc chắn muốn xóa dòng dữ liệu này khỏi kho không?',
            onConfirm: async (pwd) => {
                if (pwd !== adminPassword) {
                    showToast('Mật khẩu không đúng!', 'error');
                    return;
                }
                setConfirmModal({ isOpen: false, message: '', onConfirm: null });
                
                if (String(rowId).startsWith('order_')) {
                    const currentSavedRows = matrixData[selectedProject] || [];
                    let updatedRows = [...currentSavedRows];
                    const existingIdx = updatedRows.findIndex(r => r.id === rowId);
                    if (existingIdx >= 0) {
                        updatedRows[existingIdx] = { ...updatedRows[existingIdx], isDeleted: true };
                    } else {
                        updatedRows.push({ id: rowId, isDeleted: true });
                    }
                    saveData({ ...matrixData, [selectedProject]: updatedRows });
                    
                    // Xóa/Xử lý đơn bên order (Soft delete)
                    const orderId = String(rowId).replace('order_', '');
                    supabase.from('material_orders').update({ is_deleted: true }).eq('id', orderId).then(() => {
                        console.log('Soft deleted order', orderId);
                    });
                } else {
                    const currentSavedRows = matrixData[selectedProject] || [];
                    const updatedRows = currentSavedRows.filter(r => r.id !== rowId);
                    saveData({ ...matrixData, [selectedProject]: updatedRows });
                }
                showToast('Đã xóa dòng dữ liệu thành công!');
            }
        });
    };

    const parseNumber = (val) => {
        if (!val) return 0;
        const match = String(val).match(/^(\d+)/);
        return match ? parseInt(match[1]) : 0;
    };

    const totals = {};
    columns.forEach(col => {
        let yeuCauSum = 0;
        let nhanSum = 0;
        rows.forEach(r => {
            const cell = r.data[col.id] || {};
            yeuCauSum += parseNumber(cell.yeuCau);
            nhanSum += parseNumber(cell.nhan);
        });
        totals[col.id] = { yeuCau: yeuCauSum, nhan: nhanSum, chuaNhan: yeuCauSum - nhanSum };
    });

    return (
        <div className="w-full flex flex-col h-[calc(100vh-120px)] animate-in fade-in pb-10">
            <div className="flex flex-col md:flex-row items-center justify-between mb-4 bg-white p-3 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-4">
                    <select 
                        value={selectedProject} 
                        onChange={e => setSelectedProject(e.target.value)}
                        className="p-2.5 border-2 border-slate-200 rounded-lg outline-none font-bold min-w-[200px] text-slate-700 bg-slate-50 focus:border-blue-500 transition"
                    >
                        {projects.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                    </select>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-3 md:mt-0">
                    <button onClick={handleAddRow} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold flex items-center gap-2 hover:bg-emerald-700 shadow-sm transition">
                        <Plus size={16}/> Thêm dòng
                    </button>
                    <button onClick={() => setQuickReceiveModalOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 shadow-sm transition">
                        <Save size={16}/> Nhập vật tư nhanh
                    </button>
                    <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-sm transition">
                        <Plus size={16}/> Thêm cột
                    </button>
                    <button className="px-4 py-2 border-2 border-rose-200 text-rose-600 bg-white rounded-lg font-bold hover:bg-rose-50 transition">
                        NHẬP PO
                    </button>
                    <button onClick={() => setMaterialSubTab && setMaterialSubTab('order')} className="px-4 py-2 border-2 border-amber-200 text-amber-600 bg-white rounded-lg font-bold hover:bg-amber-50 transition">
                        ĐẶT VẬT TƯ
                    </button>
                    <button className="px-4 py-2 border-2 border-cyan-200 text-cyan-600 bg-white rounded-lg font-bold flex items-center gap-2 hover:bg-cyan-50 transition">
                        LỌC PO <Filter size={16}/>
                    </button>
                    <button className="px-4 py-2 border-2 border-purple-200 text-purple-600 bg-white rounded-lg font-bold hover:bg-purple-50 transition">
                        BÁO CÁO
                    </button>

                    <button className="px-4 py-2 border-2 border-red-200 text-red-600 bg-white rounded-lg font-bold flex items-center gap-2 hover:bg-red-50 transition">
                        Clear dữ liệu
                    </button>
                    <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold flex items-center gap-2 hover:bg-emerald-700 shadow-sm transition">
                        <Download size={16}/> Xuất Excel
                    </button>
                    <button className="px-4 py-2 bg-slate-800 text-white rounded-lg font-bold flex items-center gap-2 hover:bg-slate-900 shadow-sm transition">
                        <Printer size={16}/> In
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto bg-white rounded-xl shadow-sm border border-slate-200 custom-scrollbar relative">
                <table className="w-full text-sm border-collapse min-w-max">
                    <thead className="sticky top-0 z-20 bg-slate-100 shadow-sm">
                        <tr>
                            <th className="border border-slate-300 p-2 text-center align-middle bg-slate-100 min-w-[120px] w-[120px] max-w-[120px] font-black text-slate-700 sticky left-0 z-30" rowSpan={2}>NGÀY ĐẶT</th>
                            <th className="border border-slate-300 p-2 text-center align-middle bg-slate-100 min-w-[120px] w-[120px] max-w-[120px] font-black text-slate-700 sticky left-[120px] z-30" rowSpan={2}>NGÀY NHẬN</th>
                            <th className="border border-slate-300 p-2 text-center align-middle bg-slate-100 min-w-[120px] w-[120px] max-w-[120px] font-black text-slate-700 sticky left-[240px] z-30" rowSpan={2}>ĐỢT PO</th>
                            {columns.map(col => (
                                <th key={col.id} className="border border-slate-300 p-2 text-center text-[11px] break-words bg-[var(--col-bg)] text-white w-[180px] leading-tight" style={{ '--col-bg': getStringColor(col.id) }} colSpan={2}>
                                    <div className="font-black uppercase">{col.name}</div>
                                </th>
                            ))}
                            <th className="border border-slate-300 p-2 text-center align-middle bg-slate-100 w-12" rowSpan={2}></th>
                        </tr>
                        <tr>
                            {columns.map(col => (
                                <React.Fragment key={col.id + '_sub'}>
                                    <th className="border border-slate-300 p-1.5 text-center bg-slate-50 text-slate-700 font-bold text-xs w-[90px]">YÊU CẦU</th>
                                    <th className="border border-slate-300 p-1.5 text-center bg-slate-50 text-slate-700 font-bold text-xs w-[90px]">NHẬN</th>
                                </React.Fragment>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(row => (
                            <tr key={row.id} className="hover:bg-blue-50/30 transition group">
                                <td className="border border-slate-200 p-0 bg-white sticky left-0 z-10 group-hover:bg-blue-50/30 shadow-[2px_0_4px_rgba(0,0,0,0.02)] min-w-[120px] w-[120px] max-w-[120px]">
                                    <input type="date" value={row.date || ''} onChange={e => handleDateChange(row.id, e.target.value)} disabled={row.isOrder} className="w-full h-full p-2.5 outline-none bg-transparent font-medium text-slate-600 text-center" />
                                </td>
                                <td className="border border-slate-200 p-0 bg-white sticky left-[120px] z-10 group-hover:bg-blue-50/30 shadow-[2px_0_4px_rgba(0,0,0,0.02)] min-w-[120px] w-[120px] max-w-[120px]">
                                    <input type="date" value={row.receiveDate || ''} onChange={e => handleReceiveDateChange(row.id, e.target.value)} className="w-full h-full p-2.5 outline-none bg-transparent font-medium text-emerald-600 text-center" />
                                </td>
                                <td className="border border-slate-200 p-0 bg-white sticky left-[240px] z-10 group-hover:bg-blue-50/30 shadow-[2px_0_4px_rgba(0,0,0,0.02)] min-w-[120px] w-[120px] max-w-[120px]">
                                    <input type="text" value={row.poBatch || ''} onChange={e => handlePoBatchChange(row.id, e.target.value)} disabled={row.isOrder} className="w-full h-full p-2.5 outline-none bg-transparent font-medium text-slate-600 text-center" placeholder="Đợt PO" />
                                </td>
                                {columns.map(col => {
                                    const cell = row.data[col.id] || {};
                                    return (
                                        <React.Fragment key={col.id}>
                                            <td className={`border border-slate-200 p-0 ${cell.yeuCau ? 'bg-slate-50/50' : ''}`}>
                                                <input type="text" value={cell.yeuCau || ''} onChange={e => handleCellChange(row.id, col.id, 'yeuCau', e.target.value)} disabled={row.isOrder} className={`w-full h-full p-2 outline-none bg-transparent text-center font-medium text-slate-600 ${row.isOrder ? 'opacity-70' : ''}`} placeholder="-" />
                                            </td>
                                            <td className={`border border-slate-200 p-0 bg-blue-50/20`}>
                                                <input type="text" value={cell.nhan || ''} onChange={e => handleCellChange(row.id, col.id, 'nhan', e.target.value)} className="w-full h-full p-2 outline-none bg-transparent text-center font-semibold text-blue-600" placeholder="-" />
                                            </td>
                                        </React.Fragment>
                                    );
                                })}
                                <td className="border border-slate-200 p-1 text-center align-middle bg-white group-hover:bg-blue-50/30">
                                    <button onClick={() => handleDeleteRow(row.id)} className="text-slate-300 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition"><Trash2 size={16}/></button>
                                </td>
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={columns.length * 2 + 4} className="border border-slate-200 p-12 text-center text-slate-500 bg-slate-50/50">
                                    Chưa có dữ liệu. Bấm <b>Thêm dòng</b> để bắt đầu nhập liệu.
                                </td>
                            </tr>
                        )}
                        {/* Dummy row to ensure bottom padding for stickies */}
                        <tr className="h-4 bg-transparent"><td colSpan={columns.length * 2 + 4}></td></tr>
                    </tbody>
                    <tfoot className="sticky bottom-0 z-20">
                        <tr className="bg-slate-100 font-bold shadow-[0_-1px_0_rgba(0,0,0,0.1)]">
                            <td className="border border-slate-300 p-2.5 text-center text-slate-800 sticky left-0 z-30 bg-slate-100" colSpan={3}>TỔNG</td>
                            {columns.map(col => (
                                <React.Fragment key={col.id + '_sum'}>
                                    <td className="border border-slate-300 p-2.5 text-center text-slate-800">{totals[col.id]?.yeuCau || '0'}</td>
                                    <td className="border border-slate-300 p-2.5 text-center text-slate-800">{totals[col.id]?.nhan || '0'}</td>
                                </React.Fragment>
                            ))}
                            <td className="border border-slate-300 p-2 bg-slate-100"></td>
                        </tr>
                        <tr className="bg-white font-bold shadow-[0_-1px_0_rgba(0,0,0,0.1)]">
                            <td className="border border-slate-300 p-2 text-center text-[11px] leading-tight sticky left-0 z-30 bg-white" colSpan={3}>VẬT TƯ<br/>CHƯA NHẬN</td>
                            {columns.map(col => {
                                const chuaNhan = totals[col.id]?.chuaNhan || 0;
                                return (
                                    <td key={col.id + '_rem'} colSpan={2} className={`border border-slate-300 p-2 text-center text-base ${chuaNhan > 0 ? 'text-rose-600 font-black' : 'text-slate-400'}`}>
                                        {chuaNhan}
                                    </td>
                                );
                            })}
                            <td className="border border-slate-300 p-2 bg-white"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {confirmModal.isOpen && (
                <ConfirmModal
                    isOpen={confirmModal.isOpen}
                    onClose={() => setConfirmModal({ isOpen: false })}
                    title={confirmModal.title}
                    message={confirmModal.message}
                    type={confirmModal.type}
                    requirePassword={confirmModal.requirePassword}
                    requireReason={confirmModal.requireReason}
                    reasonLabel={confirmModal.reasonLabel}
                    reasonPlaceholder={confirmModal.reasonPlaceholder}
                    confirmText={confirmModal.confirmText}
                    onConfirm={confirmModal.onConfirm}
                />
            )}
            
            <QuickReceiveModal 
                isOpen={quickReceiveModalOpen}
                onClose={() => setQuickReceiveModalOpen(false)}
                rows={rows}
                columns={columns}
                onSave={handleSaveQuickReceive}
            />
        </div>
    );
}

const QuickReceiveModal = ({ isOpen, onClose, rows, columns, onSave }) => {
    const [selectedRowId, setSelectedRowId] = useState('');
    const [formData, setFormData] = useState({});
    const [receiveDate, setReceiveDate] = useState(new Date().toISOString().split('T')[0]);

    const parseNum = (val) => {
        if (!val) return 0;
        const match = String(val).match(/^(\d+)/);
        return match ? parseInt(match[1]) : 0;
    };

    const getRemaining = (rowId) => {
        const parentRow = rows.find(r => String(r.id) === String(rowId));
        if (!parentRow) return { hasRequest: false, remaining: {} };
        
        const remaining = {};
        let hasRequest = false;
        columns.forEach(col => {
            const y = parseNum(parentRow.data[col.id]?.yeuCau);
            if (y > 0) hasRequest = true;
            
            let n = parseNum(parentRow.data[col.id]?.nhan);
            const children = rows.filter(r => String(r.parentOrderId) === String(rowId));
            children.forEach(child => {
                n += parseNum(child.data[col.id]?.nhan);
            });
            
            remaining[col.id] = { yeuCau: y, nhanToDate: n, chuaNhan: Math.max(0, y - n) };
        });
        return { hasRequest, remaining };
    };

    useEffect(() => {
        if (isOpen) {
            setSelectedRowId('');
            setFormData({});
            setReceiveDate(new Date().toISOString().split('T')[0]);
        }
    }, [isOpen]);

    const handleRowSelect = (e) => {
        const rowId = e.target.value;
        setSelectedRowId(rowId);
        setFormData({});
    };

    const handleFillAll = () => {
        if (!selectedRowId) return;
        const { remaining } = getRemaining(selectedRowId);
        const newData = { ...formData };
        columns.forEach(col => {
            if (remaining[col.id]?.chuaNhan > 0) {
                newData[col.id] = remaining[col.id].chuaNhan;
            }
        });
        setFormData(newData);
    };

    const handleSave = () => {
        if (!selectedRowId) return;
        onSave(selectedRowId, formData, receiveDate);
        onClose();
    };

    if (!isOpen) return null;

    const availableRows = rows.filter(r => {
        const { hasRequest, remaining } = getRemaining(r.id);
        if (!hasRequest) return false;
        
        let isFullyReceived = true;
        columns.forEach(col => {
            if (remaining[col.id]?.yeuCau > 0 && remaining[col.id]?.chuaNhan > 0) {
                isFullyReceived = false;
            }
        });
        return !isFullyReceived;
    });

    const { remaining } = selectedRowId ? getRemaining(selectedRowId) : { remaining: {} };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <Save size={20} className="text-emerald-600"/> Nhập Vật Tư Nhanh
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 font-bold text-lg">✕</button>
                </div>
                
                <div className="p-5 flex-1 overflow-auto custom-scrollbar">
                    <div className="flex gap-4 mb-4">
                        <div className="flex-1">
                            <label className="block text-sm font-bold text-slate-700 mb-1">Chọn Đợt PO / Dòng cần nhập</label>
                            <select 
                                value={selectedRowId} 
                                onChange={handleRowSelect}
                                className="w-full p-2.5 border-2 border-slate-200 rounded-lg outline-none focus:border-emerald-500 transition font-medium"
                            >
                                <option value="">-- Chọn Đợt PO --</option>
                                {availableRows.map(r => (
                                    <option key={r.id} value={r.id}>
                                        {r.poBatch || 'Dòng mới'} - Ngày {r.date} {r.isOrder ? '(Đơn PO)' : '(Thủ công)'}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="w-[180px]">
                            <label className="block text-sm font-bold text-slate-700 mb-1">Ngày nhận kho</label>
                            <input 
                                type="date"
                                value={receiveDate}
                                onChange={(e) => setReceiveDate(e.target.value)}
                                className="w-full p-2.5 border-2 border-slate-200 rounded-lg outline-none focus:border-emerald-500 transition font-medium text-emerald-700"
                            />
                        </div>
                    </div>

                    {selectedRowId && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between mt-6">
                                <h4 className="font-bold text-slate-700">Chi tiết vật tư</h4>
                                <button onClick={handleFillAll} className="px-3 py-1.5 bg-blue-50 text-blue-600 text-sm font-bold rounded-lg hover:bg-blue-100 transition">
                                    Điền nhanh bằng số cần nhận thêm
                                </button>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {columns.map(col => {
                                    if (!remaining[col.id]?.yeuCau && !formData[col.id]) return null;

                                    return (
                                        <div key={col.id} className="p-3 border border-slate-200 rounded-lg bg-slate-50 flex flex-col gap-2">
                                            <div className="font-bold text-sm text-slate-700 truncate" title={col.name}>{col.name}</div>
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1">
                                                    <span className="text-xs text-slate-500 block mb-1">Cần nhận thêm</span>
                                                    <div className="font-bold text-slate-700 p-2 bg-white rounded border border-slate-200 text-center">{remaining[col.id]?.chuaNhan || 0}</div>
                                                </div>
                                                <div className="flex-1">
                                                    <span className="text-xs text-slate-500 block mb-1">Thực nhận đợt này</span>
                                                    <input 
                                                        type="text"
                                                        value={formData[col.id] || ''}
                                                        onChange={(e) => setFormData({...formData, [col.id]: e.target.value})}
                                                        className="w-full p-2 outline-none font-bold text-rose-600 bg-white border-2 border-slate-200 focus:border-rose-400 rounded text-center"
                                                        placeholder="Nhập SL..."
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {columns.every(col => !remaining[col.id]?.yeuCau && !formData[col.id]) && (
                                    <div className="col-span-1 md:col-span-2 text-center p-4 text-slate-500 italic border border-dashed border-slate-300 rounded-lg">
                                        Đợt PO này không có vật tư nào được yêu cầu.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/50 rounded-b-2xl">
                    <button onClick={onClose} className="px-5 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition">
                        Hủy
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={!selectedRowId}
                        className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
                    >
                        <Save size={16}/> Lưu kho
                    </button>
                </div>
            </div>
        </div>
    );
};

function getStringColor(str) {
    if (!str) return '#64748b';
    const colors = ['#0284c7', '#059669', '#7c3aed', '#ea580c', '#e11d48', '#0891b2', '#4f46e5', '#ca8a04', '#16a34a', '#2563eb'];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}
