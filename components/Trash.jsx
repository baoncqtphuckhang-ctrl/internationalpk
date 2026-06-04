import React, { useState, useEffect } from 'react';
import { Trash2, RotateCcw, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDateVN } from '@/lib/utils';
import ConfirmModal from '@/components/ConfirmModal';

export default function Trash({ onRestore, isLoading, setIsLoading, showToast }) {
    const [trashItems, setTrashItems] = useState([]);
    const [confirmState, setConfirmState] = useState({ isOpen: false, item: null, action: '', title: '', message: '', requirePassword: false });

    const getTableName = (table) => {
        const map = {
            'approval_requests': 'Phiếu phê duyệt',
            'material_orders': 'Đơn đặt hàng vật tư',
            'incomes': 'Giao dịch thu',
            'transactions': 'Giao dịch chi',
            'projects': 'Công trình',
            'partner_debts': 'Công nợ đối tác',
            'customer_debts': 'Công nợ khách hàng',
            'users': 'Tài khoản nhân sự',
            'expected_invoices': 'Hóa đơn dự kiến'
        };
        return map[table] || table;
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
                content.push(<div key="5"><b>Nội dung:</b> {noteText}</div>);
            }

            if (content.length > 0) {
                return <div className="flex flex-col gap-1 text-slate-600">{content}</div>;
            }
            return JSON.stringify(data).substring(0, 100) + '...';
        } catch (e) {
            return String(item.record_data);
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
            
            // Auto-delete > 60 days
            const sixtyDaysAgo = new Date();
            sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
            
            const toDelete = fetchedData.filter(item => new Date(item.deleted_at) < sixtyDaysAgo);
            if (toDelete.length > 0) {
                for (let d of toDelete) {
                    try { await supabase.from('trash_bin').delete().eq('id', d.id); } catch(e) {}
                }
                fetchedData = fetchedData.filter(item => new Date(item.deleted_at) >= sixtyDaysAgo);
            }
            
            setTrashItems(fetchedData);
        } catch (error) {
            console.warn('Lỗi lấy dữ liệu từ bảng trash_bin, fallback sang localStorage.', error);
            const saved = localStorage.getItem('system_trash_bin');
            if (saved) {
                try {
                    let parsed = JSON.parse(saved);
                    const sixtyDaysAgo = new Date();
                    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
                    parsed = parsed.filter(item => new Date(item.deleted_at) >= sixtyDaysAgo);
                    setTrashItems(parsed);
                    localStorage.setItem('system_trash_bin', JSON.stringify(parsed));
                } catch(e) {}
            }
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
            try {
                await supabase.from('trash_bin').delete().eq('id', item.id);
            } catch(e) {}

            // Xóa khỏi local nếu dùng local
            const newTrash = trashItems.filter(t => t.id !== item.id);
            setTrashItems(newTrash);
            localStorage.setItem('system_trash_bin', JSON.stringify(newTrash));

            showToast(`Khôi phục thành công dữ liệu bảng ${item.original_table}!`);
            if (onRestore) onRestore();
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
            await supabase.from('trash_bin').delete().eq('id', item.id);
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

    return (
        <div className="max-w-6xl mx-auto animate-in fade-in duration-500 font-sans">
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

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-slate-900 text-white border-b border-slate-200">
                                <th className="p-4 font-black uppercase text-xs tracking-wider">Thời gian xóa</th>
                                <th className="p-4 font-black uppercase text-xs tracking-wider">Người xóa</th>
                                <th className="p-4 font-black uppercase text-xs tracking-wider">Loại dữ liệu</th>
                                <th className="p-4 font-black uppercase text-xs tracking-wider">Nội dung</th>
                                <th className="p-4 font-black uppercase text-xs tracking-wider text-center w-32">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {trashItems.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-slate-500">Thùng rác trống.</td>
                                </tr>
                            ) : (
                                trashItems.map(item => (
                                    <tr key={item.id} className="hover:bg-slate-50 transition">
                                        <td className="p-4 text-sm text-slate-600">{formatDateVN(item.deleted_at)}</td>
                                        <td className="p-4 text-sm font-bold text-slate-800">{item.deleted_by}</td>
                                        <td className="p-4 text-sm font-medium text-slate-600">{getTableName(item.original_table)}</td>
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
                                ))
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
                confirmText={confirmState.action === 'empty' ? 'Xóa sạch' : confirmState.action === 'delete' ? 'Xóa vĩnh viễn' : 'Khôi phục'}
                onConfirm={(pwd) => {
                    if (confirmState.action === 'empty') {
                        handleEmptyTrash(pwd);
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
