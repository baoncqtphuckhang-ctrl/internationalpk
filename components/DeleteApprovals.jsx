import React from 'react';
import { Trash2, Check, X, ShieldAlert, Calendar, User, FileText } from 'lucide-react';

export default function DeleteApprovals({ deleteRequests = [], onApprove, onReject, isLoading }) {
    
    const getTableLabel = (tableName) => {
        switch (tableName) {
            case 'transactions':
                return 'Giao dịch Chi/Thu';
            case 'incomes':
                return 'Doanh thu';
            case 'approval_requests':
                return 'Phiếu DNTT';
            case 'partner_debts':
                return 'Công nợ Nhà cung cấp';
            case 'material_orders':
                return 'Đơn vật tư';
            case 'projects':
                return 'Dự án';
            default:
                return tableName;
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

    return (
        <div className="bg-white rounded-xl shadow-md border border-slate-200/80 overflow-hidden max-w-7xl mx-auto my-6">
            {/* Header */}
            <div className="p-6 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-500/10 text-red-400 rounded-lg">
                        <ShieldAlert size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold tracking-tight">Duyệt Yêu Cầu Xóa Dữ Liệu</h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Xem xét và phê duyệt các yêu cầu xóa dữ liệu của nhân viên.
                        </p>
                    </div>
                </div>
                <div className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold rounded-full">
                    {deleteRequests.length} Đang chờ
                </div>
            </div>

            {/* Content */}
            <div className="p-6">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
                        <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-800 rounded-full animate-spin"></div>
                        <span className="text-sm font-semibold">Đang xử lý dữ liệu...</span>
                    </div>
                ) : deleteRequests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="p-4 bg-slate-50 text-slate-400 rounded-full mb-3">
                            <Trash2 size={36} />
                        </div>
                        <h3 className="text-base font-bold text-slate-700">Không có yêu cầu nào</h3>
                        <p className="text-xs text-slate-400 max-w-xs mt-1">
                            Tất cả các yêu cầu xóa dữ liệu đã được giải quyết hoặc chưa có yêu cầu nào mới.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-100">
                        <table className="w-full border-collapse text-left">
                            <thead>
                                <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/60">
                                    <th className="py-3 px-4 w-12 text-center">STT</th>
                                    <th className="py-3 px-4">Loại dữ liệu</th>
                                    <th className="py-3 px-4">Nội dung đề nghị xóa</th>
                                    <th className="py-3 px-4">Người đề nghị</th>
                                    <th className="py-3 px-4">Lý do xóa</th>
                                    <th className="py-3 px-4">Thời gian gửi</th>
                                    <th className="py-3 px-4 text-center w-28">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {deleteRequests.map((req, index) => (
                                    <tr key={req.id} className="hover:bg-slate-50/50 transition">
                                        <td className="py-4 px-4 text-center font-semibold text-slate-400">
                                            {index + 1}
                                        </td>
                                        <td className="py-4 px-4 font-bold">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                                                {getTableLabel(req.original_table)}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 font-semibold text-slate-800 max-w-xs break-words">
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
                                        <td className="py-4 px-4 text-rose-600 font-medium max-w-xs break-words">
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
                                                    onClick={() => {
                                                        if (window.confirm('Bạn có chắc chắn muốn phê duyệt XÓA vĩnh viễn dữ liệu này?')) {
                                                            onApprove(req);
                                                        }
                                                    }}
                                                    className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg transition duration-150"
                                                    title="Phê duyệt Xóa"
                                                >
                                                    <Check size={16} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (window.confirm('Từ chối yêu cầu và giữ lại dữ liệu này?')) {
                                                            onReject(req);
                                                        }
                                                    }}
                                                    className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition duration-150"
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
    );
}
