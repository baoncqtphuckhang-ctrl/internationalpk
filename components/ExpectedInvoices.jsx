import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Plus, X, Edit2, Trash2, CheckCircle2, Search } from 'lucide-react';
import { formatCurrency, parseVietnameseNumber } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
export default function ExpectedInvoices({ projects, projectDetails, currentUser }) {
    const [invoices, setInvoices] = useState([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({
        projectName: '',
        preTaxValue: '',
        vatAmount: '',
        postTaxValue: '',
        phase: '',
        note: ''
    });

    // Load data from Supabase or localStorage
    useEffect(() => {
        fetchInvoices();
    }, []);

    const fetchInvoices = async () => {
        try {
            const { data, error } = await supabase
                .from('expected_invoices')
                .select('*')
                .order('created_at', { ascending: true });
            
            if (error) throw error;
            if (data && data.length > 0) {
                setInvoices(data);
            } else {
                loadFromLocal();
            }
        } catch (error) {
            console.warn('Supabase fetch failed. Falling back to localStorage.', error);
            loadFromLocal();
        } finally {
            setIsLoaded(true);
        }
    };

    const loadFromLocal = () => {
        const saved = localStorage.getItem('expected_invoices');
        if (saved) {
            try {
                setInvoices(JSON.parse(saved));
            } catch (e) {
                console.error('Error parsing expected invoices', e);
            }
        }
    };

    // Save to localStorage as a fallback backup
    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem('expected_invoices', JSON.stringify(invoices));
        }
    }, [invoices, isLoaded]);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleNumberChange = (e) => {
        const { name, value } = e.target;
        const val = parseVietnameseNumber(value);
        setFormData(prev => {
            const next = { ...prev, [name]: val };
            if (name === 'preTaxValue' || name === 'vatAmount') {
                const preTax = parseFloat(next.preTaxValue) || 0;
                const vat = parseFloat(next.vatAmount) || 0;
                if (preTax > 0 || vat > 0) {
                    next.postTaxValue = preTax + vat;
                }
            }
            return next;
        });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.projectName || !formData.postTaxValue) {
            alert('Vui lòng nhập đầy đủ tên công trình và giá trị!');
            return;
        }

        const preTax = parseFloat(formData.preTaxValue) || 0;
        const vat = parseFloat(formData.vatAmount) || 0;
        const postTax = parseFloat(formData.postTaxValue) || 0;

        try {
            if (editingId) {
                const { error } = await supabase
                    .from('expected_invoices')
                    .update({
                        projectName: formData.projectName,
                        preTaxValue: preTax,
                        vatAmount: vat,
                        postTaxValue: postTax,
                        phase: formData.phase,
                        note: formData.note
                    })
                    .eq('id', editingId);

                if (error) {
                    console.warn('Supabase update failed, updating locally', error);
                }

                setInvoices(prev => prev.map(inv => 
                    inv.id === editingId ? { 
                        ...inv, 
                        ...formData, 
                        preTaxValue: preTax,
                        vatAmount: vat,
                        postTaxValue: postTax 
                    } : inv
                ));
            } else {
                const newRecord = {
                    projectName: formData.projectName,
                    preTaxValue: preTax,
                    vatAmount: vat,
                    postTaxValue: postTax,
                    phase: formData.phase,
                    note: formData.note
                };

                const { data, error } = await supabase
                    .from('expected_invoices')
                    .insert([newRecord])
                    .select();

                if (error) {
                    console.warn('Supabase insert failed, inserting locally', error);
                    setInvoices(prev => [...prev, { id: Date.now().toString(), ...newRecord }]);
                } else if (data && data.length > 0) {
                    setInvoices(prev => [...prev, data[0]]);
                }
            }
            resetForm();
        } catch (error) {
            console.error('Error in handleSave:', error);
            alert('Có lỗi xảy ra khi lưu dữ liệu!');
        }
    };

    const resetForm = () => {
        setIsFormOpen(false);
        setEditingId(null);
        setFormData({ projectName: '', preTaxValue: '', vatAmount: '', postTaxValue: '', phase: '', note: '' });
    };

    const handleEdit = (inv) => {
        setFormData({
            projectName: inv.projectName,
            preTaxValue: inv.preTaxValue || '',
            vatAmount: inv.vatAmount || '',
            postTaxValue: inv.postTaxValue || inv.expectedValue || '',
            phase: inv.phase || '',
            note: inv.note || ''
        });
        setEditingId(inv.id);
        setIsFormOpen(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Bạn có chắc chắn muốn xóa mục này?')) {
            try {
                const { error } = await supabase
                    .from('expected_invoices')
                    .delete()
                    .eq('id', id);
                
                if (error) {
                    console.warn('Supabase delete failed, deleting locally', error);
                }
                setInvoices(prev => prev.filter(inv => inv.id !== id));
            } catch (error) {
                console.error('Error in handleDelete:', error);
            }
        }
    };

    const filteredInvoices = invoices.filter(inv => {
        const term = searchTerm.toLowerCase();
        return (
            (inv.projectName || '').toLowerCase().includes(term) ||
            (inv.phase || '').toLowerCase().includes(term) ||
            (inv.note || '').toLowerCase().includes(term) ||
            (projectDetails?.[inv.projectName]?.contractNo || '').toLowerCase().includes(term)
        );
    });

    return (
        <div className="max-w-6xl mx-auto animate-in fade-in duration-500 font-sans text-slate-800">
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-emerald-100 p-2 rounded-xl">
                            <FileSpreadsheet className="text-emerald-600" size={28} />
                        </div>
                        <h2 className="text-3xl font-black tracking-tight uppercase">Giá trị hóa đơn dự kiến</h2>
                    </div>
                    <p className="text-slate-500 text-sm mt-1">Quản lý và theo dõi các hóa đơn dự kiến của công trình</p>
                </div>
                
                <button 
                    onClick={() => { resetForm(); setIsFormOpen(true); }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                >
                    <Plus size={20} />
                    Thêm mới
                </button>
            </header>

            <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
                    <input 
                        type="text"
                        placeholder="Tìm kiếm công trình, đợt, số hợp đồng, ghi chú..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold outline-none focus:border-emerald-500 focus:bg-white transition"
                    />
                </div>
            </div>

            {isFormOpen && (
                <div className="bg-white rounded-2xl shadow-xl border border-slate-200 mb-8 overflow-hidden animate-in slide-in-from-top-4">
                    <div className="bg-slate-900 px-6 py-4 flex justify-between items-center">
                        <h3 className="text-white font-bold text-lg">{editingId ? 'Cập nhật' : 'Thêm mới'} hóa đơn dự kiến</h3>
                        <button onClick={resetForm} className="text-slate-400 hover:text-white transition"><X /></button>
                    </div>
                    <form onSubmit={handleSave} className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">Tên công trình *</label>
                                <select 
                                    name="projectName" 
                                    value={formData.projectName}
                                    onChange={handleFormChange}
                                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition"
                                    required
                                >
                                    <option value="">-- Chọn công trình --</option>
                                    {projects.map(p => (
                                        <option key={p.id} value={p.name}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">Đợt</label>
                                <input 
                                    type="text" 
                                    name="phase" 
                                    value={formData.phase}
                                    onChange={handleFormChange}
                                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition"
                                    placeholder="Ví dụ: Đợt 1"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">Giá trị trước thuế</label>
                                <input 
                                    type="text" 
                                    name="preTaxValue" 
                                    value={formData.preTaxValue ? formatCurrency(formData.preTaxValue) : ''}
                                    onChange={handleNumberChange}
                                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition"
                                    placeholder="Ví dụ: 150,000,000"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">Thuế VAT</label>
                                <input 
                                    type="text" 
                                    name="vatAmount" 
                                    value={formData.vatAmount ? formatCurrency(formData.vatAmount) : ''}
                                    onChange={handleNumberChange}
                                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition"
                                    placeholder="Ví dụ: 15,000,000"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">Giá trị sau thuế *</label>
                                <input 
                                    type="text" 
                                    name="postTaxValue" 
                                    value={formData.postTaxValue ? formatCurrency(formData.postTaxValue) : ''}
                                    onChange={handleNumberChange}
                                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition"
                                    placeholder="Ví dụ: 165,000,000"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">Ghi chú</label>
                                <input 
                                    type="text" 
                                    name="note" 
                                    value={formData.note}
                                    onChange={handleFormChange}
                                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition"
                                    placeholder="Nhập ghi chú..."
                                />
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button type="button" onClick={resetForm} className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition">Hủy</button>
                            <button type="submit" className="px-6 py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition">
                                <CheckCircle2 size={18} /> Lưu dữ liệu
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1100px]">
                        <thead>
                            <tr className="bg-slate-900 text-white border-b border-slate-200">
                                <th className="p-4 font-black uppercase text-xs tracking-wider w-16 text-center">STT</th>
                                <th className="p-4 font-black uppercase text-xs tracking-wider">Tên công trình</th>
                                <th className="p-4 font-black uppercase text-xs tracking-wider">Số hợp đồng</th>
                                <th className="p-4 font-black uppercase text-xs tracking-wider text-right">Giá trị trước thuế</th>
                                <th className="p-4 font-black uppercase text-xs tracking-wider text-right">Thuế VAT</th>
                                <th className="p-4 font-black uppercase text-xs tracking-wider text-right">Giá trị sau thuế</th>
                                <th className="p-4 font-black uppercase text-xs tracking-wider">Đợt</th>
                                <th className="p-4 font-black uppercase text-xs tracking-wider">Ghi chú</th>
                                <th className="p-4 font-black uppercase text-xs tracking-wider w-24 text-center">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredInvoices.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="p-8 text-center text-slate-500">Chưa có dữ liệu hoặc không tìm thấy hóa đơn phù hợp.</td>
                                </tr>
                            ) : (
                                filteredInvoices.map((inv, idx) => (
                                    <tr key={inv.id} className="hover:bg-slate-50 transition group">
                                        <td className="p-4 text-sm text-center text-slate-500 font-medium">{idx + 1}</td>
                                        <td className="p-4 text-sm font-bold text-slate-800">{inv.projectName}</td>
                                        <td className="p-4 text-sm font-medium text-slate-600">{projectDetails?.[inv.projectName]?.contractNo || '-'}</td>
                                        <td className="p-4 text-sm font-black text-slate-700 text-right">{formatCurrency(inv.preTaxValue || 0)}</td>
                                        <td className="p-4 text-sm font-black text-red-500 text-right">{formatCurrency(inv.vatAmount || 0)}</td>
                                        <td className="p-4 text-sm font-black text-emerald-600 text-right">{formatCurrency(inv.postTaxValue || inv.expectedValue || 0)} VNĐ</td>
                                        <td className="p-4 text-sm text-slate-600 font-medium">{inv.phase}</td>
                                        <td className="p-4 text-sm text-slate-500">{inv.note}</td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition">
                                                <button onClick={() => handleEdit(inv)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition" title="Sửa">
                                                    <Edit2 size={16} />
                                                </button>
                                                {currentUser?.role?.toUpperCase() === 'ADMIN' && (
                                                    <button onClick={() => handleDelete(inv.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition" title="Xóa">
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                            {filteredInvoices.length > 0 && (
                                <tr className="bg-slate-100 border-t-2 border-slate-300">
                                    <td colSpan="3" className="p-4 text-sm font-black text-slate-800 text-right uppercase">Tổng cộng:</td>
                                    <td className="p-4 text-sm font-black text-slate-700 text-right">{formatCurrency(filteredInvoices.reduce((sum, inv) => sum + (parseFloat(inv.preTaxValue) || 0), 0))}</td>
                                    <td className="p-4 text-sm font-black text-red-600 text-right">{formatCurrency(filteredInvoices.reduce((sum, inv) => sum + (parseFloat(inv.vatAmount) || 0), 0))}</td>
                                    <td className="p-4 text-sm font-black text-emerald-700 text-right">{formatCurrency(filteredInvoices.reduce((sum, inv) => sum + (parseFloat(inv.postTaxValue || inv.expectedValue) || 0), 0))} VNĐ</td>
                                    <td colSpan="3" className="p-4"></td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
