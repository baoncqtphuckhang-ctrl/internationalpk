'use client';

import React, { useState, useMemo } from 'react';
import { 
    Home, LayoutDashboard, PieChart, PlusCircle, History, 
    FileSignature, ShieldCheck, Users, LogOut, 
    ChevronRight, Building2, Menu, X, Trash2,
    ClipboardList, Package, Download, FileSpreadsheet, Settings, Lock, Search, Bell, CheckCheck
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';

const normalizeRoleName = (value) => {
    if (value === null || value === undefined) return '';
    return value
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .trim();
};

export default function Sidebar({ 
    currentUser, 
    activeTab, 
    setActiveTab, 
    deleteRequests = [],
    projects, 
    selectedProject, 
    setSelectedProject,
    handleLogout,
    canViewDashboard,
    canViewReports,
    canInputData,
    canCreateDNTT,
    canManageSystem,
    canManageUsers,
    canViewApprovals,
    dnttList,
    partnerDebts,
    expectedInvoices,
    notifications = [],
    onMarkNotificationsRead,
    onClearNotifications,
    onNotificationOpen,
    STATUSES,
    onDeleteProject,
    handleExportBackup,
    systemConfig,
    onOpenSystemConfig,
    onOpenSignatureScanner,
    usersList = []
}) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isProjectsMenuOpen, setIsProjectsMenuOpen] = useState(false);
    const [projectSearchTerm, setProjectSearchTerm] = useState('');
    const [deleteProjectConfirmName, setDeleteProjectConfirmName] = useState(null);
    const [deletePassword, setDeletePassword] = useState('');
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [isClearNotificationsModalOpen, setIsClearNotificationsModalOpen] = useState(false);

    const isThuKy = currentUser?.role?.toUpperCase() === 'THƯ KÝ';
    const isKeToanThue = currentUser?.role?.toUpperCase() === 'KẾ TOÁN THUẾ';
    const adminPassword = usersList?.find(u => u.role?.toUpperCase() === 'ADMIN' || u.username?.toLowerCase() === 'admin')?.password || '123456';

    const filteredSidebarProjects = useMemo(() => {
        if (!projectSearchTerm) return projects;
        const term = projectSearchTerm.toLowerCase();
        return projects.filter(p => p.name.toLowerCase().includes(term));
    }, [projects, projectSearchTerm]);
    
    // Compute pending approvals badge
    const canApproveQS = canManageSystem || currentUser?.role === 'ADMIN' || currentUser?.role === 'QS';
    const canApproveKT = canManageSystem || currentUser?.role === 'ADMIN' || currentUser?.role?.startsWith('KẾ TOÁN');
    const canPay = canApproveKT || isThuKy;

    const pendingApprovalsCount = dnttList?.filter(item => {
        if (item.status === STATUSES?.WAITING_QS && canApproveQS) return true;
        if (item.status === STATUSES?.WAITING_ACC && canApproveKT) return true;
        if (item.status === STATUSES?.APPROVED && canPay) return true; // Waiting for payment
        return false;
    }).length || 0;

    const pendingDebtsCount = partnerDebts?.filter(d => d.status === 'CHƯA XONG').length || 0;
    const expectedInvoicesCount = expectedInvoices?.length || 0;
    const unreadNotifications = notifications?.filter(item => {
        const currentRoleName = normalizeRoleName(currentUser?.role);
        const isRecipient = item.recipient_username === currentUser?.username ||
                            normalizeRoleName(item.recipient_role) === currentRoleName ||
                            normalizeRoleName(item.recipient_role) === 'ALL';
        return !item.is_read && isRecipient;
    }) || [];
    const unreadNotificationsCount = unreadNotifications.length;
    const recentNotifications = notifications?.slice(0, 8) || [];

    const menuItems = [
        { id: 'home', label: 'Trang Chủ', icon: Home, show: true },
        { id: 'dashboard', label: 'Bảng Thu - Chi', icon: LayoutDashboard, show: canViewDashboard && !isKeToanThue },
        { id: 'expense-summary', label: 'Tổng Hợp Chi Phí', icon: PieChart, show: canViewReports && !isKeToanThue },
        { id: 'history', label: 'Lịch sử chi tiền', icon: History, show: canViewReports && !isKeToanThue },
        { id: 'input', label: 'Nhập Liệu Thu/Chi', icon: PlusCircle, show: canInputData && !isThuKy && !isKeToanThue, locked: systemConfig?.input_data && currentUser?.role !== 'ADMIN' },
        { id: 'partner-debts', label: 'Công Nợ', icon: ClipboardList, show: (canInputData || isThuKy) && !isKeToanThue, badge: pendingDebtsCount > 0 ? pendingDebtsCount : null },
        { id: 'materials', label: 'Vật tư', icon: Package, show: !isThuKy && !isKeToanThue, locked: systemConfig?.material_orders && currentUser?.role !== 'ADMIN' },
        { id: 'dntt-approvals', label: 'DNTT & Phê duyệt', icon: FileSignature, show: (canCreateDNTT || canViewApprovals) && !isThuKy && !isKeToanThue, locked: (systemConfig?.create_dntt || systemConfig?.approve_dntt) && currentUser?.role !== 'ADMIN', badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null },
        { id: 'expected-invoices', label: 'HĐ - TĐ Dự Kiến', icon: FileSpreadsheet, show: currentUser?.role?.toUpperCase() !== 'CHỈ HUY TRƯỞNG' && currentUser?.role?.toUpperCase() !== 'CHT' },
        { id: 'customer-debts', label: 'Quản Lý Hóa Đơn', icon: ClipboardList, show: canInputData || isThuKy || isKeToanThue },
        { id: 'delete-approvals', label: 'Duyệt Xóa', icon: Trash2, show: currentUser?.role?.toUpperCase() === 'ADMIN' || currentUser?.role?.toUpperCase() === 'QS TRƯỞNG', badge: deleteRequests.length > 0 ? deleteRequests.length : null },
        { id: 'employee-salary', label: 'Lương NV', icon: FileSpreadsheet, show: (currentUser?.role === 'ADMIN' || currentUser?.role?.startsWith('KẾ TOÁN')) && !isKeToanThue },
    ];

    const toggleTab = (id) => {
        const item = menuItems.find(m => m.id === id);
        if (item && item.locked) {
            alert('Thử lại sau');
            return;
        }
        setActiveTab(id);
        setIsMobileMenuOpen(false);
    };

    return (
        <>
            {/* Mobile Header - Chỉ hiện trên điện thoại */}
            <div className="md:hidden flex items-center justify-between p-4 bg-slate-900 text-white sticky top-0 z-[100]">
                <button onClick={() => toggleTab('home')} className="flex items-center gap-2 text-left">
                    <div className="bg-blue-600 p-1.5 rounded-lg">
                        <LayoutDashboard size={20} />
                    </div>
                    <span className="font-black tracking-tighter text-lg uppercase">CB Pro</span>
                </button>
                <div className="flex items-center gap-1">
                    <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition" title="Đăng xuất">
                        <LogOut size={22} />
                    </button>
                    <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 hover:bg-slate-800 rounded-lg">
                        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </div>

            {/* Sidebar Overlay for Mobile */}
            {isMobileMenuOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-[90] md:hidden backdrop-blur-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Main Sidebar */}
            <aside className={`
                fixed md:static inset-y-0 left-0 z-[95] 
                w-72 bg-slate-900 text-slate-300 flex flex-col h-screen 
                transition-transform duration-300 ease-in-out
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}>
                <div className="p-6 hidden md:block">
                    <button onClick={() => toggleTab('home')} className="flex items-center gap-3 mb-8 text-left group">
                        <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-900/20">
                            <LayoutDashboard size={28} className="text-white" />
                        </div>
                        <div>
                            <h1 className="font-black text-xl text-white tracking-tighter uppercase leading-none group-hover:text-blue-100 transition">CB Pro</h1>
                            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-widest">Management System</p>
                        </div>
                    </button>
                </div>

                <div className="px-4 mb-6">
                    <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50 flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black shrink-0 shadow-lg uppercase">
                                {currentUser?.name?.charAt(0)}
                            </div>
                            <div className="overflow-hidden">
                                <p className="font-bold text-white text-sm truncate">{currentUser?.name}</p>
                                <p className="text-[10px] text-blue-400 font-black uppercase tracking-tighter">{currentUser?.role}</p>
                            </div>
                        </div>
                        <button onClick={handleLogout} className="text-slate-500 hover:text-red-400 transition shrink-0" title="Đăng xuất">
                            <LogOut size={18} />
                        </button>
                    </div>
                    <button onClick={onOpenSignatureScanner} className="w-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2">
                        <FileSignature size={14} className="text-blue-400" /> Cập nhật chữ ký
                    </button>
                    <div className="relative mt-2">
                        <button
                            type="button"
                            onClick={() => setIsNotificationsOpen(prev => !prev)}
                            className="w-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 relative"
                        >
                            <Bell size={14} className="text-amber-400" /> Thông báo
                            {unreadNotificationsCount > 0 && (
                                <span className="absolute right-3 top-1.5 bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                                    {unreadNotificationsCount}
                                </span>
                            )}
                        </button>

                        {isNotificationsOpen && (
                            <div className="absolute left-0 right-0 top-full mt-2 z-[130] bg-slate-950 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
                                <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
                                    <span className="text-[11px] font-black text-white uppercase tracking-wide">Thông báo</span>
                                    <div className="flex items-center gap-2">
                                        {unreadNotificationsCount > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => onMarkNotificationsRead?.(unreadNotifications.map(item => item.id))}
                                                className="text-[10px] text-blue-300 hover:text-blue-100 font-bold flex items-center gap-1"
                                            >
                                                <CheckCheck size={12} /> Đã đọc
                                            </button>
                                        )}
                                        {notifications.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setIsClearNotificationsModalOpen(true)}
                                                className="text-[10px] text-red-300 hover:text-red-100 font-bold flex items-center gap-1"
                                            >
                                                <Trash2 size={12} /> Xóa hết
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="max-h-72 overflow-y-auto custom-scrollbar">
                                    {recentNotifications.length === 0 ? (
                                        <div className="px-4 py-6 text-center text-xs text-slate-500 font-bold">Chưa có thông báo.</div>
                                    ) : recentNotifications.map(notification => (
                                        <button
                                            key={notification.id}
                                            type="button"
                                            onClick={() => {
                                                onNotificationOpen?.(notification);
                                                setIsNotificationsOpen(false);
                                                setIsMobileMenuOpen(false);
                                            }}
                                            className={`w-full text-left px-3 py-3 border-b border-slate-800 last:border-b-0 transition hover:bg-slate-800 ${notification.is_read ? 'opacity-70' : 'bg-slate-900/70'}`}
                                        >
                                            <div className="flex items-start gap-2">
                                                <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${notification.is_read ? 'bg-slate-600' : 'bg-red-500'}`} />
                                                <div className="min-w-0">
                                                    <p className="text-xs font-black text-slate-100 leading-tight">{notification.title}</p>
                                                    <p className="text-[11px] text-slate-400 leading-snug mt-1 line-clamp-3">{notification.message}</p>
                                                    <p className="text-[10px] text-slate-600 mt-1 flex items-center justify-between">
                                                        <span>{notification.created_at ? new Date(notification.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                                        {notification.created_by === currentUser?.username &&
                                                         (normalizeRoleName(notification.recipient_role) === 'ADMIN' || notification.recipient_username === 'admin') &&
                                                         !(currentUser?.role?.toUpperCase() === 'ADMIN' || currentUser?.username?.toLowerCase() === 'admin') && (
                                                            notification.recipient_deleted ? (
                                                                <span className="text-red-400 font-bold ml-1">Admin đã xóa</span>
                                                            ) : notification.is_read ? (
                                                                <span className="text-emerald-400 font-bold ml-1">Admin đã xem</span>
                                                            ) : (
                                                                <span className="text-amber-400 font-bold ml-1">Admin chưa xem</span>
                                                            )
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <nav className="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar pb-6">
                    {menuItems.filter(item => item.show).map((item) => (
                        <button
                            key={item.id}
                            onClick={() => toggleTab(item.id)}
                            className={`w-full flex items-center justify-between p-3.5 rounded-xl font-bold transition-all duration-200 group ${
                                activeTab === item.id 
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 scale-[1.02]' 
                                : item.locked ? 'opacity-50 cursor-not-allowed bg-slate-800/30 text-slate-500' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <item.icon size={20} className={activeTab === item.id ? 'text-white' : 'text-slate-500 group-hover:text-blue-400'} />
                                <span className="text-sm">{item.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {item.badge && (
                                    <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                                        {item.badge}
                                    </span>
                                )}
                                {item.locked && <Lock size={14} className="text-red-400 opacity-70" />}
                            </div>
                        </button>
                    ))}

                    {canManageSystem && !isKeToanThue && (
                        <div className="pt-6 pb-2 space-y-1 border-t border-slate-800 mt-4">
                            <p className="text-[10px] text-slate-600 uppercase font-black px-4 tracking-widest mb-2">Hệ Thống</p>
                            <button onClick={() => toggleTab('projects')} className={`w-full flex items-center gap-3 p-3.5 rounded-xl font-bold transition ${activeTab === 'projects' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}>
                                <Building2 size={20} /> <span className="text-sm">QL Công trình</span>
                            </button>
                            {canManageUsers && (
                                <button onClick={() => toggleTab('users')} className={`w-full flex items-center gap-3 p-3.5 rounded-xl font-bold transition ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}>
                                    <Users size={20} /> <span className="text-sm">QL Nhân viên</span>
                                </button>
                            )}
                            {currentUser?.role === 'ADMIN' && (
                                <>
                                    <button onClick={onOpenSystemConfig} className={`w-full flex items-center gap-3 p-3.5 rounded-xl font-bold transition text-slate-500 hover:bg-slate-800 hover:text-slate-300`}>
                                        <Settings size={20} /> <span className="text-sm">Khóa Chức Năng</span>
                                    </button>
                                    <button onClick={() => toggleTab('trash')} className={`w-full flex items-center gap-3 p-3.5 rounded-xl font-bold transition ${activeTab === 'trash' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}>
                                        <Trash2 size={20} /> <span className="text-sm">Thùng rác</span>
                                    </button>
                                </>
                            )}
                            {handleExportBackup && (
                                <button onClick={handleExportBackup} className={`w-full flex items-center gap-3 p-3.5 rounded-xl font-bold transition text-green-500 hover:bg-slate-800 hover:text-green-400`}>
                                    <Download size={20} /> <span className="text-sm">Backup Dữ Liệu</span>
                                </button>
                            )}
                        </div>
                    )}

                    {!isKeToanThue && (
                        <div className="pt-6 pb-2 space-y-1 border-t border-slate-800 mt-4">
                            <div className="w-full flex items-center justify-between p-3.5 rounded-xl font-bold transition-all duration-200 group hover:bg-slate-800 text-slate-400 hover:text-slate-200 uppercase mb-1 cursor-pointer" onClick={() => {
                                const nextOpen = !isProjectsMenuOpen;
                                setIsProjectsMenuOpen(nextOpen);
                                if (!nextOpen) setProjectSearchTerm('');
                            }}>
                                <span className="text-sm">Công trình</span>
                                <div className="flex items-center gap-3">
                                    <Search 
                                        size={16} 
                                        className="hover:text-blue-400 transition" 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsProjectsMenuOpen(true);
                                            setTimeout(() => document.getElementById('project-search-input')?.focus(), 100);
                                        }} 
                                        title="Tìm kiếm"
                                    />
                                    <ChevronRight size={16} className={`transition-transform duration-200 ${isProjectsMenuOpen ? 'rotate-90' : ''}`} />
                                </div>
                            </div>
                        
                        {isProjectsMenuOpen && (
                            <div className="space-y-1 pl-2">
                                <div className="px-2 pb-2">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
                                        <input 
                                            id="project-search-input"
                                            type="text"
                                            placeholder="Tìm công trình..."
                                            value={projectSearchTerm}
                                            onChange={(e) => setProjectSearchTerm(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && filteredSidebarProjects.length > 0) {
                                                    setSelectedProject(filteredSidebarProjects[0].name);
                                                    toggleTab('project-detail');
                                                    setProjectSearchTerm('');
                                                }
                                            }}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-slate-300 outline-none focus:border-indigo-500 focus:bg-slate-900 transition"
                                        />
                                    </div>
                                </div>
                                {filteredSidebarProjects.length === 0 ? (
                                    <div className="text-xs text-slate-500 text-center py-2">Không tìm thấy công trình</div>
                                ) : filteredSidebarProjects.map(p => (
                                    <div key={p.id} className="flex flex-col">
                                        {deleteProjectConfirmName === p.name ? (
                                            <div className="mt-1 mx-3 p-3 bg-slate-800 border border-red-900/50 rounded-xl animate-in fade-in">
                                                <p className="text-xs text-red-400 mb-2 font-bold">Nhập mật khẩu để xóa:</p>
                                                <input type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-red-500 mb-3" placeholder="Mật khẩu..." />
                                                <div className="flex gap-2">
                                                    <button onClick={() => { 
                                                        if (deletePassword === adminPassword) {
                                                            onDeleteProject(p.name); 
                                                            setDeleteProjectConfirmName(null); 
                                                            setDeletePassword('');
                                                        } else {
                                                            alert('Mật khẩu không đúng!');
                                                        }
                                                    }} className="flex-1 bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white py-1.5 rounded-lg text-xs font-bold transition">Xác nhận</button>
                                                    <button onClick={() => { setDeleteProjectConfirmName(null); setDeletePassword(''); }} className="flex-1 bg-slate-700 text-slate-300 hover:bg-slate-600 py-1.5 rounded-lg text-xs font-bold transition">Hủy</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div
                                                className={`w-full flex items-center justify-between p-3.5 rounded-xl transition group cursor-pointer ${
                                                    selectedProject === p.name && activeTab === 'project-detail'
                                                    ? 'bg-slate-800 text-blue-400 border border-slate-700/50 shadow-inner' 
                                                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                                                }`}
                                            >
                                                <div 
                                                    className="flex-1 flex items-center overflow-hidden" 
                                                    onClick={() => { setSelectedProject(p.name); toggleTab('project-detail'); }}
                                                >
                                                    <span className="text-sm font-bold truncate pr-2">{p.name}</span>
                                                </div>
                                                
                                                <div className="flex items-center gap-1">
                                                    {currentUser?.role?.toUpperCase() === 'ADMIN' && (
                                                        <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); setDeleteProjectConfirmName(p.name); }} 
                                                                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded-md transition"
                                                                title="Xóa công trình"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    )}
                                                    <ChevronRight size={14} className={`transition-transform duration-200 ml-1 ${selectedProject === p.name ? 'translate-x-1 opacity-100' : 'opacity-0'}`} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* <div className="mt-8 mb-4 px-4 flex justify-center opacity-70 hover:opacity-100 transition-opacity">
                        <img src="https://visitor-badge.laobi.icu/badge?page_id=cbpro.misa.app&left_color=gray&right_color=blue&left_text=Lượt truy cập" alt="Visitor Count" className="rounded shadow" />
                    </div> */}
                </nav>
            </aside>

            <ConfirmModal
                isOpen={isClearNotificationsModalOpen}
                title="Xóa thông báo"
                message="Bạn có chắc chắn muốn xóa toàn bộ thông báo hiện có? Hành động này không thể hoàn tác."
                confirmText="Xóa tất cả"
                onConfirm={() => {
                    onClearNotifications?.();
                    setIsClearNotificationsModalOpen(false);
                }}
                onCancel={() => setIsClearNotificationsModalOpen(false)}
            />
        </>
    );
}
