'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Edit3, Save, Trash2, Building2, FileText, Coins, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency, parseVietnameseNumber } from '@/lib/utils';

export default function ProjectManager({ currentUser, projects, projectDetails, onUpsertProject, onDeleteProject, isLoading, usersList = [] }) {
    const [isAdding, setIsAdding] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({
        original_name: '',
        name: '',
        contract_no: '',
        contract_value_after_tax: 0,
        address: '',
        cht_name: '',
        cht_phone: '',
        debt_to_collect: 0,
        plhd_list: []
    });

    const [currentPage, setCurrentPage] = useState(1);
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, projectName: '', password: '' });
    const itemsPerPage = 6;

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const handleOpenEdit = (p) => {
        const details = projectDetails[p.name] || {};
        setEditingProject(p.name);
        setFormData({
            original_name: p.name,
            name: p.name,
            contract_no: details.contractNo || '',
            contract_value_after_tax: details.contractValueAfterTax || 0,
            address: details.address || '',
            cht_name: details.chtName || '',
            cht_phone: details.chtPhone || '',
            debt_to_collect: details.debtToCollect || 0,
            plhd_list: p.plhds || []
        });
        setIsAdding(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onUpsertProject(formData, !!editingProject);
        setIsAdding(false);
        setEditingProject(null);
        setFormData({ original_name: '', name: '', contract_no: '', contract_value_after_tax: 0, debt_to_collect: 0, address: '', cht_name: '', cht_phone: '', plhd_list: [] });
    };

    const handleDelete = (projectName) => {
        if (currentUser?.role?.toUpperCase() !== 'ADMIN') {
            alert('Chỉ Admin mới có quyền xóa công trình!');
            return;
        }
        setDeleteModal({ isOpen: true, projectName, password: '' });
    };

    const confirmDelete = () => {
        if (deleteModal.password !== '123456') {
            alert('Mật khẩu không đúng!');
            return;
        }
        onDeleteProject(deleteModal.projectName);
        setDeleteModal({ isOpen: false, projectName: '', password: '' });
        setIsAdding(false);
    };


    // Sắp xếp theo thời gian từ gần tới xa (Mới nhất xếp đầu)
    const sortedProjects = [...projects].sort((a, b) => {
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
            (details.contractNo || '').toLowerCase().includes(term)
        );
    });

    const totalItems = filteredProjects.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedProjects = filteredProjects.slice(startIndex, startIndex + itemsPerPage);

    return (
        <div className="max-w-6xl mx-auto animate-in fade-in duration-500 relative">
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
                        setFormData({ original_name: '', name: '', contract_no: '', contract_value_after_tax: 0, debt_to_collect: 0, address: '', cht_name: '', cht_phone: '', plhd_list: [] });
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
                                <label className="block text-sm font-black text-slate-900">Số hợp đồng</label>
                                <input 
                                    type="text"
                                    value={formData.contract_no}
                                    onChange={(e) => setFormData({...formData, contract_no: e.target.value})}
                                    className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none focus:border-indigo-500 bg-slate-50 text-slate-800"
                                    placeholder="Ví dụ: HĐ-01/2026..."
                                />
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
                                <label className="block text-sm font-black text-slate-900">Chỉ Huy Trưởng (CHT)</label>
                                <select 
                                    value={formData.cht_name}
                                    onChange={(e) => {
                                        const selectedCht = usersList.find(u => u.name === e.target.value);
                                        setFormData({
                                            ...formData, 
                                            cht_name: e.target.value,
                                            cht_phone: selectedCht?.phone || ''
                                        });
                                    }}
                                    className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none focus:border-indigo-500 bg-slate-50 text-slate-800"
                                >
                                    <option value="">-- Chọn Chỉ Huy Trưởng --</option>
                                    {usersList.filter(u => u.role !== 'ADMIN' && u.role !== 'KẾ TOÁN' && u.role !== 'THƯ KÝ').map(u => (
                                        <option key={u.id} value={u.name}>{u.name} ({u.role})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-black text-slate-900">SĐT Chỉ Huy Trưởng</label>
                                <input 
                                    type="text"
                                    value={formData.cht_phone}
                                    readOnly
                                    className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none bg-slate-100 text-slate-500"
                                />
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
                <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
                        <input 
                            type="text"
                            placeholder="Tìm theo tên công trình, địa chỉ, chỉ huy trưởng, số hợp đồng..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 focus:bg-white transition"
                        />
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredProjects.length === 0 ? (
                    <div className="md:col-span-2 bg-white p-12 text-center rounded-2xl border border-dashed border-slate-300 text-slate-400 font-bold">
                        Không tìm thấy công trình nào khớp với từ khóa.
                    </div>
                ) : (
                    paginatedProjects.map(p => {
                        const details = projectDetails[p.name] || {};
                        return (
                            <div key={p.id} className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-indigo-300 hover:shadow-md transition group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition">
                                        <Building2 size={24} />
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleOpenEdit(p)} className="text-slate-400 hover:text-indigo-600 p-2 rounded-lg hover:bg-indigo-50 transition" title="Sửa công trình">
                                            <Edit3 size={18} />
                                        </button>
                                        {currentUser?.role?.toUpperCase() === 'ADMIN' && (
                                            <button onClick={() => handleDelete(p.name)} className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition" title="Xóa công trình">
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <h3 className="text-lg font-black text-slate-900 mb-2">{p.name}</h3>
                                <div className="space-y-2 text-sm">
                                    {details.address && (
                                        <div className="flex justify-between border-b border-slate-50 pb-2">
                                            <span className="text-slate-400 flex items-center gap-1">📍 Địa chỉ:</span>
                                            <span className="font-bold text-slate-700 truncate max-w-[250px]" title={details.address}>{details.address}</span>
                                        </div>
                                    )}
                                    {(details.chtName || details.chtPhone) && (
                                        <div className="flex justify-between border-b border-slate-50 pb-2">
                                            <span className="text-slate-400 flex items-center gap-1">👷 Chỉ Huy Trưởng:</span>
                                            <span className="font-bold text-slate-700">
                                                {details.chtName || '---'} {details.chtPhone ? `(${details.chtPhone})` : ''}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex justify-between border-b border-slate-50 pb-2">
                                        <span className="text-slate-400 flex items-center gap-1"><FileText size={14}/> Số HĐ:</span>
                                        <span className="font-bold text-slate-700">{details.contractNo || '---'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-50 pb-2">
                                        <span className="text-slate-400 flex items-center gap-1"><Coins size={14} className="text-slate-400" /> Giá trị HĐ:</span>
                                        <span className="font-bold text-blue-700">{formatCurrency(details.contractValueAfterTax)} VNĐ</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-50 pb-2">
                                        <span className="text-slate-400 flex items-center gap-1"><Coins size={14} className="text-slate-400" /> Giá trị PLHĐ:</span>
                                        <span className="font-bold text-orange-600">{formatCurrency(details.debtToCollect)} VNĐ</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200">
                    <p className="text-sm font-bold text-slate-500">
                        Hiển thị <span className="text-slate-800">{startIndex + 1}</span> - <span className="text-slate-800">{Math.min(startIndex + itemsPerPage, totalItems)}</span> trên tổng số <span className="text-slate-800">{totalItems}</span> công trình
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center"
                            title="Trang trước"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        
                        {Array.from({ length: totalPages }, (_, idx) => idx + 1).map(pageNumber => (
                            <button
                                key={pageNumber}
                                onClick={() => setCurrentPage(pageNumber)}
                                className={`px-4 py-2 rounded-lg font-bold text-sm transition ${
                                    currentPage === pageNumber
                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                                        : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                {pageNumber}
                            </button>
                        ))}

                        <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center"
                            title="Trang sau"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
