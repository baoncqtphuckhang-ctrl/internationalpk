'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit3, Save, Trash2, Building2, FileText, Coins, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency, parseVietnameseNumber } from '@/lib/utils';

export default function ProjectManager({ currentUser, projects, projectDetails, onUpsertProject, onDeleteProject, isLoading, usersList = [] }) {
    const adminPassword = usersList?.find(u => u.role?.toUpperCase() === 'ADMIN' || u.username?.toLowerCase() === 'admin')?.password || '123456';
    const [isAdding, setIsAdding] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('project_view_mode') || 'grid';
        }
        return 'grid';
    });
    const [formData, setFormData] = useState({
        original_name: '',
        name: '',
        main_contract: '',
        sub_contracts: [],
        contract_value_after_tax: 0,
        advance_value: 0,
        address: '',
        cht_list: [{ name: '', phone: '' }],
        project_type: 'TRỰC TIẾP ORDER',
        debt_to_collect: 0,
        plhd_list: [],
        status: 'Doing'
    });

    const [deleteModal, setDeleteModal] = useState({ isOpen: false, projectName: '', password: '' });
    const [isCustomContractor, setIsCustomContractor] = useState(false);
    const [isCustomInvestor, setIsCustomInvestor] = useState(false);

    const existingContractors = useMemo(() => {
        const contractors = new Set();
        projects.forEach(p => {
            const details = projectDetails[p.name] || {};
            if (details.generalContractor && details.generalContractor.trim()) {
                contractors.add(details.generalContractor.trim());
            }
        });
        return Array.from(contractors).sort();
    }, [projects, projectDetails]);

    const existingInvestors = useMemo(() => {
        const investors = new Set();
        projects.forEach(p => {
            const details = projectDetails[p.name] || {};
            if (details.investor && details.investor.trim()) {
                investors.add(details.investor.trim());
            }
        });
        return Array.from(investors).sort();
    }, [projects, projectDetails]);


    const handleOpenEdit = (p) => {
        const details = projectDetails[p.name] || {};
        const gc = details.generalContractor || '';
        const inv = details.investor || '';
        setEditingProject(p.name);
        let main_contract = details.contractNo || '';
        let sub_contracts = [];
        
        try {
            if (details.contractNo && details.contractNo.startsWith('{')) {
                const parsed = JSON.parse(details.contractNo);
                main_contract = parsed.main_contract || '';
                sub_contracts = parsed.sub_contracts || [];
            }
        } catch(e) {}

        setFormData({
            original_name: p.name,
            name: p.name,
            main_contract,
            sub_contracts,
            contract_value_after_tax: details.contractValueAfterTax || 0,
            advance_value: details.advanceValue || 0,
            address: details.address || '',
            cht_list: (details.chtName || '').split(',').map((s) => s.trim()).filter(Boolean).length > 0
                ? (details.chtName || '').split(',').map((s) => s.trim()).filter(Boolean).map((name, i) => ({
                    name,
                    phone: ((details.chtPhone || '').split(',').map(s => s.trim())[i]) || ''
                }))
                : [{ name: '', phone: '' }],
            project_type: details.projectType || 'TRỰC TIẾP ORDER',
            debt_to_collect: details.debtToCollect || 0,
            plhd_list: p.plhds || [],
            status: p.status || 'Doing',
            general_contractor: gc,
            investor: inv
        });
        setIsCustomContractor(gc && !existingContractors.includes(gc));
        setIsCustomInvestor(inv && !existingInvestors.includes(inv));
        setIsAdding(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const saved = await onUpsertProject(formData, !!editingProject);
        if (!saved) return;
        setIsAdding(false);
        setEditingProject(null);
        setFormData({ original_name: '', name: '', main_contract: '', sub_contracts: [], contract_value_after_tax: 0, advance_value: 0, debt_to_collect: 0, address: '', cht_list: [{ name: '', phone: '' }], project_type: 'TRỰC TIẾP ORDER', plhd_list: [], status: 'Doing', general_contractor: '', investor: '' });
    };

    const handleDelete = (projectName) => {
        if (currentUser?.role?.toUpperCase() !== 'ADMIN') {
            alert('Chỉ Admin mới có quyền xóa công trình!');
            return;
        }
        setDeleteModal({ isOpen: true, projectName, password: '' });
    };

    const confirmDelete = () => {
        if (deleteModal.password !== adminPassword) {
            alert('Mật khẩu không đúng!');
            return;
        }
        onDeleteProject(deleteModal.projectName);
        setDeleteModal({ isOpen: false, projectName: '', password: '' });
        setIsAdding(false);
    };


    // Sắp xếp: Đang thi công trước (mới nhất đầu), Đã hoàn thành xếp ở cuối
    const sortedProjects = [...projects].sort((a, b) => {
        const isCompletedA = a.status === 'Finish';
        const isCompletedB = b.status === 'Finish';
        
        if (isCompletedA && !isCompletedB) return 1;
        if (!isCompletedA && isCompletedB) return -1;

        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (dateB !== dateA) return dateB - dateA;
        return (b.id || '').localeCompare(a.id || '');
    });

    const filteredProjects = sortedProjects.filter(p => {
        const details = projectDetails[p.name] || {};
        const term = searchTerm.toLowerCase();
        return (
            p.name.toLowerCase().includes(term) ||
            (details.address || '').toLowerCase().includes(term) ||
            (details.chtName || '').toLowerCase().includes(term) ||
            (details.contractNo || '').toLowerCase().includes(term) ||
            (details.generalContractor || '').toLowerCase().includes(term) ||
            (details.investor || '').toLowerCase().includes(term)
        );
    });

    const totalItems = filteredProjects.length;

    return (
        <div className="w-full animate-in fade-in duration-500 relative">
            <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Building2 className="text-indigo-600" /> Quản lý Công Trình
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Quản lý danh sách dự án và thông tin hợp đồng cơ bản.</p>
                </div>
                <button 
                    onClick={() => {
                        setEditingProject(null);
                        setFormData({ original_name: '', name: '', main_contract: '', sub_contracts: [], contract_value_after_tax: 0, advance_value: 0, debt_to_collect: 0, address: '', cht_list: [{ name: '', phone: '' }], project_type: 'TRỰC TIẾP ORDER', plhd_list: [], status: 'Doing', general_contractor: '', investor: '' });
                        setIsAdding(true);
                    }}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center gap-2"
                >
                    <Plus size={18} /> Thêm công trình
                </button>
            </header>

            {isAdding && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto animate-in fade-in">
                    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl my-auto animate-in zoom-in-95">
                        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <Building2 className="text-indigo-600" /> 
                            {editingProject ? 'Sửa thông tin công trình' : 'Thêm công trình mới'}
                        </h3>
                        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="block text-sm font-black text-slate-900">Tên công trình *</label>
                                <input 
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                    required
                                    className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none focus:border-indigo-500 bg-slate-50 text-slate-800"
                                    placeholder="Ví dụ: Công trình A..."
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-black text-slate-900">Hợp đồng chính</label>
                                <input 
                                    type="text"
                                    value={formData.main_contract || ''}
                                    onChange={(e) => setFormData({...formData, main_contract: e.target.value})}
                                    className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none focus:border-indigo-500 bg-slate-50 text-slate-800"
                                    placeholder="Ví dụ: HĐC-01/2026..."
                                />
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <label className="block text-sm font-black text-slate-900">Loại công trình</label>
                                <select 
                                    value={formData.project_type}
                                    onChange={(e) => setFormData({...formData, project_type: e.target.value})}
                                    className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none focus:border-indigo-500 bg-slate-50 text-slate-800"
                                >
                                    <option value="TRỰC TIẾP ORDER">TRỰC TIẾP ORDER</option>
                                    <option value="TỔNG THẦU MUA HỘ">TỔNG THẦU MUA HỘ</option>
                                </select>
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="block text-sm font-black text-slate-900">Trạng thái thi công</label>
                                <select 
                                    value={formData.status || 'Doing'}
                                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                                    className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none focus:border-indigo-500 bg-slate-50 text-slate-800 font-bold"
                                >
                                    <option value="Doing">⚙️ Doing (HOẠT ĐỘNG)</option>
                                    <option value="Finish">🔒 Finish (KHÓA SỔ)</option>
                                </select>
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="block text-sm font-black text-slate-900">Địa chỉ công trình</label>
                                <input 
                                    type="text"
                                    value={formData.address}
                                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                                    className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none focus:border-indigo-500 bg-slate-50 text-slate-800"
                                    placeholder="Địa chỉ chi tiết của dự án..."
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="block text-sm font-black text-slate-900">Tổng thầu</label>
                                    {isCustomContractor && (
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                setIsCustomContractor(false);
                                                setFormData({ ...formData, general_contractor: '' });
                                            }}
                                            className="text-xs text-indigo-600 hover:text-indigo-800 font-bold"
                                        >
                                            Chọn từ danh sách
                                        </button>
                                    )}
                                </div>
                                {isCustomContractor ? (
                                    <input 
                                        type="text"
                                        value={formData.general_contractor || ''}
                                        onChange={(e) => setFormData({...formData, general_contractor: e.target.value.toUpperCase()})}
                                        className="w-full p-3 border-2 border-indigo-200 rounded-xl outline-none focus:border-indigo-500 bg-white text-slate-800 font-bold"
                                        placeholder="Nhập tên tổng thầu mới..."
                                        autoFocus
                                    />
                                ) : (
                                    <select
                                        value={formData.general_contractor || ''}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '__NEW__') {
                                                setIsCustomContractor(true);
                                                setFormData({ ...formData, general_contractor: '' });
                                            } else {
                                                setFormData({ ...formData, general_contractor: val });
                                            }
                                        }}
                                        className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none focus:border-indigo-500 bg-slate-50 text-slate-800 font-bold"
                                    >
                                        <option value="">-- Chọn tổng thầu --</option>
                                        {existingContractors.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                        <option value="__NEW__" className="text-indigo-600 font-bold">+ Nhập tổng thầu mới...</option>
                                    </select>
                                )}
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="block text-sm font-black text-slate-900">Chủ đầu tư</label>
                                    {isCustomInvestor && (
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                setIsCustomInvestor(false);
                                                setFormData({ ...formData, investor: '' });
                                            }}
                                            className="text-xs text-indigo-600 hover:text-indigo-800 font-bold"
                                        >
                                            Chọn từ danh sách
                                        </button>
                                    )}
                                </div>
                                {isCustomInvestor ? (
                                    <input 
                                        type="text"
                                        value={formData.investor || ''}
                                        onChange={(e) => setFormData({...formData, investor: e.target.value.toUpperCase()})}
                                        className="w-full p-3 border-2 border-indigo-200 rounded-xl outline-none focus:border-indigo-500 bg-white text-slate-800 font-bold"
                                        placeholder="Nhập tên chủ đầu tư mới..."
                                        autoFocus
                                    />
                                ) : (
                                    <select
                                        value={formData.investor || ''}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '__NEW__') {
                                                setIsCustomInvestor(true);
                                                setFormData({ ...formData, investor: '' });
                                            } else {
                                                setFormData({ ...formData, investor: val });
                                            }
                                        }}
                                        className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none focus:border-indigo-500 bg-slate-50 text-slate-800 font-bold"
                                    >
                                        <option value="">-- Chọn chủ đầu tư --</option>
                                        {existingInvestors.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                        <option value="__NEW__" className="text-indigo-600 font-bold">+ Nhập chủ đầu tư mới...</option>
                                    </select>
                                )}
                            </div>
                            {formData.cht_list.map((cht, index) => (
                                <React.Fragment key={`cht-${index}`}>
                                    <div className="space-y-2 relative">
                                        <label className="block text-sm font-black text-slate-900">
                                            Chỉ Huy Trưởng {index + 1} (CHT)
                                        </label>
                                        <div className="relative">
                                            <select 
                                                value={cht.name}
                                                onChange={(e) => {
                                                    const selectedCht = usersList.find(u => u.name === e.target.value);
                                                    const newList = [...formData.cht_list];
                                                    newList[index] = {
                                                        name: e.target.value,
                                                        phone: selectedCht?.phone || ''
                                                    };
                                                    setFormData({ ...formData, cht_list: newList });
                                                }}
                                                className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none focus:border-indigo-500 bg-slate-50 text-slate-800"
                                            >
                                                <option value="">-- Chọn Chỉ Huy Trưởng --</option>
                                                {usersList.filter(u => u.role !== 'ADMIN' && !u.role?.startsWith('KẾ TOÁN') && u.role !== 'THƯ KÝ').map(u => (
                                                    <option key={u.id} value={u.name}>{u.name} ({u.role})</option>
                                                ))}
                                            </select>
                                            {index > 0 && (
                                                <button 
                                                    type="button" 
                                                    onClick={() => {
                                                        const newList = [...formData.cht_list];
                                                        newList.splice(index, 1);
                                                        setFormData({...formData, cht_list: newList});
                                                    }}
                                                    className="absolute -right-8 top-1/2 -translate-y-1/2 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                                                    title="Xóa CHT này"
                                                >
                                                    <Trash2 size={16}/>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-black text-slate-900">SĐT Chỉ Huy Trưởng {index + 1}</label>
                                        <input 
                                            type="text"
                                            value={cht.phone}
                                            readOnly
                                            className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none bg-slate-100 text-slate-500"
                                        />
                                    </div>
                                </React.Fragment>
                            ))}
                            <div className="md:col-span-2 flex justify-start mb-2">
                                <button 
                                    type="button"
                                    onClick={() => setFormData({...formData, cht_list: [...(formData.cht_list || []), {name: '', phone: ''}]})}
                                    className="text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1 text-sm bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition"
                                >
                                    <Plus size={16} /> Thêm CHT Khác
                                </button>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-black text-slate-900">Giá trị HĐ (Trước thuế)</label>
                                <div className="relative flex items-center">
                                    <input 
                                        type="text"
                                        value={formData.contract_value_after_tax ? formatCurrency(formData.contract_value_after_tax) : ''}
                                        onChange={(e) => setFormData({...formData, contract_value_after_tax: parseVietnameseNumber(e.target.value)})}
                                        className="w-full p-3 pr-14 border-2 border-slate-100 rounded-xl outline-none focus:border-indigo-500 bg-slate-50 font-bold text-blue-700"
                                        placeholder="0"
                                    />
                                    <span className="absolute right-4 font-bold text-xs text-slate-400 pointer-events-none">VNĐ</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-black text-slate-900">Giá trị Tạm ứng</label>
                                <div className="relative flex items-center">
                                    <input 
                                        type="text"
                                        value={formData.advance_value ? formatCurrency(formData.advance_value) : ''}
                                        onChange={(e) => setFormData({...formData, advance_value: parseVietnameseNumber(e.target.value)})}
                                        className="w-full p-3 pr-14 border-2 border-slate-100 rounded-xl outline-none focus:border-indigo-500 bg-slate-50 font-bold text-amber-600"
                                        placeholder="0"
                                    />
                                    <span className="absolute right-4 font-bold text-xs text-slate-400 pointer-events-none">VNĐ</span>
                                </div>
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="block text-sm font-black text-slate-900">Giá trị PLHĐ 1 (Trước thuế)</label>
                                <div className="relative flex items-center">
                                    <input 
                                        type="text"
                                        value={formData.debt_to_collect ? formatCurrency(formData.debt_to_collect) : ''}
                                        onChange={(e) => setFormData({...formData, debt_to_collect: parseVietnameseNumber(e.target.value)})}
                                        className="w-full p-3 pr-14 border-2 border-slate-100 rounded-xl outline-none focus:border-indigo-500 bg-slate-50 font-bold text-orange-600"
                                        placeholder="0"
                                    />
                                    <span className="absolute right-4 font-bold text-xs text-slate-400 pointer-events-none">VNĐ</span>
                                </div>
                            </div>
                            {formData.plhd_list?.map((plhd, index) => (
                                <div key={index} className="space-y-2 md:col-span-2 relative">
                                    <label className="block text-sm font-black text-slate-900">Giá trị PLHĐ {index + 2} (Trước thuế)</label>
                                    <div className="relative flex items-center">
                                        <input 
                                            type="text"
                                            value={plhd ? formatCurrency(plhd) : ''}
                                            onChange={(e) => {
                                                const newList = [...formData.plhd_list];
                                                newList[index] = parseVietnameseNumber(e.target.value);
                                                setFormData({...formData, plhd_list: newList});
                                            }}
                                            className="w-full p-3 pr-14 border-2 border-slate-100 rounded-xl outline-none focus:border-indigo-500 bg-slate-50 font-bold text-orange-600"
                                            placeholder="0"
                                        />
                                        <span className="absolute right-12 font-bold text-xs text-slate-400 pointer-events-none">VNĐ</span>
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                const newList = [...formData.plhd_list];
                                                newList.splice(index, 1);
                                                setFormData({...formData, plhd_list: newList});
                                            }}
                                            className="absolute right-2 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                                            title="Xóa phụ lục này"
                                        >
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            <div className="md:col-span-2 flex justify-start">
                                <button 
                                    type="button"
                                    onClick={() => setFormData({...formData, plhd_list: [...(formData.plhd_list || []), 0]})}
                                    className="text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1 text-sm bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition"
                                >
                                    <Plus size={16} /> Thêm Phụ Lục HĐ
                                </button>
                            </div>
                            
                            <div className="md:col-span-2 border-t pt-4 mt-4">
                                <h4 className="text-md font-bold text-slate-800 mb-4">Danh sách Hợp đồng phụ</h4>
                                {formData.sub_contracts?.map((sc, scIndex) => (
                                    <div key={scIndex} className="p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 mb-4 space-y-4 relative">
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                const newList = [...formData.sub_contracts];
                                                newList.splice(scIndex, 1);
                                                setFormData({...formData, sub_contracts: newList});
                                            }}
                                            className="absolute right-4 top-4 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                                            title="Xóa HĐ phụ này"
                                        >
                                            <Trash2 size={16}/>
                                        </button>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <label className="block text-xs font-black text-slate-900">Số HĐ phụ *</label>
                                                <input 
                                                    type="text"
                                                    value={sc.sub_contract_no || ''}
                                                    onChange={(e) => {
                                                        const newList = [...formData.sub_contracts];
                                                        newList[scIndex] = { ...sc, sub_contract_no: e.target.value };
                                                        setFormData({...formData, sub_contracts: newList});
                                                    }}
                                                    required
                                                    className="w-full p-2.5 border-2 border-slate-200 rounded-xl outline-none focus:border-indigo-500 bg-white text-slate-800 text-sm font-semibold"
                                                    placeholder="Số HĐ phụ..."
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="block text-xs font-black text-slate-900">Giá trị HĐ phụ (Trước thuế)</label>
                                                <div className="relative flex items-center">
                                                    <input 
                                                        type="text"
                                                        value={sc.value ? formatCurrency(sc.value) : ''}
                                                        onChange={(e) => {
                                                            const newList = [...formData.sub_contracts];
                                                            newList[scIndex] = { ...sc, value: parseVietnameseNumber(e.target.value) };
                                                            setFormData({...formData, sub_contracts: newList});
                                                        }}
                                                        className="w-full p-2.5 pr-12 border-2 border-slate-200 rounded-xl outline-none focus:border-indigo-500 bg-white text-slate-800 text-sm font-semibold text-blue-700"
                                                        placeholder="0"
                                                    />
                                                    <span className="absolute right-4 font-bold text-[10px] text-slate-400 pointer-events-none">VNĐ</span>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="block text-xs font-black text-slate-900">Giá trị Tạm ứng</label>
                                                <div className="relative flex items-center">
                                                    <input 
                                                        type="text"
                                                        value={sc.advance ? formatCurrency(sc.advance) : ''}
                                                        onChange={(e) => {
                                                            const newList = [...formData.sub_contracts];
                                                            newList[scIndex] = { ...sc, advance: parseVietnameseNumber(e.target.value) };
                                                            setFormData({...formData, sub_contracts: newList});
                                                        }}
                                                        className="w-full p-2.5 pr-12 border-2 border-slate-200 rounded-xl outline-none focus:border-indigo-500 bg-white text-slate-800 text-sm font-semibold text-amber-600"
                                                        placeholder="0"
                                                    />
                                                    <span className="absolute right-4 font-bold text-[10px] text-slate-400 pointer-events-none">VNĐ</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Phụ lục cho HĐ phụ */}
                                        <div className="pl-6 border-l-2 border-indigo-100 space-y-3">
                                            <h5 className="text-xs font-bold text-slate-600">Phụ lục của HĐ phụ: {sc.sub_contract_no || 'Chưa nhập số HĐ'}</h5>
                                            {(sc.annexes || []).map((annex, axIndex) => (
                                                <div key={axIndex} className="flex items-center gap-3 relative">
                                                    <div className="flex-1 space-y-1">
                                                        <input 
                                                            type="text"
                                                            value={annex.annex_no || ''}
                                                            onChange={(e) => {
                                                                const newList = [...formData.sub_contracts];
                                                                const newAnnexes = [...(sc.annexes || [])];
                                                                newAnnexes[axIndex] = { ...annex, annex_no: e.target.value };
                                                                newList[scIndex] = { ...sc, annexes: newAnnexes };
                                                                setFormData({...formData, sub_contracts: newList});
                                                            }}
                                                            className="w-full p-2 border-2 border-slate-200 rounded-lg outline-none focus:border-indigo-500 bg-white text-slate-800 text-xs font-semibold"
                                                            placeholder="Số phụ lục..."
                                                        />
                                                    </div>
                                                    <div className="flex-1 relative">
                                                        <input 
                                                            type="text"
                                                            value={annex.value ? formatCurrency(annex.value) : ''}
                                                            onChange={(e) => {
                                                                const newList = [...formData.sub_contracts];
                                                                const newAnnexes = [...(sc.annexes || [])];
                                                                newAnnexes[axIndex] = { ...annex, value: parseVietnameseNumber(e.target.value) };
                                                                newList[scIndex] = { ...sc, annexes: newAnnexes };
                                                                setFormData({...formData, sub_contracts: newList});
                                                            }}
                                                            className="w-full p-2 pr-12 border-2 border-slate-200 rounded-lg outline-none focus:border-indigo-500 bg-white text-slate-800 text-xs font-semibold text-orange-600"
                                                            placeholder="Giá trị trước thuế..."
                                                        />
                                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-[9px] text-slate-400 pointer-events-none">VNĐ</span>
                                                    </div>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => {
                                                            const newList = [...formData.sub_contracts];
                                                            const newAnnexes = [...(sc.annexes || [])];
                                                            newAnnexes.splice(axIndex, 1);
                                                            newList[scIndex] = { ...sc, annexes: newAnnexes };
                                                            setFormData({...formData, sub_contracts: newList});
                                                        }}
                                                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                                        title="Xóa phụ lục này"
                                                    >
                                                        <Trash2 size={14}/>
                                                    </button>
                                                </div>
                                            ))}
                                            <button 
                                                type="button"
                                                onClick={() => {
                                                    const newList = [...formData.sub_contracts];
                                                    const newAnnexes = [...(sc.annexes || []), { annex_no: '', value: 0 }];
                                                    newList[scIndex] = { ...sc, annexes: newAnnexes };
                                                    setFormData({...formData, sub_contracts: newList});
                                                }}
                                                className="text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1 text-[11px] bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition"
                                            >
                                                <Plus size={14} /> Thêm Phụ Lục cho HĐ phụ
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <button 
                                    type="button"
                                    onClick={() => setFormData({...formData, sub_contracts: [...(formData.sub_contracts || []), { sub_contract_no: '', value: 0, advance: 0, annexes: [] }]})}
                                    className="text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1 text-sm bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition"
                                >
                                    <Plus size={16} /> Thêm Hợp Đồng Phụ
                                </button>
                            </div>
                            <div className="md:col-span-2 flex justify-between gap-3 pt-6 mt-2 border-t">
                                {editingProject && currentUser?.role?.toUpperCase() === 'ADMIN' ? (
                                    <button type="button" onClick={() => handleDelete(editingProject)} className="px-6 py-2.5 rounded-xl font-bold text-red-500 hover:bg-red-50 transition flex items-center gap-2"><Trash2 size={18}/> XÓA</button>
                                ) : <div></div>}
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition">Hủy bỏ</button>
                                    <button type="submit" disabled={isLoading} className="bg-indigo-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-lg transition flex items-center gap-2">
                                        <Save size={18} /> LƯU THÔNG TIN
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {!isAdding && (
                <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row items-center gap-4 justify-between">
                    <div className="flex-1 w-full relative">
                        <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
                        <input 
                            type="text"
                            placeholder="Tìm theo tên công trình, địa chỉ, chỉ huy trưởng, số hợp đồng..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 focus:bg-white transition"
                            autoComplete="off"
                        />
                    </div>
                    <div className="flex items-center gap-2 border border-slate-200 rounded-2xl p-1 bg-slate-50">
                        <button 
                            onClick={() => { setViewMode('grid'); localStorage.setItem('project_view_mode', 'grid'); }}
                            className={`px-4 py-2 text-xs font-bold rounded-xl transition ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Dạng Thẻ
                        </button>
                        <button 
                            onClick={() => { setViewMode('table'); localStorage.setItem('project_view_mode', 'table'); }}
                            className={`px-4 py-2 text-xs font-bold rounded-xl transition ${viewMode === 'table' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Dạng Bảng
                        </button>
                    </div>
                </div>
            )}

            {viewMode === 'table' ? (
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full border-collapse text-left text-sm text-slate-700">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase font-black text-[11px] tracking-wider">
                                    <th className="p-4 pl-6">Công trình</th>
                                    <th className="p-4">Địa chỉ</th>
                                    <th className="p-4">Số HĐ</th>
                                    <th className="p-4">Chỉ Huy Trưởng</th>
                                    <th className="p-4 text-right">Giá trị HĐ</th>
                                    <th className="p-4 text-right">Phụ Lục HĐ</th>
                                    <th className="p-4 text-right">Tạm ứng</th>
                                    <th className="p-4 text-center">Trạng thái</th>
                                    <th className="p-4 text-center pr-6">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredProjects.map(p => {
                                    const details = projectDetails[p.name] || {};
                                    const isCompleted = p.status === 'Finish';
                                    const canEdit = currentUser?.role?.toUpperCase() === 'ADMIN' || !isCompleted;
                                    
                                    return (
                                        <tr key={p.id} className={`hover:bg-slate-50/50 transition-colors ${isCompleted ? 'bg-slate-50/30' : ''}`}>
                                            <td className="p-4 pl-6 font-bold text-slate-800">
                                                <div className="flex flex-col">
                                                    <span className="text-sm">{p.name}</span>
                                                    <span className="text-xs text-slate-400 mt-1 font-bold">{details.projectType || 'TRỰC TIẾP ORDER'}</span>
                                                    {(details.generalContractor || details.investor) && (
                                                        <span className="text-[10px] text-indigo-600 mt-1 font-bold">
                                                            {details.generalContractor ? `Tổng thầu: ${details.generalContractor}` : ''}
                                                            {details.generalContractor && details.investor ? ' | ' : ''}
                                                            {details.investor ? `CĐT: ${details.investor}` : ''}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm text-slate-500 max-w-[200px] truncate" title={details.address}>{details.address || '---'}</td>
                                            <td className="p-4 font-mono text-sm text-slate-500">
                                                {(() => {
                                                    if (!details.contractNo) return '---';
                                                    try {
                                                        if (details.contractNo.startsWith('{')) {
                                                            const parsed = JSON.parse(details.contractNo);
                                                            const parts = [];
                                                            if (parsed.main_contract) parts.push(`Chính: ${parsed.main_contract}`);
                                                            if (parsed.sub_contracts && parsed.sub_contracts.length > 0) {
                                                                parsed.sub_contracts.forEach((sc, i) => {
                                                                    let scText = `Phụ ${i + 1}: ${sc.sub_contract_no}`;
                                                                    if (sc.annexes && sc.annexes.length > 0) {
                                                                        const axNos = sc.annexes.map(a => a.annex_no).filter(Boolean).join(', ');
                                                                        if (axNos) scText += ` (PL: ${axNos})`;
                                                                    }
                                                                    parts.push(scText);
                                                                });
                                                            }
                                                            return parts.length > 0 ? parts.map((p, i) => <div key={i}>{p}</div>) : '---';
                                                        }
                                                    } catch(e) {}
                                                    return details.contractNo;
                                                })()}
                                            </td>
                                            <td className="p-4 text-sm font-semibold text-slate-600">
                                                {details.chtName ? (
                                                    <div className="flex flex-col gap-1">
                                                        {(details.chtName || '').split(',').map((name, i) => (
                                                            <span key={i} className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-sm w-fit font-bold">
                                                                {name.trim()}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : '---'}
                                            </td>
                                            <td className="p-4 text-right text-sm font-bold text-blue-700">{formatCurrency(details.totalContractAndPlhd)} VNĐ</td>
                                            <td className="p-4 text-right text-sm font-bold text-orange-600">{formatCurrency((details.debtToCollect || 0) + (details.extraPlhdTotal || 0) + (details.subContractsAnnexesTotal || 0))} VNĐ</td>
                                            <td className="p-4 text-right text-sm font-bold text-amber-600">{formatCurrency(details.advanceValue)} VNĐ</td>
                                            <td className="p-4 text-center">
                                                <span className={`text-sm px-2 py-1 rounded-full font-black ${isCompleted ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
                                                    {isCompleted ? '🔒 Finish' : '⚙️ Doing'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center pr-6">
                                                <div className="flex justify-center gap-1">
                                                    {canEdit ? (
                                                        <button 
                                                            onClick={() => handleOpenEdit(p)} 
                                                            className="text-slate-400 hover:text-indigo-600 p-2 rounded-lg hover:bg-indigo-50 transition" 
                                                            title="Sửa công trình"
                                                        >
                                                            <Edit3 size={16} />
                                                        </button>
                                                    ) : (
                                                        <span className="p-2 text-red-500 cursor-not-allowed" title="Công trình đã hoàn thành (Khóa sổ) - Chỉ ADMIN mới có thể sửa">
                                                            🔒
                                                        </span>
                                                    )}
                                                    {currentUser?.role?.toUpperCase() === 'ADMIN' && (
                                                        <button 
                                                            onClick={() => handleDelete(p.name)} 
                                                            className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition" 
                                                            title="Xóa công trình"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredProjects.length === 0 ? (
                        <div className="md:col-span-2 bg-white p-12 text-center rounded-2xl border border-dashed border-slate-300 text-slate-400 font-bold">
                            Không tìm thấy công trình nào khớp với từ khóa.
                        </div>
                    ) : (
                        filteredProjects.map(p => {
                            const details = projectDetails[p.name] || {};
                            const isCompleted = p.status === 'Finish';
                            const canEdit = currentUser?.role?.toUpperCase() === 'ADMIN' || !isCompleted;
                            return (
                                <div key={p.id} className={`bg-white rounded-2xl border p-6 hover:border-indigo-300 hover:shadow-md transition group ${isCompleted ? 'border-slate-200 bg-slate-50/50' : 'border-slate-200'}`}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`p-3 rounded-xl transition ${isCompleted ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white'}`}>
                                            <Building2 size={24} />
                                        </div>
                                        <div className="flex gap-1">
                                            {canEdit ? (
                                                <button onClick={() => handleOpenEdit(p)} className="text-slate-400 hover:text-indigo-600 p-2 rounded-lg hover:bg-indigo-50 transition" title="Sửa công trình">
                                                    <Edit3 size={18} />
                                                </button>
                                            ) : (
                                                <span className="p-2 text-red-500" title="Công trình đã hoàn thành (Khóa sổ) - Chỉ ADMIN mới có thể sửa">
                                                    🔒
                                                </span>
                                            )}
                                            {currentUser?.role?.toUpperCase() === 'ADMIN' && (
                                                <button onClick={() => handleDelete(p.name)} className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition" title="Xóa công trình">
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <h3 className="text-lg font-black text-slate-900 mb-1 flex items-center gap-2">
                                        {p.name}
                                    </h3>
                                    <div className="mb-3 flex items-center gap-2">
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${details.projectType === 'TỔNG THẦU MUA HỘ' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                            {details.projectType || 'TRỰC TIẾP ORDER'}
                                        </span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${isCompleted ? 'bg-red-100 text-red-700 border-red-200' : 'bg-green-100 text-green-700 border-green-200'}`}>
                                            {isCompleted ? '🔒 Finish' : '⚙️ Doing'}
                                        </span>
                                    </div>
                                    <div className="space-y-2 text-sm">
                                        {details.address && (
                                            <div className="flex justify-between border-b border-slate-50 pb-2">
                                                <span className="text-slate-400 flex items-center gap-1">📍 Địa chỉ:</span>
                                                <span className="font-bold text-slate-700 truncate max-w-[250px]" title={details.address}>{details.address}</span>
                                            </div>
                                        )}
                                        {details.generalContractor && (
                                            <div className="flex justify-between border-b border-slate-50 pb-2">
                                                <span className="text-slate-400 flex items-center gap-1">🏢 Tổng thầu:</span>
                                                <span className="font-bold text-slate-700 truncate max-w-[250px]" title={details.generalContractor}>{details.generalContractor}</span>
                                            </div>
                                        )}
                                        {details.investor && (
                                            <div className="flex justify-between border-b border-slate-50 pb-2">
                                                <span className="text-slate-400 flex items-center gap-1">👤 Chủ đầu tư:</span>
                                                <span className="font-bold text-slate-700 truncate max-w-[250px]" title={details.investor}>{details.investor}</span>
                                            </div>
                                        )}
                                        {(details.chtName || details.chtPhone) && (
                                            <div className="flex justify-between border-b border-slate-50 pb-2">
                                                <span className="text-slate-400 flex items-center gap-1 whitespace-nowrap min-w-[140px]">👷 Chỉ Huy Trưởng:</span>
                                                <div className="flex flex-col items-end gap-1 text-right max-w-full">
                                                    {(details.chtName || '').split(',').map(s => s.trim()).filter(Boolean).map((name, i) => {
                                                        const phone = (details.chtPhone || '').split(',').map(s => s.trim())[i] || '';
                                                        return (
                                                            <span key={i} className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md break-words whitespace-normal text-right inline-block w-full text-xs">
                                                                {name} {phone ? `(${phone})` : ''}
                                                            </span>
                                                        );
                                                    })}
                                                    {!(details.chtName || '').trim() && <span className="font-bold text-slate-700">---</span>}
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex justify-between border-b border-slate-50 pb-2">
                                            <span className="text-slate-400 flex items-center gap-1"><FileText size={14}/> Số HĐ:</span>
                                            <span className="font-bold text-slate-700">
                                                {(() => {
                                                    if (!details.contractNo) return '---';
                                                    try {
                                                        if (details.contractNo.startsWith('{')) {
                                                            const parsed = JSON.parse(details.contractNo);
                                                            const parts = [];
                                                            if (parsed.main_contract) parts.push(`Chính: ${parsed.main_contract}`);
                                                            if (parsed.sub_contracts && parsed.sub_contracts.length > 0) {
                                                                parsed.sub_contracts.forEach((sc, i) => {
                                                                    let scText = `Phụ ${i + 1}: ${sc.sub_contract_no}`;
                                                                    if (sc.annexes && sc.annexes.length > 0) {
                                                                        const axNos = sc.annexes.map(a => a.annex_no).filter(Boolean).join(', ');
                                                                        if (axNos) scText += ` (PL: ${axNos})`;
                                                                    }
                                                                    parts.push(scText);
                                                                });
                                                            }
                                                            return parts.length > 0 ? parts.join(' | ') : '---';
                                                        }
                                                    } catch(e) {}
                                                    return details.contractNo;
                                                })()}
                                            </span>
                                        </div>
                                        <div className="flex justify-between border-b border-slate-50 pb-2">
                                            <span className="text-slate-400 flex items-center gap-1"><Coins size={14} className="text-slate-400" /> Giá trị HĐ:</span>
                                            <span className="font-bold text-blue-700">{formatCurrency(details.totalContractAndPlhd)} VNĐ</span>
                                        </div>
                                        <div className="flex justify-between border-b border-slate-50 pb-2">
                                            <span className="text-slate-400 flex items-center gap-1"><Coins size={14} className="text-slate-400" /> Giá trị PLHĐ:</span>
                                            <span className="font-bold text-orange-600">{formatCurrency((details.debtToCollect || 0) + (details.extraPlhdTotal || 0) + (details.subContractsAnnexesTotal || 0))} VNĐ</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400 flex items-center gap-1"><Coins size={14} className="text-slate-400" /> Tạm ứng:</span>
                                            <span className="font-bold text-amber-600">{formatCurrency(details.advanceValue)} VNĐ</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            <div className="mt-8 text-sm font-bold text-slate-500 bg-white p-4 rounded-2xl border border-slate-200 text-center">
                Tổng số: <span className="text-slate-800 font-extrabold">{totalItems}</span> công trình
            </div>

            {deleteModal.isOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div style={{ display: 'none' }}>
                        <input type="text" name="dummy-username" autoComplete="username" />
                        <input type="password" name="dummy-password" autoComplete="current-password" />
                    </div>
                    <form 
                        onSubmit={(e) => { e.preventDefault(); confirmDelete(); }}
                        autoComplete="off"
                        className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 text-left"
                    >
                        <h3 className="text-lg font-black text-slate-900 mb-2 flex items-center gap-2 text-red-600">
                            ⚠ Xác nhận xóa công trình
                        </h3>
                        <p className="text-slate-500 text-sm mb-4 leading-relaxed font-semibold">
                            Bạn đang yêu cầu xóa công trình <span className="font-extrabold text-slate-800">"{deleteModal.projectName}"</span>. 
                            Hành động này sẽ xóa vĩnh viễn công trình và chuyển tất cả các chứng từ liên quan (nếu có) vào thùng rác. 
                            Để tiếp tục, vui lòng nhập mật khẩu xác nhận của Admin:
                        </p>
                        <div className="mb-6">
                            <input 
                                type="password" 
                                placeholder="Nhập mật khẩu Admin..." 
                                value={deleteModal.password}
                                onChange={(e) => setDeleteModal(prev => ({ ...prev, password: e.target.value }))}
                                className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none focus:border-red-500 font-bold bg-slate-50 text-slate-800"
                                autoFocus
                                autoComplete="new-password"
                            />
                        </div>
                        <div className="flex justify-end gap-3">
                            <button 
                                type="button" 
                                onClick={() => setDeleteModal({ isOpen: false, projectName: '', password: '' })} 
                                className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition text-sm"
                            >
                                Hủy bỏ
                            </button>
                            <button 
                                type="submit"
                                className="bg-red-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-600/20 transition text-sm flex items-center gap-2"
                            >
                                <Trash2 size={16} /> XÁC NHẬN XÓA
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
