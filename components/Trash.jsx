import React, { useState, useEffect, useMemo } from 'react';
import { Trash2, RotateCcw, AlertCircle, CheckSquare, Square, Filter, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDateVN } from '@/lib/utils';
import ConfirmModal from '@/components/ConfirmModal';

const TRASH_RETENTION_DAYS = 90;

export default function Trash({ onRestore, isLoading, setIsLoading, showToast }) {
    const [trashItems, setTrashItems] = useState([]);
    const [confirmState, setConfirmState] = useState({ isOpen: false, item: null, action: '', title: '', message: '', requirePassword: false });
    const [selectedIds, setSelectedIds] = useState([]);
    const [filters, setFilters] = useState({ type: '', date: '' });

    const getTableName = (itemOrTable) => {
        const table = typeof itemOrTable === 'object' ? itemOrTable.original_table : itemOrTable;
        const map = {
            'approval_requests': 'Phiếu phê duyệt',
            'material_orders': 'Đơn đặt hàng vật tư',
            'incomes': 'Giao dịch thu',
            'transactions': 'Giao dịch chi',
            'projects': 'Công trình',
            'partner_debts': 'Công nợ đối tác',
            'customer_debts': 'Công nợ khách hàng',
            'material_warehouse': 'Kho vật tư',
            'users': 'Tài khoản nhân sự',
            'expected_invoices': 'Hóa đơn dự kiến'
        };
        if (typeof itemOrTable === 'object' && table === 'approval_requests') {
            try {
                const data = typeof itemOrTable.record_data === 'string' ? JSON.parse(itemOrTable.record_data) : itemOrTable.record_data;
                if (data?.doc_type === 'Đơn Vật Tư') {
                    return 'Đơn đặt hàng vật tư';
                }
            } catch(e) {}
        }
        return map[table] || table;
    };

    const getLocalTrash = () => {
        try {
            const saved = localStorage.getItem('system_trash_bin');
            return saved ? JSON.parse(saved) : [];
        } catch(e) {
            return [];
        }
    };

    const pruneExpiredTrash = (items) => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - TRASH_RETENTION_DAYS);
        return (items || []).filter(item => !item.deleted_at || new Date(item.deleted_at) >= cutoffDate);
    };

    const mergeTrashItems = (serverItems = [], localItems = []) => {
        const byKey = new Map();
        [...serverItems, ...localItems].forEach(item => {
            if (!item) return;
            let recordId = '';
            try {
                const data = typeof item.record_data === 'string' ? JSON.parse(item.record_data) : item.record_data;
                recordId = data?.id || '';
            } catch(e) {}
            const key = `${item.original_table || ''}::${recordId || item.id || ''}`;
            if (!byKey.has(key)) byKey.set(key, item);
        });
        return Array.from(byKey.values()).sort((a, b) => new Date(b.deleted_at || 0) - new Date(a.deleted_at || 0));
    };

    const getDaysRemaining = (deletedAt) => {
        if (!deletedAt) return TRASH_RETENTION_DAYS;
        const deletedDate = new Date(deletedAt);
        if (Number.isNaN(deletedDate.getTime())) return TRASH_RETENTION_DAYS;
        const expiresAt = new Date(deletedDate);
        expiresAt.setDate(expiresAt.getDate() + TRASH_RETENTION_DAYS);
        return Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    };

    const getTrashItemKey = (item) => String(item?.id || '');

    const getDeletedDateKey = (deletedAt) => {
        if (!deletedAt) return '';
        const date = new Date(deletedAt);
        if (Number.isNaN(date.getTime())) return '';
        return date.toISOString().slice(0, 10);
    };

    const availableTypes = useMemo(() => {
        return [...new Set(trashItems.map(item => item.original_table).filter(Boolean))].sort();
    }, [trashItems]);

    const filteredTrashItems = useMemo(() => {
        return trashItems.filter(item => {
            if (filters.type && item.original_table !== filters.type) return false;
            if (filters.date && getDeletedDateKey(item.deleted_at) !== filters.date) return false;
            return true;
        });
    }, [trashItems, filters]);

    const visibleIds = filteredTrashItems.map(getTrashItemKey);
    const selectedItems = trashItems.filter(item => selectedIds.includes(getTrashItemKey(item)));
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));

    const toggleSelectItem = (item) => {
        const key = getTrashItemKey(item);
        setSelectedIds(prev => prev.includes(key) ? prev.filter(id => id !== key) : [...prev, key]);
    };

    const toggleSelectVisible = () => {
        setSelectedIds(prev => {
            if (allVisibleSelected) return prev.filter(id => !visibleIds.includes(id));
            return [...new Set([...prev, ...visibleIds])];
        });
    };

    const renderContent = (item) => {
        try {
            const data = typeof item.record_data === 'string' ? JSON.parse(item.record_data) : item.record_data;
            if (!data) return '';

            let content = [];
            
            if (data.project_name || data.project || data.name) {
                content.push(<div key="1"><b>Công trình:</b> {data.project_name || data.project || data.name}</div>);
            }
            if (data.doc_type || data.type || data.category) {
                content.push(<div key="2"><b>Loại:</b> {data.doc_type || data.type || data.category}</div>);
            }
            if (data.recipient || data.partner_name || data.customer_name || data.username) {
                content.push(<div key="3"><b>Đối tượng:</b> {data.recipient || data.partner_name || data.customer_name || data.username}</div>);
            }
            if (data.amount || data.total_amount || data.debt_amount) {
                const amt = data.amount || data.total_amount || data.debt_amount;
                content.push(<div key="4"><b>Số tiền:</b> {formatCurrency(amt)}</div>);
            }
            if (data.reason || data.note) {
                let noteText = data.reason || data.note;
                try {
                    const parsed = JSON.parse(noteText);
                    if (parsed && typeof parsed === 'object') {
                        let lines = [];
                        if (parsed.reason) lines.push(parsed.reason);
                        if (parsed.invoice_no) lines.push(`Số HĐ: ${parsed.invoice_no}`);
                        if (parsed.description) lines.push(`Mô tả: ${parsed.description}`);
                        if (parsed.items) lines.push(`Vật tư: ${parsed.items.length} mục`);
                        if (parsed.actual_received_amount) lines.push(`Thực nhận: ${formatCurrency(parsed.actual_received_amount)}`);
                        noteText = lines.length > 0 ? lines.join(' - ') : JSON.stringify(parsed);
                    }
                } catch(e) {}
                content.push(<div key="5"><b>Nội dung:</b> {typeof noteText === 'object' ? JSON.stringify(noteText) : String(noteText)}</div>);
            }

            if (content.length > 0) {
                return <div className="flex flex-col gap-1 text-slate-600">{content}</div>;
            }
            return JSON.stringify(data).substring(0, 100) + '...';
        } catch (e) {
            return String(item.record_data);
        }
    };

    const getRequesterName = (item) => {
        if (item?.requested_by) return item.requested_by;
        try {
            const data = typeof item.record_data === 'string' ? JSON.parse(item.record_data) : item.record_data;
            return data?.requested_by || data?.created_by || data?.deleted_by || '';
        } catch (e) {
            return item?.requested_by || '';
        }
    };

    useEffect(() => {
        fetchTrash();
    }, []);

    const fetchTrash = async () => {
        try {
            const { data, error } = await supabase.from('trash_bin').select('*').order('deleted_at', { ascending: false });
            if (error) throw error;
            let fetchedData = data || [];
            
            // Auto-delete after the configured retention window.
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - TRASH_RETENTION_DAYS);
            
            const toDelete = fetchedData.filter(item => new Date(item.deleted_at) < cutoffDate);
            if (toDelete.length > 0) {
                for (let d of toDelete) {
                    try { await supabase.from('trash_bin').delete().eq('id', d.id); } catch(e) {}
                }
                fetchedData = fetchedData.filter(item => new Date(item.deleted_at) >= cutoffDate);
            }

            const localData = pruneExpiredTrash(getLocalTrash());
            localStorage.setItem('system_trash_bin', JSON.stringify(localData));
            
            setTrashItems(mergeTrashItems(fetchedData, localData));
        } catch (error) {
            console.warn('Lỗi lấy dữ liệu từ bảng trash_bin, fallback sang localStorage.', error);
            const parsed = pruneExpiredTrash(getLocalTrash());
            setTrashItems(parsed);
            localStorage.setItem('system_trash_bin', JSON.stringify(parsed));
        }
    };

    const handleRestore = async (item) => {
        setIsLoading(true);
        try {
            // Restore logic based on table_name
            const parsedData = typeof item.record_data === 'string' ? JSON.parse(item.record_data) : item.record_data;
            
            const { error: insertError } = await supabase.from(item.original_table).insert([parsedData]);
            if (insertError) throw insertError;

            // Xóa khỏi trash
            if (!item.id?.toString().startsWith('local_')) {
                try {
                    await supabase.from('trash_bin').delete().eq('id', item.id);
                } catch(e) {}
            }

            // Xóa khỏi local nếu dùng local
            const newTrash = trashItems.filter(t => t.id !== item.id);
            setTrashItems(newTrash);
            localStorage.setItem('system_trash_bin', JSON.stringify(newTrash));

            showToast(`Khôi phục thành công dữ liệu bảng ${item.original_table}!`);
            if (onRestore) {
                onRestore({
                    table: item.original_table,
                    id: parsedData.id,
                    project_name: parsedData.project_name || parsedData.project || parsedData.name
                });
            }
        } catch (error) {
            console.error(error);
            showToast('Lỗi khi khôi phục dữ liệu!', 'error');
        } finally {
            setIsLoading(false);
            setConfirmState({ ...confirmState, isOpen: false });
        }
    };

    const handleEmptyTrash = async (pwd) => {
        if (pwd !== '0000') {
            alert('Mật khẩu không đúng!');
            return;
        }
        setIsLoading(true);
        try {
            await supabase.from('trash_bin').delete().neq('id', '0'); // Delete all
            setTrashItems([]);
            localStorage.removeItem('system_trash_bin');
            showToast('Đã làm sạch thùng rác!');
        } catch (error) {
            console.error(error);
            setTrashItems([]);
            localStorage.removeItem('system_trash_bin');
            showToast('Đã làm sạch thùng rác (Local)!');
        } finally {
            setIsLoading(false);
            setConfirmState({ ...confirmState, isOpen: false });
        }
    };

    const handleDelete = async (item) => {
        setIsLoading(true);
        try {
            if (!item.id?.toString().startsWith('local_')) {
                await supabase.from('trash_bin').delete().eq('id', item.id);
            }
            const newTrash = trashItems.filter(t => t.id !== item.id);
            setTrashItems(newTrash);
            localStorage.setItem('system_trash_bin', JSON.stringify(newTrash));
            showToast('Đã xóa vĩnh viễn dữ liệu!');
        } catch (error) {
            console.error(error);
            showToast('Lỗi khi xóa dữ liệu!', 'error');
        } finally {
            setIsLoading(false);
            setConfirmState({ ...confirmState, isOpen: false });
        }
    };

    const handleDeleteMany = async (items = []) => {
        if (!items.length) {
            setConfirmState({ ...confirmState, isOpen: false });
            return;
        }

        setIsLoading(true);
        try {
            const serverItems = items.filter(item => !item.id?.toString().startsWith('local_'));
            for (const item of serverItems) {
                try {
                    await supabase.from('trash_bin').delete().eq('id', item.id);
                } catch(e) {}
            }

            const idsToRemove = new Set(items.map(getTrashItemKey));
            const newTrash = trashItems.filter(item => !idsToRemove.has(getTrashItemKey(item)));
            setTrashItems(newTrash);
            setSelectedIds(prev => prev.filter(id => !idsToRemove.has(id)));
            localStorage.setItem('system_trash_bin', JSON.stringify(newTrash.filter(item => item.id?.toString().startsWith('local_'))));
            showToast(`Đã xóa vĩnh viễn ${items.length} mục trong thùng rác!`);
        } catch (error) {
            console.error(error);
            showToast('Lỗi khi xóa dữ liệu theo cụm!', 'error');
        } finally {
            setIsLoading(false);
            setConfirmState({ ...confirmState, isOpen: false });
        }
    };

    return (
        <div className="w-full animate-in fade-in duration-500 font-sans">
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Trash2 className="text-red-500" /> Thùng Rác
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Nơi lưu trữ và khôi phục các dữ liệu đã bị xóa.</p>
                </div>
                {trashItems.length > 0 && (
                    <button onClick={() => setConfirmState({
                        isOpen: true,
                        action: 'empty',
                        title: 'Làm sạch thùng rác',
                        message: 'Tất cả dữ liệu trong thùng rác sẽ bị xóa vĩnh viễn. Nhập mật khẩu để tiếp tục:',
                        requirePassword: true
                    })} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl font-bold transition flex items-center gap-2 shadow-sm">
                        <AlertCircle size={18} /> Làm sạch thùng rác
                    </button>
                )}
            </header>

            {trashItems.length > 0 && (
                <div className="mb-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-3">
                            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                                <Filter size={16} className="text-slate-400" />
                                <select
                                    value={filters.type}
                                    onChange={(e) => {
                                        setFilters(prev => ({ ...prev, type: e.target.value }));
                                        setSelectedIds([]);
                                    }}
                                    className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none"
                                >
                                    <option value="">Tất cả loại dữ liệu</option>
                                    {availableTypes.map(type => (
                                        <option key={type} value={type}>{getTableName(type)}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                                <input
                                    type="date"
                                    value={filters.date}
                                    onChange={(e) => {
                                        setFilters(prev => ({ ...prev, date: e.target.value }));
                                        setSelectedIds([]);
                                    }}
                                    className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none"
                                    title="Lọc theo ngày xóa"
                                />
                            </label>
                            <button
                                type="button"
                                onClick={() => {
                                    setFilters({ type: '', date: '' });
                                    setSelectedIds([]);
                                }}
                                className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-600 hover:bg-slate-100"
                            >
                                <XCircle size={16} /> Xóa lọc
                            </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                                Đang hiển thị {filteredTrashItems.length}/{trashItems.length} mục
                            </span>
                            <button
                                type="button"
                                disabled={selectedItems.length === 0}
                                onClick={() => setConfirmState({
                                    isOpen: true,
                                    action: 'deleteMany',
                                    items: selectedItems,
                                    title: 'Xóa các mục đã chọn',
                                    message: `Bạn có chắc chắn muốn xóa vĩnh viễn ${selectedItems.length} mục đã chọn không?`,
                                    requirePassword: false
                                })}
                                className={`rounded-xl px-3 py-2 text-xs font-black transition ${selectedItems.length === 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                            >
                                Xóa đã chọn ({selectedItems.length})
                            </button>
                            <button
                                type="button"
                                disabled={filteredTrashItems.length === 0}
                                onClick={() => setConfirmState({
                                    isOpen: true,
                                    action: 'deleteMany',
                                    items: filteredTrashItems,
                                    title: 'Xóa theo bộ lọc',
                                    message: `Bạn có chắc chắn muốn xóa vĩnh viễn ${filteredTrashItems.length} mục đang được lọc không?`,
                                    requirePassword: false
                                })}
                                className={`rounded-xl px-3 py-2 text-xs font-black transition ${filteredTrashItems.length === 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-rose-600 text-white hover:bg-rose-700'}`}
                            >
                                Xóa theo lọc
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1040px]">
                        <thead>
                            <tr className="bg-slate-900 text-white border-b border-slate-200">
                                <th className="p-4 text-center w-12">
                                    <button
                                        type="button"
                                        onClick={toggleSelectVisible}
                                        className="inline-flex text-white/80 hover:text-white"
                                        title={allVisibleSelected ? 'Bỏ chọn các mục đang hiển thị' : 'Chọn các mục đang hiển thị'}
                                    >
                                        {allVisibleSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                                    </button>
                                </th>
                                <th className="p-4 font-black uppercase text-xs tracking-wider">Thời gian xóa</th>
                                <th className="p-4 font-black uppercase text-xs tracking-wider text-center">Còn lại</th>
                                <th className="p-4 font-black uppercase text-xs tracking-wider">Người xóa</th>
                                <th className="p-4 font-black uppercase text-xs tracking-wider">Người đề nghị</th>
                                <th className="p-4 font-black uppercase text-xs tracking-wider">Loại dữ liệu</th>
                                <th className="p-4 font-black uppercase text-xs tracking-wider">Nội dung</th>
                                <th className="p-4 font-black uppercase text-xs tracking-wider text-center w-32">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredTrashItems.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="p-8 text-center text-slate-500">{trashItems.length === 0 ? 'Thùng rác trống.' : 'Không có mục nào khớp bộ lọc.'}</td>
                                </tr>
                            ) : (
                                filteredTrashItems.map(item => {
                                    const daysRemaining = getDaysRemaining(item.deleted_at);
                                    const itemKey = getTrashItemKey(item);
                                    const isSelected = selectedIds.includes(itemKey);
                                    return (
                                        <tr key={item.id} className={`hover:bg-slate-50 transition ${isSelected ? 'bg-blue-50/60' : ''}`}>
                                            <td className="p-4 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleSelectItem(item)}
                                                    className={`${isSelected ? 'text-blue-600' : 'text-slate-400 hover:text-blue-600'}`}
                                                    title={isSelected ? 'Bỏ chọn' : 'Chọn mục này'}
                                                >
                                                    {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                                                </button>
                                            </td>
                                            <td className="p-4 text-sm text-slate-600">{formatDateVN(item.deleted_at)}</td>
                                            <td className="p-4 text-center">
                                                <span className={`inline-flex min-w-20 justify-center rounded-full px-3 py-1 text-xs font-black border ${
                                                    daysRemaining <= 3
                                                        ? 'bg-red-50 text-red-600 border-red-100'
                                                        : daysRemaining <= 7
                                                        ? 'bg-amber-50 text-amber-700 border-amber-100'
                                                        : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                }`}>
                                                    {daysRemaining} ngày
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm font-bold text-slate-800">{item.deleted_by}</td>
                                            <td className="p-4 text-sm font-medium text-slate-700">{getRequesterName(item) || '-'}</td>
                                            <td className="p-4 text-sm font-medium text-slate-600">{getTableName(item)}</td>
                                            <td className="p-4 text-sm text-slate-500 max-w-sm">
                                                {renderContent(item)}
                                            </td>
                                            <td className="p-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button 
                                                        onClick={() => setConfirmState({ 
                                                            isOpen: true, 
                                                            item,
                                                            action: 'restore',
                                                            title: 'Khôi phục dữ liệu',
                                                            message: 'Bạn có chắc chắn muốn khôi phục dữ liệu này về vị trí ban đầu?',
                                                            requirePassword: false
                                                        })}
                                                        className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 p-2 rounded-lg transition font-bold text-xs flex items-center gap-1"
                                                        title="Khôi phục"
                                                    >
                                                        <RotateCcw size={14} /> Khôi phục
                                                    </button>
                                                    <button 
                                                        onClick={() => setConfirmState({ 
                                                            isOpen: true, 
                                                            item,
                                                            action: 'delete',
                                                            title: 'Xóa vĩnh viễn',
                                                            message: 'Bạn có chắc chắn muốn xóa vĩnh viễn dữ liệu này? Hành động này không thể hoàn tác.',
                                                            requirePassword: false
                                                        })}
                                                        className="bg-red-100 hover:bg-red-200 text-red-700 p-2 rounded-lg transition font-bold text-xs flex items-center gap-1"
                                                        title="Xóa vĩnh viễn"
                                                    >
                                                        <Trash2 size={14} /> Xóa
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <ConfirmModal
                isOpen={confirmState.isOpen}
                title={confirmState.title || "Khác"}
                message={confirmState.message || ""}
                requirePassword={confirmState.requirePassword}
                confirmText={confirmState.action === 'empty' ? 'Xóa sạch' : (confirmState.action === 'delete' || confirmState.action === 'deleteMany') ? 'Xóa vĩnh viễn' : 'Khôi phục'}
                onConfirm={(pwd) => {
                    if (confirmState.action === 'empty') {
                        handleEmptyTrash(pwd);
                    } else if (confirmState.action === 'deleteMany') {
                        handleDeleteMany(confirmState.items || []);
                    } else if (confirmState.action === 'delete') {
                        handleDelete(confirmState.item);
                    } else {
                        handleRestore(confirmState.item);
                    }
                }}
                onCancel={() => setConfirmState({ ...confirmState, isOpen: false })}
            />
        </div>
    );
}
