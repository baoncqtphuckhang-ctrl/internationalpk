'use client';

import React, { useMemo } from 'react';
import {
    Activity,
    AlertTriangle,
    ArrowRight,
    BarChart3,
    BriefcaseBusiness,
    CheckCircle2,
    Clock3,
    Coins,
    FileSignature,
    PieChart,
    TrendingDown,
    TrendingUp,
    WalletCards
} from 'lucide-react';
import { EXPENSE_CATEGORIES, formatCurrency, formatDateVN } from '@/lib/utils';

const MONTH_LABELS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];

const getDateKey = (dateString) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return null;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const getRecentMonthKeys = (count = 6) => {
    const now = new Date();
    return Array.from({ length: count }, (_, index) => {
        const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return {
            key,
            label: `${MONTH_LABELS[date.getMonth()]}/${String(date.getFullYear()).slice(2)}`
        };
    });
};

const StatCard = ({ title, value, subtitle, icon: Icon, tone = 'blue', onClick }) => {
    const tones = {
        blue: 'from-blue-600 to-indigo-600 shadow-blue-600/20',
        green: 'from-emerald-500 to-teal-600 shadow-emerald-600/20',
        amber: 'from-amber-500 to-orange-600 shadow-amber-600/20',
        red: 'from-rose-500 to-red-600 shadow-rose-600/20',
        slate: 'from-slate-700 to-slate-900 shadow-slate-700/20'
    };

    const Component = onClick ? 'button' : 'div';

    return (
        <Component
            onClick={onClick}
            className={`text-left bg-white rounded-3xl p-5 border border-slate-200 shadow-sm hover:shadow-lg transition ${onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}
        >
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">{title}</p>
                    <p className="text-2xl xl:text-3xl font-black text-slate-900 mt-2">{value}</p>
                    <p className="text-xs font-bold text-slate-500 mt-2">{subtitle}</p>
                </div>
                <div className={`p-3 rounded-2xl bg-gradient-to-br ${tones[tone]} text-white shadow-lg shrink-0`}>
                    <Icon size={22} />
                </div>
            </div>
        </Component>
    );
};

export default function HomeDashboard({
    currentUser,
    projects,
    dashboardData,
    transactions,
    incomes,
    dnttList,
    STATUSES,
    setActiveTab,
    onProjectSelect
}) {
    const canViewFinance = currentUser?.canViewFinance !== false;

    const analytics = useMemo(() => {
        const totalContract = dashboardData.reduce((sum, row) => sum + (row.contractValueAfterTax || 0), 0);
        const totalExpense = dashboardData.reduce((sum, row) => sum + (row.totalExpense || 0), 0);
        const totalIncome = dashboardData.reduce((sum, row) => sum + (row.totalActualIncome || 0), 0);
        const debtToCollect = dashboardData.reduce((sum, row) => sum + (row.debtToCollect || 0), 0);
        const profit = totalIncome - totalExpense;

        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const monthExpense = transactions
            .filter(item => getDateKey(item.accounting_date) === currentMonthKey)
            .reduce((sum, item) => sum + (item.debit || 0) - (item.credit || 0), 0);
        const monthIncome = incomes
            .filter(item => item.is_paid && getDateKey(item.date) === currentMonthKey)
            .reduce((sum, item) => sum + (item.amount || 0), 0);

        const pendingStatuses = [STATUSES.WAITING_QS, STATUSES.WAITING_ACC, STATUSES.APPROVED];
        const pendingApprovals = dnttList.filter(item => pendingStatuses.includes(item.status));
        const paidNotAccounted = dnttList.filter(item => item.status === STATUSES.PAID);
        const pendingApprovalAmount = pendingApprovals.reduce((sum, item) => sum + (item.total_amount || 0), 0);

        const monthKeys = getRecentMonthKeys(6);
        const trend = monthKeys.map(month => {
            const expense = transactions
                .filter(item => getDateKey(item.accounting_date) === month.key)
                .reduce((sum, item) => sum + (item.debit || 0) - (item.credit || 0), 0);
            const income = incomes
                .filter(item => item.is_paid && getDateKey(item.date) === month.key)
                .reduce((sum, item) => sum + (item.amount || 0), 0);
            return { ...month, expense, income };
        });

        const maxTrendValue = Math.max(...trend.flatMap(item => [item.expense, item.income]), 1);

        const categoryBreakdown = EXPENSE_CATEGORIES.map(category => {
            const amount = transactions
                .filter(item => item.code?.toString().trim().replace(',', '.') === category.code)
                .reduce((sum, item) => sum + (item.debit || 0) - (item.credit || 0), 0);
            return { ...category, amount };
        })
            .filter(item => item.amount > 0)
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5);

        const maxCategoryValue = Math.max(...categoryBreakdown.map(item => item.amount), 1);

        const projectRanking = [...dashboardData]
            .sort((a, b) => (b.contractValueAfterTax || 0) - (a.contractValueAfterTax || 0))
            .slice(0, 5)
            .map(project => {
                const contract = project.contractValueAfterTax || 0;
                const incomeRate = contract > 0 ? Math.min(100, Math.round((project.totalActualIncome / contract) * 100)) : 0;
                const expenseRate = contract > 0 ? Math.min(100, Math.round((project.totalExpense / contract) * 100)) : 0;
                return { ...project, incomeRate, expenseRate };
            });

        const alerts = [
            pendingApprovals.length > 0 && {
                tone: 'amber',
                icon: Clock3,
                title: `${pendingApprovals.length} phiếu đang chờ xử lý`,
                description: canViewFinance ? `${formatCurrency(pendingApprovalAmount)} VNĐ cần duyệt/thanh toán.` : 'Có phiếu cần duyệt hoặc thanh toán.',
                action: 'Mở phê duyệt',
                tab: 'approvals'
            },
            paidNotAccounted.length > 0 && {
                tone: 'blue',
                icon: FileSignature,
                title: `${paidNotAccounted.length} phiếu đã chi chưa hạch toán`,
                description: 'Nên phân bổ vào chi phí công trình để báo cáo không bị lệch.',
                action: 'Hạch toán',
                tab: 'approvals'
            },
            debtToCollect > 0 && {
                tone: 'green',
                icon: WalletCards,
                title: 'Còn công nợ cần thu',
                description: canViewFinance ? `${formatCurrency(debtToCollect)} VNĐ đang nằm ở các đợt chưa thu.` : 'Có công nợ đang nằm ở các đợt chưa thu.',
                action: 'Xem thu-chi',
                tab: 'dashboard'
            },
            dashboardData.some(item => item.profit < 0) && {
                tone: 'red',
                icon: AlertTriangle,
                title: 'Có công trình đang âm dòng tiền',
                description: 'Cần rà soát chi phí hoặc kế hoạch thu tiền của các công trình này.',
                action: 'Xem chi phí',
                tab: 'expense-summary'
            }
        ].filter(Boolean).slice(0, 4);

        const recentTransactions = [...transactions]
            .sort((a, b) => new Date(b.accounting_date) - new Date(a.accounting_date))
            .slice(0, 5);

        return {
            totalContract,
            totalExpense,
            totalIncome,
            debtToCollect,
            profit,
            monthExpense,
            monthIncome,
            pendingApprovals,
            paidNotAccounted,
            trend,
            maxTrendValue,
            categoryBreakdown,
            maxCategoryValue,
            projectRanking,
            alerts,
            recentTransactions
        };
    }, [dashboardData, transactions, incomes, dnttList, STATUSES, canViewFinance]);

    const formatMoney = (value) => canViewFinance ? `${formatCurrency(value)} VNĐ` : 'Ẩn theo quyền';

    return (
        <div className="animate-in fade-in duration-500 space-y-6 max-w-[1600px] mx-auto">
            <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 text-white border border-slate-800 shadow-2xl">
                <div className="absolute -top-24 -right-20 h-72 w-72 rounded-full bg-blue-600/30 blur-3xl" />
                <div className="absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
                <div className="relative p-6 md:p-8 flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-blue-100 text-xs font-bold uppercase tracking-widest mb-4">
                            <Activity size={14} /> Trang chủ vận hành
                        </div>
                        <h2 className="text-3xl md:text-4xl font-black tracking-tight">
                            Xin chào, {currentUser?.name}
                        </h2>
                        <p className="text-slate-300 mt-3 max-w-3xl">
                            Bảng điều hành nhanh về thu, chi, công nợ, phê duyệt và sức khỏe công trình để nắm tình hình ngay sau khi đăng nhập.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 xl:min-w-[520px]">
                        <div className="rounded-2xl bg-white/10 p-4 border border-white/10">
                            <p className="text-xs text-slate-400 font-bold uppercase">Công trình</p>
                            <p className="text-2xl font-black mt-1">{projects.length}</p>
                        </div>
                        <div className="rounded-2xl bg-white/10 p-4 border border-white/10">
                            <p className="text-xs text-slate-400 font-bold uppercase">Chờ duyệt</p>
                            <p className="text-2xl font-black mt-1">{analytics.pendingApprovals.length}</p>
                        </div>
                        <div className="rounded-2xl bg-white/10 p-4 border border-white/10">
                            <p className="text-xs text-slate-400 font-bold uppercase">Đã chi tháng</p>
                            <p className="text-lg font-black mt-1">{canViewFinance ? formatCurrency(analytics.monthExpense) : 'Ẩn'}</p>
                        </div>
                        <div className="rounded-2xl bg-white/10 p-4 border border-white/10">
                            <p className="text-xs text-slate-400 font-bold uppercase">Đã thu tháng</p>
                            <p className="text-lg font-black mt-1">{canViewFinance ? formatCurrency(analytics.monthIncome) : 'Ẩn'}</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard title="Giá trị hợp đồng" value={formatMoney(analytics.totalContract)} subtitle="Tổng giá trị các công trình đang quản lý" icon={BriefcaseBusiness} tone="blue" onClick={() => setActiveTab('dashboard')} />
                <StatCard title="Tổng chi phí" value={formatMoney(analytics.totalExpense)} subtitle="Bao gồm chi đã nhập và đã hạch toán" icon={TrendingDown} tone="red" onClick={() => setActiveTab('expense-summary')} />
                <StatCard title="Tổng thu thực tế" value={formatMoney(analytics.totalIncome)} subtitle="Các đợt thu đã xác nhận đã nhận tiền" icon={TrendingUp} tone="green" onClick={() => setActiveTab('dashboard')} />
                <StatCard title="Lợi nhuận tạm tính" value={formatMoney(analytics.profit)} subtitle="Tổng thu thực tế trừ tổng chi phí" icon={Coins} tone={analytics.profit >= 0 ? 'slate' : 'amber'} onClick={() => setActiveTab('dashboard')} />
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm p-5 md:p-6">
                    <div className="flex items-start justify-between gap-4 mb-6">
                        <div>
                            <h3 className="font-black text-slate-900 text-xl flex items-center gap-2">
                                <BarChart3 className="text-blue-600" /> Xu hướng thu - chi 6 tháng
                            </h3>
                            <p className="text-sm text-slate-500 mt-1">So sánh dòng tiền vào và ra theo tháng.</p>
                        </div>
                        <button onClick={() => setActiveTab('history')} className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                            Xem lịch sử <ArrowRight size={16} />
                        </button>
                    </div>
                    {canViewFinance ? (
                        <>
                            <div className="h-72 flex items-end gap-3 md:gap-5 border-b border-slate-200 px-2">
                                {analytics.trend.map(month => (
                                    <div key={month.key} className="flex-1 h-full flex flex-col justify-end gap-2">
                                        <div className="flex items-end justify-center gap-1 h-full">
                                            <div
                                                className="w-full max-w-[28px] rounded-t-xl bg-emerald-500 shadow-lg shadow-emerald-500/20"
                                                style={{ height: `${Math.max(4, (month.income / analytics.maxTrendValue) * 100)}%` }}
                                                title={`Thu: ${formatCurrency(month.income)} VNĐ`}
                                            />
                                            <div
                                                className="w-full max-w-[28px] rounded-t-xl bg-rose-500 shadow-lg shadow-rose-500/20"
                                                style={{ height: `${Math.max(4, (month.expense / analytics.maxTrendValue) * 100)}%` }}
                                                title={`Chi: ${formatCurrency(month.expense)} VNĐ`}
                                            />
                                        </div>
                                        <p className="text-center text-xs font-black text-slate-500 pb-3">{month.label}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-center gap-6 mt-4 text-xs font-bold text-slate-500">
                                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500" /> Thu</span>
                                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-rose-500" /> Chi</span>
                            </div>
                        </>
                    ) : (
                        <div className="h-72 rounded-3xl bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center text-center px-6">
                            <div>
                                <AlertTriangle className="mx-auto text-slate-400 mb-3" size={34} />
                                <p className="font-black text-slate-700">Bạn không có quyền xem biểu đồ tài chính.</p>
                                <p className="text-sm text-slate-500 mt-1">Trang chủ vẫn hiển thị các tác vụ vận hành phù hợp với quyền hiện tại.</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 md:p-6">
                    <div className="mb-6">
                        <h3 className="font-black text-slate-900 text-xl flex items-center gap-2">
                            <PieChart className="text-indigo-600" /> Cơ cấu chi phí
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">Top nhóm chi theo mã tài khoản.</p>
                    </div>
                    <div className="space-y-4">
                        {!canViewFinance ? (
                            <div className="py-12 text-center text-slate-400 font-bold">Số liệu chi phí đang được ẩn theo quyền.</div>
                        ) : analytics.categoryBreakdown.length === 0 ? (
                            <div className="py-12 text-center text-slate-400 font-bold">Chưa có dữ liệu chi phí.</div>
                        ) : analytics.categoryBreakdown.map(category => (
                            <div key={category.code}>
                                <div className="flex justify-between gap-3 text-sm mb-2">
                                    <span className="font-black text-slate-800">{category.code} - {category.name}</span>
                                    <span className="font-bold text-slate-500">{canViewFinance ? formatCurrency(category.amount) : 'Ẩn'}</span>
                                </div>
                                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full" style={{ width: `${(category.amount / analytics.maxCategoryValue) * 100}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-5 md:p-6 border-b border-slate-100 flex items-start justify-between gap-4">
                        <div>
                            <h3 className="font-black text-slate-900 text-xl">Top công trình cần theo dõi</h3>
                            <p className="text-sm text-slate-500 mt-1">Ưu tiên theo giá trị hợp đồng, kèm tỷ lệ thu và chi.</p>
                        </div>
                        <button onClick={() => setActiveTab('dashboard')} className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                            Bảng thu-chi <ArrowRight size={16} />
                        </button>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {!canViewFinance ? (
                            <div className="p-8 text-center text-slate-400 font-bold">Danh sách tài chính công trình đang được ẩn theo quyền.</div>
                        ) : analytics.projectRanking.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 font-bold">Chưa có công trình để hiển thị.</div>
                        ) : analytics.projectRanking.map(project => (
                            <button
                                key={project.project}
                                onClick={() => onProjectSelect(project.project)}
                                className="w-full text-left p-5 hover:bg-blue-50/50 transition group"
                            >
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                                    <div>
                                        <p className="font-black text-slate-900 group-hover:text-blue-700">{project.project}</p>
                                        <p className="text-xs font-bold text-slate-500 mt-1">Hợp đồng: {formatMoney(project.contractValueAfterTax)}</p>
                                    </div>
                                    <div className={`px-3 py-1.5 rounded-full text-xs font-black ${project.profit >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                        Lãi tạm tính: {formatMoney(project.profit)}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
                                            <span>Tỷ lệ thu</span><span>{project.incomeRate}%</span>
                                        </div>
                                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${project.incomeRate}%` }} />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
                                            <span>Tỷ lệ chi</span><span>{project.expenseRate}%</span>
                                        </div>
                                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-rose-500 rounded-full" style={{ width: `${project.expenseRate}%` }} />
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 md:p-6">
                        <h3 className="font-black text-slate-900 text-xl mb-4">Việc cần chú ý</h3>
                        <div className="space-y-3">
                            {analytics.alerts.length === 0 ? (
                                <div className="py-8 text-center">
                                    <CheckCircle2 className="mx-auto text-emerald-500 mb-3" size={34} />
                                    <p className="font-bold text-slate-600">Chưa có cảnh báo lớn.</p>
                                </div>
                            ) : analytics.alerts.map(alert => {
                                const Icon = alert.icon;
                                return (
                                    <button
                                        key={alert.title}
                                        onClick={() => setActiveTab(alert.tab)}
                                        className="w-full text-left p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 transition border border-slate-100"
                                    >
                                        <div className="flex gap-3">
                                            <div className={`p-2 rounded-xl shrink-0 ${alert.tone === 'red' ? 'bg-rose-100 text-rose-600' : alert.tone === 'green' ? 'bg-emerald-100 text-emerald-600' : alert.tone === 'blue' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}>
                                                <Icon size={18} />
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-800">{alert.title}</p>
                                                <p className="text-xs text-slate-500 font-medium mt-1">{alert.description}</p>
                                                <p className="text-xs text-blue-600 font-black mt-2">{alert.action}</p>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 md:p-6">
                        <h3 className="font-black text-slate-900 text-xl mb-4">Chi gần đây</h3>
                        <div className="space-y-3">
                            {analytics.recentTransactions.length === 0 ? (
                                <p className="text-sm text-slate-400 font-bold py-8 text-center">Chưa có giao dịch.</p>
                            ) : analytics.recentTransactions.map(item => (
                                <div key={item.id} className="flex items-start justify-between gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                    <div className="min-w-0">
                                        <p className="font-black text-sm text-slate-800 truncate">{item.project_name}</p>
                                        <p className="text-xs text-slate-500 mt-1 truncate">{item.note || 'Không có diễn giải'}</p>
                                        <p className="text-[11px] text-slate-400 font-bold mt-1">{formatDateVN(item.accounting_date)}</p>
                                    </div>
                                    <p className="font-black text-sm text-rose-600 shrink-0">{canViewFinance ? formatCurrency(item.debit || 0) : 'Ẩn'}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
