import React from 'react';
import { X, Clock, Activity, FileText, DollarSign, Briefcase, PlusCircle, Edit, Trash2, CheckCircle } from 'lucide-react';

export default function UserWorkHistoryModal({ isOpen, onClose, user, activityLogs }) {
    if (!isOpen || !user) return null;

    const userLogs = (activityLogs || []).filter(log => log.username === user.username);

    const getIconForAction = (action) => {
        const a = action.toLowerCase();
        if (a.includes('thêm')) return PlusCircle;
        if (a.includes('sửa') || a.includes('cập nhật')) return Edit;
        if (a.includes('xóa')) return Trash2;
        if (a.includes('duyệt') || a.includes('hạch toán')) return CheckCircle;
        return Activity;
    };

    const getColorForAction = (action) => {
        const a = action.toLowerCase();
        if (a.includes('thêm')) return 'text-emerald-500 bg-emerald-50';
        if (a.includes('sửa') || a.includes('cập nhật')) return 'text-amber-500 bg-amber-50';
        if (a.includes('xóa')) return 'text-red-500 bg-red-50';
        if (a.includes('duyệt') || a.includes('hạch toán')) return 'text-blue-500 bg-blue-50';
        return 'text-slate-500 bg-slate-100';
    };

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Clock className="text-indigo-600" />
                            Lịch sử làm việc
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            Tài khoản: <span className="font-bold text-indigo-600">@{user.username}</span> - {user.name}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition bg-white shadow-sm border border-slate-200">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 bg-white">
                    {userLogs.length === 0 ? (
                        <div className="text-center text-slate-500 py-12 flex flex-col items-center">
                            <div className="bg-slate-100 p-4 rounded-full mb-4">
                                <Activity size={32} className="text-slate-400" />
                            </div>
                            <p className="font-bold text-slate-600">Chưa có lịch sử làm việc nào được ghi nhận.</p>
                            <p className="text-sm text-slate-400 mt-1">Hệ thống chưa ghi nhận thao tác (thêm/sửa/xóa) nào của nhân viên này.</p>
                        </div>
                    ) : (
                        <div className="relative border-l-2 border-indigo-100 ml-4 space-y-6">
                            {userLogs.map((log) => {
                                const Icon = getIconForAction(log.action_type);
                                const colorClass = getColorForAction(log.action_type);
                                
                                return (
                                    <div key={log.id} className="relative pl-8">
                                        <div className={`absolute -left-4 top-1 p-2 rounded-full ${colorClass.split(' ')[1]} border-2 border-white shadow-sm`}>
                                            <Icon size={14} className={colorClass.split(' ')[0]} />
                                        </div>
                                        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 hover:shadow-md hover:border-indigo-100 transition group">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className={`font-bold text-sm px-2 py-0.5 rounded uppercase ${colorClass}`}>{log.action_type}</span>
                                                    <span className="font-bold text-slate-700 text-sm">{log.module}</span>
                                                </div>
                                                <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{new Date(log.created_at).toLocaleString('vi-VN')}</span>
                                            </div>
                                            {log.project_name && (
                                                <div className="mb-2">
                                                    <span className="inline-block px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-bold">
                                                        Công trình: {log.project_name}
                                                    </span>
                                                </div>
                                            )}
                                            <p className="text-slate-700 text-sm font-medium">{log.description}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
