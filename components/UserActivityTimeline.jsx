import React, { useMemo, useState } from 'react';
import { Activity, CalendarDays, Clock3, Filter, Search, UserRound } from 'lucide-react';

const toDateInputValue = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
};

const toMinutes = (timeValue) => {
    if (!timeValue) return null;
    const [hours, minutes] = timeValue.split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    return hours * 60 + minutes;
};

const getActionTone = (action = '') => {
    const lower = action.toLowerCase();
    if (lower.includes('xóa') || lower.includes('xoá')) return 'bg-red-50 text-red-700 border-red-100';
    if (lower.includes('duyệt') || lower.includes('hạch toán')) return 'bg-blue-50 text-blue-700 border-blue-100';
    if (lower.includes('thêm') || lower.includes('tạo')) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    if (lower.includes('sửa') || lower.includes('cập nhật')) return 'bg-amber-50 text-amber-700 border-amber-100';
    return 'bg-slate-50 text-slate-700 border-slate-100';
};

export default function UserActivityTimeline({ activityLogs = [], usersList = [] }) {
    const [filters, setFilters] = useState({
        username: '',
        dateFrom: '',
        dateTo: '',
        timeFrom: '',
        timeTo: '',
        keyword: ''
    });

    const filteredLogs = useMemo(() => {
        const keyword = filters.keyword.trim().toLowerCase();
        const fromDate = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null;
        const toDate = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`) : null;
        const fromMinutes = toMinutes(filters.timeFrom);
        const toMinutesValue = toMinutes(filters.timeTo);

        return (activityLogs || []).filter(log => {
            const createdAt = new Date(log.created_at);
            if (Number.isNaN(createdAt.getTime())) return false;
            if (filters.username && log.username !== filters.username) return false;
            if (fromDate && createdAt < fromDate) return false;
            if (toDate && createdAt > toDate) return false;

            const logMinutes = createdAt.getHours() * 60 + createdAt.getMinutes();
            if (fromMinutes !== null && logMinutes < fromMinutes) return false;
            if (toMinutesValue !== null && logMinutes > toMinutesValue) return false;

            if (!keyword) return true;
            return [
                log.username,
                log.action_type,
                log.module,
                log.description,
                log.project_name
            ].some(value => (value || '').toString().toLowerCase().includes(keyword));
        });
    }, [activityLogs, filters]);

    const groupedLogs = useMemo(() => {
        return filteredLogs.reduce((acc, log) => {
            const key = toDateInputValue(log.created_at) || 'unknown';
            if (!acc[key]) acc[key] = [];
            acc[key].push(log);
            return acc;
        }, {});
    }, [filteredLogs]);

    const updateFilter = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="space-y-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                    <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
                        <Activity size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-900">Lịch sử hoạt động toàn bộ user</h3>
                        <p className="text-sm font-medium text-slate-500">Timeline transcript các thao tác đã ghi nhận trong hệ thống.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
                    <div className="relative xl:col-span-2">
                        <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
                        <input
                            type="text"
                            value={filters.keyword}
                            onChange={(e) => updateFilter('keyword', e.target.value)}
                            placeholder="Tìm theo nội dung, module, công trình..."
                            className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 py-3 pl-10 pr-3 text-sm font-bold outline-none transition focus:border-indigo-500 focus:bg-white"
                        />
                    </div>
                    <select
                        value={filters.username}
                        onChange={(e) => updateFilter('username', e.target.value)}
                        className="rounded-2xl border-2 border-slate-100 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-indigo-500 focus:bg-white"
                    >
                        <option value="">Tất cả user</option>
                        {usersList.map(user => (
                            <option key={user.id || user.username} value={user.username}>{user.name || user.username} (@{user.username})</option>
                        ))}
                    </select>
                    <input
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) => updateFilter('dateFrom', e.target.value)}
                        className="rounded-2xl border-2 border-slate-100 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-indigo-500 focus:bg-white"
                        title="Từ ngày"
                    />
                    <input
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => updateFilter('dateTo', e.target.value)}
                        className="rounded-2xl border-2 border-slate-100 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-indigo-500 focus:bg-white"
                        title="Đến ngày"
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <input
                            type="time"
                            value={filters.timeFrom}
                            onChange={(e) => updateFilter('timeFrom', e.target.value)}
                            className="rounded-2xl border-2 border-slate-100 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-indigo-500 focus:bg-white"
                            title="Từ giờ"
                        />
                        <input
                            type="time"
                            value={filters.timeTo}
                            onChange={(e) => updateFilter('timeTo', e.target.value)}
                            className="rounded-2xl border-2 border-slate-100 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-indigo-500 focus:bg-white"
                            title="Đến giờ"
                        />
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                    <Filter size={15} />
                    <span>{filteredLogs.length} hoạt động phù hợp</span>
                    {(filters.keyword || filters.username || filters.dateFrom || filters.dateTo || filters.timeFrom || filters.timeTo) && (
                        <button
                            type="button"
                            onClick={() => setFilters({ username: '', dateFrom: '', dateTo: '', timeFrom: '', timeTo: '', keyword: '' })}
                            className="rounded-full bg-slate-100 px-3 py-1 text-slate-600 hover:bg-slate-200"
                        >
                            Xóa bộ lọc
                        </button>
                    )}
                </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                {filteredLogs.length === 0 ? (
                    <div className="py-16 text-center">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                            <Activity size={28} />
                        </div>
                        <p className="font-black text-slate-700">Chưa có hoạt động phù hợp.</p>
                        <p className="mt-1 text-sm text-slate-500">Thử đổi khoảng ngày, giờ hoặc bỏ bớt từ khóa lọc.</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {Object.entries(groupedLogs).map(([dateKey, logs]) => (
                            <section key={dateKey}>
                                <div className="mb-4 flex items-center gap-2 text-sm font-black text-slate-900">
                                    <CalendarDays size={18} className="text-indigo-600" />
                                    {new Date(`${dateKey}T00:00:00`).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">{logs.length} mục</span>
                                </div>
                                <div className="relative ml-4 border-l-2 border-indigo-100">
                                    {logs.map(log => {
                                        const logDate = new Date(log.created_at);
                                        return (
                                            <article key={log.id || `${log.username}-${log.created_at}-${log.description}`} className="relative pb-5 pl-8">
                                                <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full border-4 border-white bg-indigo-500 shadow-sm" />
                                                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 hover:border-indigo-100 hover:bg-white hover:shadow-sm">
                                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                                        <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${getActionTone(log.action_type)}`}>{log.action_type || 'Hoạt động'}</span>
                                                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">{log.module || 'Hệ thống'}</span>
                                                        <span className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-slate-500">
                                                            <Clock3 size={14} />
                                                            {logDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm font-bold leading-6 text-slate-800">{log.description || 'Không có mô tả chi tiết.'}</p>
                                                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                                                        <span className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 ring-1 ring-slate-200">
                                                            <UserRound size={13} />
                                                            @{log.username || 'unknown'}
                                                        </span>
                                                        {log.project_name && (
                                                            <span className="rounded-lg bg-indigo-50 px-2 py-1 text-indigo-700">Công trình: {log.project_name}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
