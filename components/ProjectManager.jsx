'use client';

import React, { useState } from 'react';
import { Plus, Edit3, Save, Trash2, Building2, FileText, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function ProjectManager({ projects, projectDetails, onUpsertProject, onDeleteProject, isLoading, usersList = [] }) {
    const [isAdding, setIsAdding] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        contract_no: '',
        contract_value_after_tax: 0,
        advance_value: 0,
        address: '',
        cht_name: '',
        cht_phone: '',
        debt_to_collect: 0
    });

    const handleOpenEdit = (p) => {
        const details = projectDetails[p.name] || {};
        setEditingProject(p.name);
        setFormData({
            name: p.name,
            contract_no: details.contractNo || '',
            contract_value_after_tax: details.contractValueAfterTax || 0,
            advance_value: details.advanceValue || 0,
            address: details.address || '',
            cht_name: details.chtName || '',
            cht_phone: details.chtPhone || '',
            debt_to_collect: details.debtToCollect || 0
        });
        setIsAdding(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onUpsertProject(formData, !!editingProject);
        setIsAdding(false);
        setEditingProject(null);
        setFormData({ name: '', contract_no: '', contract_value_after_tax: 0, advance_value: 0, debt_to_collect: 0, address: '', cht_name: '', cht_phone: '' });
    };

    return (
        <div className="max-w-5xl mx-auto animate-in fade-in duration-500">
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Building2 className="text-indigo-600" /> Quản Lý Công Trình
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Khởi tạo và cập nhật thông tin hợp đồng cho từng dự án.</p>
                </div>
                {!isAdding && (
                    <button 
                        onClick={() => { setIsAdding(true); setEditingProject(null); }}
                        className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-lg transition"
                    >
                        <Plus size={18} /> THÊM CÔNG TRÌNH MỚI
                    </button>
                )}
            </header>

            {isAdding && (
                <div className="bg-white rounded-2xl shadow-xl border border-indigo-100 p-8 mb-8 animate-in zoom-in-95 duration-200">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        {editingProject ? <Edit3 size={18} /> : <Plus size={18} />} 
                        {editingProject ? `Chỉnh sửa: ${editingProject}` : 'Thông tin Công trình mới'}
                    </h3>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="block text-sm font-black text-slate-900">Tên công trình / Dự án</label>
                            <input 
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                disabled={!!editingProject}
                                className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none focus:border-indigo-500 bg-slate-50 font-bold"
                                placeholder="Ví dụ: Biệt thự Anh A..."
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-black text-slate-900">Số Hợp đồng</label>
                            <input 
                                type="text"
                                value={formData.contract_no}
                                onChange={(e) => setFormData({...formData, contract_no: e.target.value})}
                                className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none focus:border-indigo-500 bg-slate-50"
                                placeholder="Số/Ký hiệu HĐ..."
                            />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <label className="block text-sm font-black text-slate-900">Địa chỉ công trình</label>
                            <input 
                                type="text"
                                value={formData.address}
                                onChange={(e) => setFormData({...formData, address: e.target.value})}
                                className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none focus:border-indigo-500 bg-slate-50"
                                placeholder="Địa chỉ cụ thể của dự án..."
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-black text-slate-900">Chọn Chỉ Huy Trưởng (từ danh sách Nhân viên)</label>
                            <select 
                                value={formData.cht_name}
                                onChange={(e) => {
                                    const selectedName = e.target.value;
                                    const user = usersList.find(u => u.name === selectedName);
                                    setFormData({
                                        ...formData, 
                                        cht_name: selectedName,
                                        cht_phone: user ? (user.phone || '') : ''
                                    });
                                }}
                                className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none focus:border-indigo-500 bg-slate-50 font-bold"
                            >
                                <option value="">-- Chọn Chỉ Huy Trưởng --</option>
                                {usersList.filter(u => u.role !== 'ADMIN' && u.role !== 'KẾ TOÁN' && u.role !== 'THƯ KÝ').map(u => (
                                    <option key={u.id} value={u.name}>{u.name} ({u.role})</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-black text-slate-900">SĐT Chỉ Huy Trưởng (Tự động điền)</label>
                            <input 
                                type="text"
                                value={formData.cht_phone}
                                readOnly
                                className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none bg-slate-100 font-mono text-slate-500"
                                placeholder="SĐT tự động lấy từ thông tin tài khoản..."
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-black text-slate-900">Giá trị HĐ (Trước thuế)</label>
                            <input 
                                type="number"
                                value={formData.contract_value_after_tax === 0 ? '' : formData.contract_value_after_tax}
                                onChange={(e) => setFormData({...formData, contract_value_after_tax: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                                className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none focus:border-indigo-500 bg-slate-50 font-bold text-blue-700"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-black text-slate-900">Giá trị Tạm ứng</label>
                            <input 
                                type="number"
                                value={formData.advance_value === 0 ? '' : formData.advance_value}
                                onChange={(e) => setFormData({...formData, advance_value: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                                className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none focus:border-indigo-500 bg-slate-50 font-bold text-amber-600"
                            />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <label className="block text-sm font-black text-slate-900">Công nợ cần thu (Đã lên HS thanh toán nhưng tiền chưa về)</label>
                            <input 
                                type="number"
                                value={formData.debt_to_collect === 0 ? '' : formData.debt_to_collect}
                                onChange={(e) => setFormData({...formData, debt_to_collect: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                                className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none focus:border-indigo-500 bg-slate-50 font-bold text-orange-600"
                                placeholder="Nhập số tiền..."
                            />
                        </div>
                        <div className="md:col-span-2 flex justify-between gap-3 pt-4 border-t">
                            {editingProject ? (
                                <button type="button" onClick={() => { if(window.confirm('Chắc chắn xóa công trình này?')) { onDeleteProject(editingProject); setIsAdding(false); } }} className="px-6 py-2.5 rounded-xl font-bold text-red-500 hover:bg-red-50 transition flex items-center gap-2"><Trash2 size={18}/> XÓA</button>
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
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projects.map(p => {
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
                                    <button onClick={() => { if(window.confirm('Chắc chắn xóa công trình này?')) onDeleteProject(p.name); }} className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition" title="Xóa công trình">
                                        <Trash2 size={18} />
                                    </button>
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
                                    <span className="text-slate-400 flex items-center gap-1"><DollarSign size={14}/> Giá trị HĐ:</span>
                                    <span className="font-bold text-blue-700">{formatCurrency(details.contractValueAfterTax)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400 flex items-center gap-1"><DollarSign size={14}/> Tạm ứng:</span>
                                    <span className="font-bold text-amber-600">{formatCurrency(details.advanceValue)}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
