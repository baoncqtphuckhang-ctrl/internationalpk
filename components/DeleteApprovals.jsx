import React, { useState } from 'react';
import { Trash2, Check, X, ShieldAlert, Calendar, User, FileText, Building2 } from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';

export default function DeleteApprovals({ deleteRequests = [], onApprove, onReject, isLoading, onNavigateToHistoryWithId }) {
    const [confirmState, setConfirmState] = useState({ isOpen: false, action: null, request: null });

    const getTableLabel = (req) => {
        const tableName = req.original_table;
        switch (tableName) {
            case 'transactions':
                return 'Giao dịch Chi/Thu';
            case 'incomes':
                return 'Doanh thu';
            case 'approval_requests':
                if (req.record_name?.includes('Đơn đặt hàng vật tư') || req.record_name?.includes('Đơn vật tư') || req.record_name?.includes('Đơn Vật Tư')) {
                    return 'Đơn vật tư';
                }
                return 'Phiếu DNTT';
            case 'partner_debts':
                return 'Công nợ Nhà cung cấp';
            case 'material_orders':
                return 'Đơn vật tư';
            case 'expected_invoices':
                return 'Hóa đơn dự kiến';
            case 'projects':
                return 'Dự án';
            default:
                return tableName || '-';
        }
    };

    const formatDate = (isoString) => {
        if (!isoString) return '-';
        try {
            const date = new Date(isoString);
            return date.toLocaleString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch (e) {
            return isoString;
        }
    };

    const getProjectName = (req) => {
        if (req.project_name) return req.project_name;
        const text = req.record_name || '';
        const patterns = [
            /Công trình\s+(.+?)\s+-/i,
            /công trình\s+(.+?)(?:\s+\(|\s+-|$)/i,
            /Dự kiến:\s*(.+?)\s+-/i
        ];
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match?.[1]) return match[1].trim();
        }
        return 'Chưa rõ';
    };

    const handleConfirm = () => {
        if (!confirmState.request) return;
        if (confirmState.action === 'approve') {
            onApprove(confirmState.request);
        } else if (confirmState.action === 'reject') {
            onReject(confirmState.request);
        }
        setConfirmState({ isOpen: false, action: null, request: null });
    };

    return (
        <div className="w-full max-w-none mx-auto my-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-md border border-slate-200/80 overflow-hidden">
                <div className="px-6 py-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20">
                            <ShieldAlert size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black tracking-tight">Duyệt Yêu Cầu Xóa Dữ Liệu</h2>
                            <p className="text-xs text-slate-400 mt-1">
                                Xem xét, xác nhận hoặc từ chối các yêu cầu xóa của nhân viên.
                            </p>
                        </div>
                    </div>
                    <div className="px-3 py-1.5 bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-black rounded-full">
                        {deleteRequests.length} đang chờ
                    </div>
                </div>

                <div className="p-5">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-14 text-slate-400 gap-3">
                            <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-800 rounded-full animate-spin" />
                            <span className="text-sm font-semibold">Đang xử lý dữ liệu...</span>
                        </div>
                    ) : deleteRequests.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="p-4 bg-slate-50 text-slate-400 rounded-full mb-3">
                                <Trash2 size={36} />
                            </div>
                            <h3 className="text-base font-bold text-slate-700">Không có yêu cầu nào</h3>
                            <p className="text-xs text-slate-400 max-w-xs mt-1">
                                Các yêu cầu xóa đã được xử lý hoặc chưa có yêu cầu mới.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full min-w-[1180px] border-collapse text-left">
                                <thead>
                                    <tr className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                        <th className="py-3 px-4 w-14 text-center">STT</th>
                                        <th className="py-3 px-4 w-44">Loại dữ liệu</th>
                                        <th className="py-3 px-4 w-56">Tên công trình</th>
                                        <th className="py-3 px-4 min-w-[320px]">Nội dung đề nghị xóa</th>
                                        <th className="py-3 px-4 w-44">Người đề nghị</th>
                                        <th className="py-3 px-4 min-w-[220px]">Lý do xóa</th>
                                        <th className="py-3 px-4 w-44">Thời gian gửi</th>
                                        <th className="py-3 px-4 text-center w-28">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {deleteRequests.map((req, index) => (
                                        <tr 
                                            key={req.id} 
                                            onDoubleClick={() => {
                                                if (onNavigateToHistoryWithId) {
                                                    onNavigateToHistoryWithId(req.record_id, getProjectName(req), req.original_table);
                                                }
                                            }}
                                            className="hover:bg-slate-50/80 transition cursor-pointer select-none"
                                            title="Đúp chuột để đi đến Chi tiết chi công trình và làm nổi bật dòng giao dịch này"
                                        >
                                            <td className="py-4 px-4 text-center font-bold text-slate-400">{index + 1}</td>
                                            <td className="py-4 px-4 font-bold">
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                                                    {getTableLabel(req)}
                                                </span>
                                            </td>
                                            <td className="py-4 px-4 font-black text-slate-800">
                                                <div className="flex gap-2 items-start">
                                                    <Building2 size={15} className="text-slate-400 mt-0.5 flex-shrink-0" />
                                                    <span className="break-words">{getProjectName(req)}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4 font-semibold text-slate-800 break-words">
                                                <div className="flex gap-2 items-start">
                                                    <FileText size={16} className="text-slate-400 mt-0.5 flex-shrink-0" />
                                                    <span>{req.record_name}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4 text-slate-600 font-medium">
                                                <div className="flex gap-1.5 items-center">
                                                    <User size={14} className="text-slate-400" />
                                                    <span>{req.requested_by}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4 text-rose-600 font-bold break-words">
                                                {req.reason || 'Không có lý do'}
                                            </td>
                                            <td className="py-4 px-4 text-slate-500 font-medium whitespace-nowrap">
                                                <div className="flex gap-1.5 items-center">
                                                    <Calendar size={14} className="text-slate-400" />
                                                    <span>{formatDate(req.created_at)}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => setConfirmState({ isOpen: true, action: 'approve', request: req })}
                                                        className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg transition border border-emerald-100"
                                                        title="Phê duyệt xóa"
                                                    >
                                                        <Check size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => setConfirmState({ isOpen: true, action: 'reject', request: req })}
                                                        className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition border border-rose-100"
                                                        title="Từ chối yêu cầu"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <ConfirmModal
                isOpen={confirmState.isOpen}
                title={confirmState.action === 'approve' ? 'Phê duyệt xóa dữ liệu' : 'Từ chối yêu cầu xóa'}
                message={
                    confirmState.action === 'approve'
                        ? 'Bạn có chắc chắn muốn phê duyệt xóa dữ liệu này? Dữ liệu sẽ được chuyển vào thùng rác theo đúng thời hạn lưu.'
                        : 'Bạn có chắc chắn muốn từ chối yêu cầu này và giữ lại dữ liệu?'
                }
                type={confirmState.action === 'approve' ? 'danger' : 'warning'}
                confirmText={confirmState.action === 'approve' ? 'Phê duyệt xóa' : 'Từ chối'}
                onConfirm={handleConfirm}
                onCancel={() => setConfirmState({ isOpen: false, action: null, request: null })}
            />
        </div>
    );
}
