'use client';
import React, { useState, useEffect } from 'react';
import { 
    Warehouse, Plus, ArrowDownToLine, ArrowUpFromLine, 
    Search, Filter, History, Package, Trash2, ChevronDown, ChevronRight
} from 'lucide-react';
import { formatCurrency, formatDateVN } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import ConfirmModal from './ConfirmModal';

export default function MaterialWarehouse({ currentUser, projects, showToast }) {
    const [transactions, setTransactions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [view, setView] = useState('inventory'); // 'inventory', 'history'
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState('NHẬP'); // 'NHẬP' hoặc 'XUẤT'
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProject, setSelectedProject] = useState('');
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });
    const [expandedProjects, setExpandedProjects] = useState({});

    const [formData, setFormData] = useState({
        project_name: '',
        material_name: '',
        color_code: '',
        unit: 'Thùng/18lit',
        quantity: '',
        date: new Date().toISOString().split('T')[0],
        note: ''
    });

    const fetchTransactions = async () => {
        setIsLoading(true);
        try {
            let manualTransactions = [];
            const { data, error } = await supabase
                .from('material_warehouse')
                .select('*')
                .order('date', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) {
                if (error.code === '42P01') {
                    // Ignore missing table for now
                } else {
                    throw error;
                }
            } else {
                manualTransactions = data || [];
            }

            // Fetch auto imports from material_orders
            let autoTransactions = [];
            const { data: ordersData, error: ordersError } = await supabase
                .from('material_orders')
                .select('*');

            if (!ordersError && ordersData) {
                ordersData.forEach(order => {
                    if (order.is_deleted) return; // Skip deleted orders
                    
                    let itemsArray = [];
                    try {
                        itemsArray = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                    } catch(e){}
                    
                    if (Array.isArray(itemsArray)) {
                        itemsArray.forEach(category => {
                            if (Array.isArray(category.items)) {
                                category.items.forEach((item, idx) => {
                                    if (item.name && Number(item.quantity) > 0) {
                                        autoTransactions.push({
                                            id: `auto_${order.id}_${idx}`,
                                            project_name: order.project_name,
                                            material_name: item.name,
                                            color_code: item.colorCode || item.color_code || '',
                                            unit: item.unit || '',
                                            quantity: Number(item.quantity),
                                            transaction_type: 'NHẬP',
                                            date: order.order_date,
                                            note: `Tự động từ ĐVT: ${order.order_phase}`,
                                            created_by: order.created_by || 'Hệ thống',
                                            is_auto: true
                                        });
                                    }
                                });
                            }
                        });
                    }
                });
            }

            const combined = [...autoTransactions, ...manualTransactions].sort((a, b) => new Date(b.date) - new Date(a.date));
            setTransactions(combined);
            
        } catch (err) {
            console.warn("Lỗi khi tải dữ liệu kho vật tư:", err.message);
            showToast('Lỗi khi tải dữ liệu. Bảng material_warehouse chưa được tạo?', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, []);

    const handleOpenModal = (type) => {
        setModalType(type);
        setFormData({
            project_name: projects[0]?.name || '',
            material_name: '',
            color_code: '',
            unit: 'Thùng/18lit',
            quantity: '',
            date: new Date().toISOString().split('T')[0],
            note: ''
        });
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.project_name || !formData.material_name || !formData.quantity || parseFloat(formData.quantity) <= 0) {
            alert('Vui lòng điền đầy đủ thông tin và số lượng phải lớn hơn 0!');
            return;
        }

        setIsLoading(true);
        try {
            const payload = {
                project_name: formData.project_name,
                material_name: formData.material_name.trim(),
                color_code: formData.color_code.trim(),
                unit: formData.unit.trim(),
                quantity: parseFloat(formData.quantity),
                transaction_type: modalType,
                date: formData.date,
                note: formData.note,
                created_by: currentUser.username
            };

            const { error } = await supabase
                .from('material_warehouse')
                .insert([payload]);

            if (error) throw error;

            showToast(`Thêm phiếu ${modalType} thành công!`);
            setShowModal(false);
            fetchTransactions();
        } catch (err) {
            console.error(err);
            showToast('Lỗi khi lưu giao dịch kho!', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = (id) => {
        setConfirmModal({
            isOpen: true,
            message: 'Bạn có chắc chắn muốn xóa giao dịch này? Hành động này sẽ thay đổi số liệu tồn kho.',
            onConfirm: async () => {
                setConfirmModal({ isOpen: false, message: '', onConfirm: null });
                setIsLoading(true);
                try {
                    const { error } = await supabase
                        .from('material_warehouse')
                        .delete()
                        .eq('id', id);
                    if (error) throw error;
                    showToast('Đã xóa giao dịch!');
                    fetchTransactions();
                } catch (err) {
                    showToast('Lỗi khi xóa giao dịch!', 'error');
                } finally {
                    setIsLoading(false);
                }
            }
        });
    };

    // Calculate Inventory
    const inventory = {};
    transactions.forEach(t => {
        const key = `${t.project_name}_${t.material_name}_${t.color_code}_${t.unit}`;
        if (!inventory[key]) {
            inventory[key] = {
                project_name: t.project_name,
                material_name: t.material_name,
                color_code: t.color_code,
                unit: t.unit,
                totalImport: 0,
                totalExport: 0
            };
        }
        if (t.transaction_type === 'NHẬP') {
            inventory[key].totalImport += Number(t.quantity);
        } else if (t.transaction_type === 'XUẤT') {
            inventory[key].totalExport += Number(t.quantity);
        }
    });

    const inventoryList = Object.values(inventory).map(item => ({
        ...item,
        remaining: item.totalImport - item.totalExport
    }));

    const filteredInventory = inventoryList.filter(item => {
        const matchesProject = selectedProject ? item.project_name === selectedProject : true;
        const matchesSearch = item.material_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (item.color_code || '').toLowerCase().includes(searchTerm.toLowerCase());
        return matchesProject && matchesSearch;
    });

    const filteredTransactions = transactions.filter(t => {
        const matchesProject = selectedProject ? t.project_name === selectedProject : true;
        const matchesSearch = t.material_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (t.note || '').toLowerCase().includes(searchTerm.toLowerCase());
        return matchesProject && matchesSearch;
    });

    return (
        <div className="max-w-6xl mx-auto animate-in fade-in duration-500 pb-16">
            
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mb-6">
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
                            <Warehouse size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800">Kho Vật Tư</h2>
                            <p className="text-sm text-slate-500 mt-1">Quản lý số lượng vật tư Nhập/Xuất theo công trình</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => handleOpenModal('NHẬP')} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold transition flex items-center gap-2 shadow-sm shadow-blue-600/20">
                            <ArrowDownToLine size={18} /> Nhập Kho
                        </button>
                        <button onClick={() => handleOpenModal('XUẤT')} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl font-bold transition flex items-center gap-2 shadow-sm shadow-amber-500/20">
                            <ArrowUpFromLine size={18} /> Xuất Kho
                        </button>
                    </div>
                </div>

                <div className="flex border-b border-slate-100">
                    <button 
                        onClick={() => setView('inventory')} 
                        className={`flex-1 py-4 font-bold flex justify-center items-center gap-2 transition ${view === 'inventory' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <Package size={18} /> Tổng hợp Tồn kho
                    </button>
                    <button 
                        onClick={() => setView('history')} 
                        className={`flex-1 py-4 font-bold flex justify-center items-center gap-2 transition ${view === 'history' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <History size={18} /> Lịch sử Giao dịch
                    </button>
                </div>

                <div className="p-4 bg-slate-50 flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Tìm kiếm vật tư, mã màu..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 outline-none transition"
                        />
                    </div>
                    <div className="relative md:w-64">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <select 
                            value={selectedProject}
                            onChange={(e) => setSelectedProject(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 outline-none transition appearance-none cursor-pointer"
                        >
                            <option value="">-- Tất cả công trình --</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.name}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* TAB CONTENT */}
            {view === 'inventory' && (
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 bg-slate-50 uppercase font-black">
                                <tr>
                                    <th className="px-6 py-4">Công trình</th>
                                    <th className="px-6 py-4">Tên Vật Tư</th>
                                    <th className="px-6 py-4 text-center">Mã Màu</th>
                                    <th className="px-6 py-4 text-center">ĐVT</th>
                                    <th className="px-6 py-4 text-right">Tổng Nhập</th>
                                    <th className="px-6 py-4 text-right">Tổng Xuất</th>
                                    <th className="px-6 py-4 text-right text-indigo-600">Tồn Kho</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {(() => {
                                    const inventoryByProject = {};
                                    filteredInventory.forEach(item => {
                                        if (!inventoryByProject[item.project_name]) {
                                            inventoryByProject[item.project_name] = [];
                                        }
                                        inventoryByProject[item.project_name].push(item);
                                    });

                                    const toggleProject = (projectName) => {
                                        setExpandedProjects(prev => ({...prev, [projectName]: !prev[projectName]}));
                                    };

                                    if (Object.keys(inventoryByProject).length === 0) {
                                        return (
                                            <tr>
                                                <td colSpan="7" className="px-6 py-10 text-center text-slate-500 font-medium">
                                                    Không có dữ liệu tồn kho phù hợp.
                                                </td>
                                            </tr>
                                        );
                                    }

                                    return Object.entries(inventoryByProject).map(([projectName, items]) => (
                                        <React.Fragment key={projectName}>
                                            <tr 
                                                className="bg-slate-100/50 hover:bg-slate-200/50 cursor-pointer transition border-b border-slate-200"
                                                onClick={() => toggleProject(projectName)}
                                            >
                                                <td colSpan="7" className="px-6 py-3">
                                                    <div className="flex items-center gap-2 font-black text-slate-800">
                                                        {expandedProjects[projectName] ? <ChevronDown size={18} className="text-slate-500" /> : <ChevronRight size={18} className="text-slate-500" />}
                                                        {projectName} 
                                                        <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full ml-2">
                                                            {items.length} vật tư
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                            {expandedProjects[projectName] && items.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50 transition">
                                                    <td className="px-6 py-3 pl-12 text-slate-300 font-mono">↳</td>
                                                    <td className="px-6 py-3 font-medium text-slate-700">{item.material_name}</td>
                                                    <td className="px-6 py-3 text-center text-slate-600">{item.color_code || '-'}</td>
                                                    <td className="px-6 py-3 text-center text-slate-500">{item.unit}</td>
                                                    <td className="px-6 py-3 text-right font-bold text-blue-600">{item.totalImport}</td>
                                                    <td className="px-6 py-3 text-right font-bold text-amber-500">{item.totalExport}</td>
                                                    <td className="px-6 py-3 text-right font-black text-indigo-600 text-base">{item.remaining}</td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    ));
                                })()}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {view === 'history' && (
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 bg-slate-50 uppercase font-black">
                                <tr>
                                    <th className="px-6 py-4">Ngày</th>
                                    <th className="px-6 py-4">Loại</th>
                                    <th className="px-6 py-4">Công trình</th>
                                    <th className="px-6 py-4">Vật tư</th>
                                    <th className="px-6 py-4 text-right">Số lượng</th>
                                    <th className="px-6 py-4">Người nhập</th>
                                    <th className="px-6 py-4 text-right">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredTransactions.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-10 text-center text-slate-500 font-medium">
                                            Không có lịch sử giao dịch.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTransactions.map((t) => (
                                        <tr key={t.id} className="hover:bg-slate-50 transition">
                                            <td className="px-6 py-4 font-medium">{formatDateVN(t.date)}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${t.transaction_type === 'NHẬP' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    {t.transaction_type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-700">{t.project_name}</td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold">{t.material_name}</div>
                                                <div className="text-xs text-slate-500">Mã màu: {t.color_code || '-'} | ĐVT: {t.unit}</div>
                                                {t.note && <div className="text-xs italic text-slate-400 mt-1">Lưu ý: {t.note}</div>}
                                            </td>
                                            <td className={`px-6 py-4 text-right font-black ${t.transaction_type === 'NHẬP' ? 'text-blue-600' : 'text-amber-500'}`}>
                                                {t.transaction_type === 'NHẬP' ? '+' : '-'}{t.quantity}
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 text-xs font-bold uppercase">{t.created_by}</td>
                                            <td className="px-6 py-4 text-right">
                                                {!t.is_auto && (
                                                    <button onClick={() => handleDelete(t.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Xóa giao dịch thủ công">
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal Nhập / Xuất */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className={`p-5 text-white flex items-center gap-3 ${modalType === 'NHẬP' ? 'bg-blue-600' : 'bg-amber-500'}`}>
                            {modalType === 'NHẬP' ? <ArrowDownToLine size={24} /> : <ArrowUpFromLine size={24} />}
                            <h2 className="text-xl font-black">Thêm Phiếu {modalType} Kho</h2>
                        </div>
                        <form onSubmit={handleSave} className="p-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Công trình *</label>
                                    <select 
                                        required
                                        value={formData.project_name} 
                                        onChange={(e) => setFormData({...formData, project_name: e.target.value})}
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:border-indigo-500 outline-none font-bold text-slate-700"
                                    >
                                        <option value="">-- Chọn công trình --</option>
                                        {projects.map(p => (
                                            <option key={p.id} value={p.name}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Tên vật tư *</label>
                                        {modalType === 'XUẤT' && formData.project_name ? (
                                            <select 
                                                required
                                                value={formData.material_name ? JSON.stringify({name: formData.material_name, color: formData.color_code || ''}) : ''}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (!val) {
                                                        setFormData({...formData, material_name: '', color_code: '', unit: ''});
                                                        return;
                                                    }
                                                    try {
                                                        const { name, color } = JSON.parse(val);
                                                        const matchedMat = inventoryList.find(i => i.project_name === formData.project_name && i.material_name === name && (i.color_code || '') === color);
                                                        setFormData({
                                                            ...formData, 
                                                            material_name: name,
                                                            unit: matchedMat ? matchedMat.unit : formData.unit,
                                                            color_code: color
                                                        });
                                                    } catch(err) {}
                                                }}
                                                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:border-indigo-500 outline-none font-bold text-slate-700"
                                            >
                                                <option value="">-- Chọn vật tư để xuất --</option>
                                                {inventoryList.filter(i => i.project_name === formData.project_name && i.remaining > 0).map(i => (
                                                    <option key={`${i.material_name}-${i.color_code}`} value={JSON.stringify({name: i.material_name, color: i.color_code || ''})}>
                                                        {i.material_name} {i.color_code ? `(Mã: ${i.color_code})` : ''} - Tồn: {i.remaining} {i.unit}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <>
                                                <input 
                                                    required
                                                    type="text" 
                                                    list="available-materials"
                                                    value={formData.material_name} 
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        const matchedMat = inventoryList.find(i => i.project_name === formData.project_name && i.material_name === val);
                                                        setFormData({
                                                            ...formData, 
                                                            material_name: val,
                                                            unit: matchedMat ? matchedMat.unit : formData.unit,
                                                            color_code: matchedMat && matchedMat.color_code ? matchedMat.color_code : formData.color_code
                                                        });
                                                    }}
                                                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:border-indigo-500 outline-none"
                                                    placeholder="VD: Sơn lót nội thất..."
                                                />
                                                <datalist id="available-materials">
                                                    {inventoryList.filter(i => i.project_name === formData.project_name).map(i => (
                                                        <option key={`${i.material_name}-${i.color_code}`} value={i.material_name} />
                                                    ))}
                                                </datalist>
                                            </>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Mã màu</label>
                                        <input 
                                            type="text" 
                                            value={formData.color_code} 
                                            onChange={(e) => setFormData({...formData, color_code: e.target.value})}
                                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:border-indigo-500 outline-none"
                                            placeholder="Để trống nếu không có"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Đơn vị *</label>
                                        <input 
                                            required
                                            type="text" 
                                            value={formData.unit} 
                                            onChange={(e) => setFormData({...formData, unit: e.target.value})}
                                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:border-indigo-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Số lượng *</label>
                                        <input 
                                            required
                                            type="number" 
                                            step="0.01"
                                            value={formData.quantity} 
                                            onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                                            className={`w-full border border-slate-200 rounded-xl px-3 py-2.5 outline-none font-black text-lg ${modalType === 'NHẬP' ? 'text-blue-600 focus:border-blue-500' : 'text-amber-500 focus:border-amber-500'}`}
                                            placeholder="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Ngày *</label>
                                        <input 
                                            required
                                            type="date" 
                                            value={formData.date} 
                                            onChange={(e) => setFormData({...formData, date: e.target.value})}
                                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:border-indigo-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Ghi chú</label>
                                    <input 
                                        type="text" 
                                        value={formData.note} 
                                        onChange={(e) => setFormData({...formData, note: e.target.value})}
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:border-indigo-500 outline-none"
                                        placeholder="Nhập ghi chú nếu cần..."
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 mt-8">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition">Hủy</button>
                                <button disabled={isLoading} type="submit" className={`flex-1 px-4 py-3 text-white font-bold rounded-xl shadow-lg transition ${isLoading ? 'opacity-50 cursor-not-allowed' : ''} ${modalType === 'NHẬP' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30' : 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30'}`}>
                                    {isLoading ? 'Đang lưu...' : 'Lưu Phiếu'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmModal 
                isOpen={confirmModal.isOpen}
                message={confirmModal.message}
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal({ isOpen: false, message: '', onConfirm: null })}
            />
        </div>
    );
}
