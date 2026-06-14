import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { INITIAL_DATA } from './EmployeeSalary';

export default function UserModal({ isOpen, user, onClose, onSave }) {
    const [employees, setEmployees] = useState([]);
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        name: '',
        role: 'QS',
        phone: '',
        password: '1'
    });

    useEffect(() => {
        const fetchEmployees = async () => {
            const { data } = await supabase.from('employees').select('name');
            if (data && data.length > 0) {
                setEmployees(data.filter(e => e.name).map(e => e.name));
            } else {
                setEmployees(INITIAL_DATA.filter(e => !e.isDepartment && e.name).map(e => e.name));
            }
        };
        if (isOpen) {
            fetchEmployees();
        }
    }, [isOpen]);

    useEffect(() => {
        if (user) {
            setFormData({
                username: user.username || '',
                name: user.name || '',
                role: user.role || 'QS',
                phone: user.phone || '',
                password: user.password || ''
            });
            if (user.name && employees.length > 0 && !employees.includes(user.name)) {
                setShowCustomInput(true);
            } else {
                setShowCustomInput(false);
            }
        } else {
            setFormData({
                username: '',
                name: '',
                role: 'QS',
                phone: '',
                password: '1'
            });
            setShowCustomInput(false);
        }
    }, [user, isOpen, employees]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="text-xl font-black text-slate-800">{user ? 'Chỉnh Sửa Nhân Viên' : 'Thêm Nhân Viên Mới'}</h3>
                    <button type="button" onClick={onClose} className="p-2 bg-slate-200 hover:bg-slate-300 rounded-full transition text-slate-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 uppercase">Tài khoản (viết liền không dấu)</label>
                        <input type="text" required value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-mono transition" placeholder="Ví dụ: nva" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 uppercase">Tên hiển thị</label>
                        <select required={!showCustomInput} value={showCustomInput ? 'Khác...' : formData.name} onChange={(e) => {
                            if (e.target.value === 'Khác...') {
                                setShowCustomInput(true);
                                setFormData({...formData, name: ''});
                            } else {
                                setShowCustomInput(false);
                                setFormData({...formData, name: e.target.value});
                            }
                        }} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-bold transition">
                            <option value="">-- Chọn Nhân Viên --</option>
                            {employees.map(empName => (
                                <option key={empName} value={empName}>{empName}</option>
                            ))}
                            <option value="Khác...">Khác (Tự nhập mới)...</option>
                            {/* Cho phép giữ nguyên tên nếu user cũ không nằm trong danh sách nhân viên */}
                            {formData.name && !employees.includes(formData.name) && !showCustomInput && (
                                <option value={formData.name}>{formData.name}</option>
                            )}
                        </select>
                        {showCustomInput && (
                            <input type="text" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-bold transition animate-in slide-in-from-top-2" placeholder="Nhập tên hiển thị mới..." autoFocus />
                        )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 uppercase">Chức vụ</label>
                            <select value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-bold transition">
                                <option value="ADMIN">ADMIN</option>
                                <option value="GIÁM ĐỐC">GIÁM ĐỐC</option>
                                <option value="PHÓ GĐ">PHÓ GĐ</option>
                                <option value="KẾ TOÁN">KẾ TOÁN</option>
                                <option value="QS">QS</option>
                                <option value="GS">GS</option>
                                <option value="CHT">CHT</option>
                                <option value="THƯ KÝ">THƯ KÝ</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 uppercase">Số điện thoại</label>
                            <input type="text" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-mono transition" placeholder="Tùy chọn" />
                        </div>
                    </div>
                    {!user && (
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 uppercase">Mật khẩu mặc định</label>
                            <input type="text" required value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-mono transition" />
                        </div>
                    )}
                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition">Hủy</button>
                        <button type="submit" className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition">
                            {user ? 'Lưu Thay Đổi' : 'Thêm Nhân Viên'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
