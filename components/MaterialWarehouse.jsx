'use client';
import React, { useState, useEffect } from 'react';
import { 
    Warehouse, Plus, ArrowDownToLine, ArrowUpFromLine, 
    Search, Filter, History, Package, Trash2, ChevronDown, ChevronRight, Edit2,
    Calendar, MapPin
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
    const [expandedMaterials, setExpandedMaterials] = useState({});
    const [isCustomMaterial, setIsCustomMaterial] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const [formData, setFormData] = useState({
        project_name: '',
        material_name: '',
        color_code: '',
        unit: 'Thùng/18lit',
        quantity: '',
        date: new Date().toISOString().split('T')[0],
        price_phase: '',
        note: ''
    });

    const [projectVersions, setProjectVersions] = useState([]);

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
                        itemsArray.forEach((category, catIdx) => {
                            if (Array.isArray(category.items)) {
                                category.items.forEach((item, idx) => {
                                    if (item.name && Number(item.quantity) > 0) {
                                        autoTransactions.push({
                                            id: `auto_${order.id}_${catIdx}_${idx}`,
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

    const [infoModal, setInfoModal] = useState({ isOpen: false, message: '' });

    const handleOpenModal = (type) => {
        setModalType(type);
        setFormData({
            project_name: projects[0]?.name || '',
            material_name: '',
            color_code: '',
            unit: 'Thùng/18lit',
            quantity: '',
            date: new Date().toISOString().split('T')[0],
            price_phase: '',
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
                material_name: (formData.material_name || '').trim(),
                color_code: (formData.color_code || '').trim() || null,
                unit: (formData.unit || '').trim() || 'Thùng/18lit',
                quantity: parseFloat(formData.quantity) || 0,
                transaction_type: modalType,
                date: formData.date,
                note: formData.price_phase ? `[Đợt giá: ${formData.price_phase}] ${formData.note || ''}`.trim() : (formData.note || '').trim() || null,
                created_by: currentUser?.username || 'Hệ thống'
            };

            if (modalType === 'XUẤT') {
                const getPhase = (note) => {
                    if (!note) return '';
                    const match = note.match(/\[Đợt giá: (.*?)\]/);
                    if (match) return match[1];
                    if (note.includes('Tự động từ ĐVT')) {
                        const phaseMatch = note.match(/ĐVT: (.*)/);
                        if (phaseMatch) return phaseMatch[1];
                    }
                    return '';
                };
                
                let currentImport = 0;
                let currentExport = 0;
                transactions.forEach(t => {
                    if (t.project_name === payload.project_name &&
                        t.material_name === payload.material_name &&
                        (t.color_code || '') === (payload.color_code || '') &&
                        getPhase(t.note) === (formData.price_phase || '')) {
                        // Bỏ qua phiếu đang sửa (nếu có) khỏi tổng xuất
                        if (editingId && t.id === editingId) return;

                        if (t.transaction_type === 'NHẬP') currentImport += Number(t.quantity);
                        else if (t.transaction_type === 'XUẤT') currentExport += Number(t.quantity);
                    }
                });
                
                const remaining = currentImport - currentExport;
                if (payload.quantity > remaining) {
                    alert(`Số lượng xuất (${payload.quantity}) vượt quá số lượng tồn kho hiện tại (${remaining})! Vui lòng kiểm tra lại.`);
                    setIsLoading(false);
                    return;
                }
            }

            if (editingId && typeof editingId === 'string' && editingId.startsWith('REPLACE_IMPORT::')) {
                const target = JSON.parse(editingId.split('::')[1]);
                
                const getPhase = (note) => {
                    if (!note) return '';
                    const match = note.match(/\[Đợt giá: (.*?)\]/);
                    if (match) return match[1];
                    if (note.includes('Tự động từ ĐVT')) {
                        const phaseMatch = note.match(/ĐVT: (.*)/);
                        if (phaseMatch) return phaseMatch[1];
                    }
                    return '';
                };

                const txToDelete = transactions.filter(t => 
                    t.project_name === target.pName && 
                    t.material_name === target.mName && 
                    (t.color_code || '') === (target.cCode || '') && 
                    getPhase(t.note) === (target.pPhase || '') &&
                    t.transaction_type === 'NHẬP'
                );

                if (txToDelete.length > 0) {
                    const idsToDelete = txToDelete.map(t => t.id);
                    const { error: delError } = await supabase
                        .from('material_warehouse')
                        .delete()
                        .in('id', idsToDelete);
                    if (delError) throw delError;
                }

                const { error: insError } = await supabase
                    .from('material_warehouse')
                    .insert([payload]);
                if (insError) throw insError;

                showToast(`Đã thay thế số lượng nhập kho cũ thành công!`);
            } else if (editingId) {
                const { error } = await supabase
                    .from('material_warehouse')
                    .update(payload)
                    .eq('id', editingId);
                if (error) throw error;
                showToast(`Cập nhật phiếu ${modalType} thành công!`);
            } else {
                const { error } = await supabase
                    .from('material_warehouse')
                    .insert([payload]);
                if (error) throw error;
                showToast(`Thêm phiếu ${modalType} thành công!`);
            }

            setShowModal(false);
            setEditingId(null);
            await fetchTransactions();
        } catch (err) {
            console.warn("Save Error Details:", err?.message || err?.code || err);
            const errStr = typeof err === 'object' ? JSON.stringify(err, Object.getOwnPropertyNames(err)) : String(err);
            if (err?.code === '42P01') {
                showToast('Lỗi: Bảng material_warehouse chưa được tạo trong CSDL!', 'error');
                alert('Vui lòng chạy file setup_material_warehouse.sql trong Supabase để tạo bảng trước khi lưu.');
            } else {
                showToast(`Lỗi khi lưu: ${err?.message || 'Chi tiết: ' + errStr}`, 'error');
                alert(`Lỗi chi tiết: ${errStr}`);
            }
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
                    await fetchTransactions();
                } catch (err) {
                    showToast('Lỗi khi xóa giao dịch!', 'error');
                } finally {
                    setIsLoading(false);
                }
            }
        });
    };

    const handleEditInventory = (item) => {
        setModalType('NHẬP');
        setFormData({
            project_name: item.project_name,
            material_name: item.material_name,
            color_code: item.color_code || '',
            unit: item.unit || 'Thùng/18lit',
            quantity: item.totalImport,
            date: new Date().toISOString().split('T')[0],
            price_phase: item.price_phase || '',
            note: 'Chỉnh sửa thay thế số lượng nhập kho'
        });
        setEditingId(`REPLACE_IMPORT::${JSON.stringify({
            pName: item.project_name, 
            mName: item.material_name, 
            cCode: item.color_code, 
            pPhase: item.price_phase
        })}`);
        setShowModal(true);
    };

    const handleDeleteInventoryGroup = (item) => {
        setConfirmModal({
            isOpen: true,
            message: `Bạn có chắc chắn muốn xóa TOÀN BỘ lịch sử giao dịch của vật tư "${item.material_name}" trong công trình này?`,
            onConfirm: async () => {
                setConfirmModal({ isOpen: false, message: '', onConfirm: null });
                setIsLoading(true);
                try {
                    const getPhase = (note) => {
                        if (!note) return '';
                        const match = note.match(/\[Đợt giá: (.*?)\]/);
                        if (match) return match[1];
                        if (note.includes('Tự động từ ĐVT')) {
                            const phaseMatch = note.match(/ĐVT: (.*)/);
                            if (phaseMatch) return phaseMatch[1];
                        }
                        return '';
                    };

                    const relatedTx = transactions.filter(t => 
                        t.project_name === item.project_name && 
                        t.material_name === item.material_name && 
                        (t.color_code || '') === (item.color_code || '') && 
                        getPhase(t.note) === (item.price_phase || '')
                    );

                    const manualIds = relatedTx.filter(t => !t.is_auto).map(t => t.id);
                    const autoCount = relatedTx.filter(t => t.is_auto).length;
                    
                    if (manualIds.length > 0) {
                        const { error } = await supabase
                            .from('material_warehouse')
                            .delete()
                            .in('id', manualIds);
                        if (error) throw error;
                    }

                    if (autoCount > 0) {
                        showToast('Lưu ý: Không thể xóa dữ liệu Tự động!', 'warning');
                        setInfoModal({ isOpen: true, message: `Trong nhóm vật tư này có chứa ${autoCount} dữ liệu được nhập tự động từ Đơn Đặt Hàng.\n\nKho Vật Tư chỉ cho phép quản lý tồn kho. Để xóa hoàn toàn các đợt giá tự động này (hoặc để reset lại Đợt 1), bạn vui lòng sang tab "Quản lý Đơn Vật tư" để xóa Đơn Hàng tương ứng.`});
                    } else {
                        showToast('Đã xóa toàn bộ dữ liệu vật tư này!');
                    }

                    await fetchTransactions();
                } catch (err) {
                    showToast('Lỗi khi xóa dữ liệu!', 'error');
                } finally {
                    setIsLoading(false);
                }
            }
        });
    };

    // Calculate Inventory
    const getMaterialConfigInfo = (projectName, materialName, colorCode, pricePhase) => {
        try {
            const savedTemplates = localStorage.getItem('misa_project_material_templates');
            if (!savedTemplates) return { price: 0, index: 9999 };
            const templates = JSON.parse(savedTemplates);
            
            const pName = (projectName || '').trim();
            const mName = (materialName || '').trim().toLowerCase();
            const cCode = (colorCode || '').trim().toLowerCase();
            
            const templateKey = Object.keys(templates).find(k => k.trim() === pName);
            if (!templateKey) return { price: 0, index: 9999 };
            const tmpl = templates[templateKey];

            if (!tmpl || !tmpl.versions || tmpl.versions.length === 0) return { price: 0, index: 9999 };
            
            let activeVer;
            if (pricePhase) {
                const pPhase = pricePhase.trim().toLowerCase();
                activeVer = tmpl.versions.find(v => {
                    const vName = (v.name || '').trim().toLowerCase();
                    if (vName === pPhase) return true;
                    const genName = `đợt ${tmpl.versions.indexOf(v) + 1} - ${v.date}`.toLowerCase();
                    if (genName === pPhase) return true;
                    return false;
                });
            }
            if (!activeVer) {
                const activeId = tmpl.activeVersionId || tmpl.versions[tmpl.versions.length - 1].id;
                activeVer = tmpl.versions.find(v => v.id === activeId) || tmpl.versions[tmpl.versions.length - 1];
            }
            
            let globalIndex = 0;
            for (const cat of activeVer.categories) {
                if (Array.isArray(cat.items)) {
                    for (const item of cat.items) {
                        globalIndex++;
                        const itemName = (item.name || '').trim().toLowerCase();
                        const itemColor = (item.colorCode || '').trim().toLowerCase();
                        
                        const isMatch = itemName === mName && 
                            (itemColor === cCode || (itemColor === '-' && cCode === '') || (itemColor === '' && cCode === '-'));
                            
                        if (isMatch) {
                            return { price: Number(item.price) || 0, index: globalIndex };
                        }
                    }
                }
            }

            // Fallback: match by name only if exact color match fails
            globalIndex = 0;
            for (const cat of activeVer.categories) {
                if (Array.isArray(cat.items)) {
                    for (const item of cat.items) {
                        globalIndex++;
                        const itemName = (item.name || '').trim().toLowerCase();
                        if (itemName === mName) {
                            return { price: Number(item.price) || 0, index: globalIndex };
                        }
                    }
                }
            }
        } catch (e) {
            console.error("Error getting material price:", e);
        }
        return { price: 0, index: 9999 };
    };

    const extractPhaseFromNote = (note) => {
        if (!note) return '';
        const match = note.match(/\[Đợt giá: (.*?)\]/);
        if (match) return match[1];
        if (note.includes('Tự động từ ĐVT')) {
            const phaseMatch = note.match(/ĐVT: (.*)/);
            if (phaseMatch) return phaseMatch[1];
        }
        return '';
    };

    const inventory = {};
    transactions.forEach(t => {
        const phase = extractPhaseFromNote(t.note);
        const key = `${t.project_name}_${t.material_name}_${t.color_code}_${t.unit}_${phase}`;
        if (!inventory[key]) {
            inventory[key] = {
                project_name: t.project_name,
                material_name: t.material_name,
                color_code: t.color_code,
                unit: t.unit,
                price_phase: phase,
                totalImport: 0,
                totalExport: 0,
                export_transactions: [],
                key: key
            };
        }
        if (t.transaction_type === 'NHẬP') {
            inventory[key].totalImport += Number(t.quantity);
        } else if (t.transaction_type === 'XUẤT') {
            inventory[key].totalExport += Number(t.quantity);
            inventory[key].export_transactions.push(t);
        }
    });

    const inventoryList = Object.values(inventory).map(item => {
        const remaining = item.totalImport - item.totalExport;
        const info = getMaterialConfigInfo(item.project_name, item.material_name, item.color_code, item.price_phase);
        return {
            ...item,
            remaining,
            price: info.price,
            orderIndex: info.index,
            totalImportValue: item.totalImport * info.price,
            totalValue: remaining * info.price
        };
    });

    inventoryList.sort((a, b) => {
        const phaseA = a.price_phase || '';
        const phaseB = b.price_phase || '';
        if (phaseA < phaseB) return -1;
        if (phaseA > phaseB) return 1;
        return a.orderIndex - b.orderIndex;
    });

    const filteredInventory = inventoryList.filter(item => {
        const allowedProjectNames = projects.map(p => p.name);
        if (!allowedProjectNames.includes(item.project_name)) return false;

        const matchesProject = selectedProject ? item.project_name === selectedProject : true;
        const matchesSearch = item.material_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (item.color_code || '').toLowerCase().includes(searchTerm.toLowerCase());
        return matchesProject && matchesSearch;
    });

    const filteredTransactions = transactions.filter(t => {
        const allowedProjectNames = projects.map(p => p.name);
        if (!allowedProjectNames.includes(t.project_name)) return false;

        const matchesProject = selectedProject ? t.project_name === selectedProject : true;
        const matchesSearch = t.material_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (t.note || '').toLowerCase().includes(searchTerm.toLowerCase());
        return matchesProject && matchesSearch;
    });

    const availableMaterialsForImport = [];
    if (formData.project_name) {
        try {
            const savedTemplates = localStorage.getItem('misa_project_material_templates');
            if (savedTemplates) {
                const templates = JSON.parse(savedTemplates);
                const tmpl = templates[formData.project_name];
                if (tmpl && tmpl.versions) {
                    if (projectVersions.length === 0 || projectVersions[0].id !== tmpl.versions[0]?.id) {
                        setProjectVersions(tmpl.versions);
                    }
                } else if (projectVersions.length > 0) {
                    setProjectVersions([]);
                }
                if (tmpl && tmpl.versions && tmpl.versions.length > 0) {
                    const latest = tmpl.versions[tmpl.versions.length - 1];
                    latest.categories.forEach(cat => {
                        cat.items.forEach(item => {
                            if (item.name && !availableMaterialsForImport.find(m => m.material_name === item.name && m.color_code === (item.colorCode||item.color_code||''))) {
                                availableMaterialsForImport.push({
                                    material_name: item.name,
                                    color_code: item.colorCode || item.color_code || '',
                                    unit: item.unit || 'Thùng/18lit'
                                });
                            }
                        });
                    });
                }
            }
        } catch(e) {}

        inventoryList.filter(i => i.project_name === formData.project_name).forEach(i => {
            if (!availableMaterialsForImport.find(m => m.material_name === i.material_name && m.color_code === (i.color_code||''))) {
                availableMaterialsForImport.push({
                    material_name: i.material_name,
                    color_code: i.color_code || '',
                    unit: i.unit
                });
            }
        });
    }

    return (
        <div className="max-w-[95%] mx-auto animate-in fade-in duration-500 pb-16">
            
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
                        {currentUser?.role?.toUpperCase() !== 'CHỈ HUY TRƯỞNG' && (
                            <button onClick={() => handleOpenModal('NHẬP')} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold transition flex items-center gap-2 shadow-sm shadow-blue-600/20">
                                <ArrowDownToLine size={18} /> Nhập Kho
                            </button>
                        )}
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
                                    <th className="px-6 py-4 text-center">Đợt Giá</th>
                                    <th className="px-6 py-4 text-center">Mã Màu</th>
                                    <th className="px-6 py-4 text-center">ĐVT</th>
                                    <th className="px-6 py-4 text-right">Tổng Nhập</th>
                                    <th className="px-6 py-4 text-right">Tổng Xuất</th>
                                    <th className="px-6 py-4 text-right text-indigo-600">Tồn Kho</th>
                                    <th className="px-6 py-4 text-right whitespace-nowrap">Đơn Giá</th>
                                    <th className="px-6 py-4 text-right whitespace-nowrap">Thành Tiền</th>
                                    <th className="px-6 py-4 text-center">Thao tác</th>
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

                                    return Object.entries(inventoryByProject).map(([projectName, items]) => {
                                        const uniqueMaterials = Array.from(new Set(items.map(i => i.material_name)));
                                        const materialColors = [
                                            'bg-red-100 text-red-700 border-red-200',
                                            'bg-blue-100 text-blue-700 border-blue-200',
                                            'bg-emerald-100 text-emerald-700 border-emerald-200',
                                            'bg-amber-100 text-amber-700 border-amber-200',
                                            'bg-purple-100 text-purple-700 border-purple-200',
                                            'bg-pink-100 text-pink-700 border-pink-200',
                                            'bg-cyan-100 text-cyan-700 border-cyan-200',
                                            'bg-orange-100 text-orange-700 border-orange-200',
                                            'bg-teal-100 text-teal-700 border-teal-200',
                                            'bg-indigo-100 text-indigo-700 border-indigo-200'
                                        ];

                                        return (
                                        <React.Fragment key={projectName}>
                                            <tr 
                                                className="bg-slate-100/50 hover:bg-slate-200/50 cursor-pointer transition border-b border-slate-200"
                                                onClick={() => toggleProject(projectName)}
                                            >
                                                <td colSpan="11" className="px-6 py-3">
                                                    <div className="flex items-center justify-between font-black text-slate-800 w-full">
                                                        <div className="flex items-center gap-2">
                                                            {expandedProjects[projectName] ? <ChevronDown size={18} className="text-slate-500" /> : <ChevronRight size={18} className="text-slate-500" />}
                                                            {projectName} 
                                                            <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full ml-2">
                                                                {items.length} vật tư
                                                            </span>
                                                        </div>
                                                        <div className="flex gap-6 text-sm">
                                                            <span>Đã nhập: <span className="text-blue-600">{new Intl.NumberFormat('vi-VN').format(items.reduce((s, i) => s + i.totalImportValue, 0))} ₫</span></span>
                                                            <span>Tồn kho: <span className="text-emerald-600">{new Intl.NumberFormat('vi-VN').format(items.reduce((s, i) => s + i.totalValue, 0))} ₫</span></span>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                            {expandedProjects[projectName] && items.map((item, idx) => {
                                                const mIdx = uniqueMaterials.indexOf(item.material_name);
                                                const colorClass = materialColors[mIdx % materialColors.length];
                                                return (
                                                <React.Fragment key={idx}>
                                                <tr 
                                                    className="hover:bg-slate-50 transition border-b border-slate-100 cursor-pointer"
                                                    onClick={() => setExpandedMaterials(prev => ({...prev, [item.key]: !prev[item.key]}))}
                                                >
                                                    <td className="px-6 py-3 pl-12 text-slate-300 font-mono">
                                                        {expandedMaterials[item.key] ? <ChevronDown size={14} className="inline-block text-slate-400 mr-1"/> : <ChevronRight size={14} className="inline-block text-slate-400 mr-1"/>}
                                                    </td>
                                                    <td className="px-6 py-3 font-medium">
                                                        <span className={`px-2.5 py-1 rounded-md text-[13px] font-bold border shadow-sm ${colorClass}`}>
                                                            {item.material_name}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-3 text-center text-xs font-bold text-indigo-600">{item.price_phase || '-'}</td>
                                                    <td className="px-6 py-3 text-center text-slate-600">{item.color_code || '-'}</td>
                                                    <td className="px-6 py-3 text-center text-slate-500">{item.unit}</td>
                                                    <td className="px-6 py-3 text-right font-bold text-blue-600">{item.totalImport}</td>
                                                    <td className="px-6 py-3 text-right font-bold text-amber-500">{item.totalExport}</td>
                                                    <td className="px-6 py-3 text-right font-black text-indigo-600 text-base">{item.remaining}</td>
                                                    <td className="px-6 py-3 text-right font-medium text-slate-600 whitespace-nowrap">{new Intl.NumberFormat('vi-VN').format(item.price)} ₫</td>
                                                    <td className="px-6 py-3 text-right font-black text-blue-600 whitespace-nowrap">{new Intl.NumberFormat('vi-VN').format(item.totalImportValue)} ₫</td>
                                                    <td className="px-6 py-3 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleEditInventory(item);
                                                                }} 
                                                                className="text-slate-400 hover:text-blue-500 hover:bg-blue-50 p-2 rounded-lg transition" 
                                                                title="Thêm phiếu điều chỉnh tồn kho"
                                                            >
                                                                <Edit2 size={16} />
                                                            </button>
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteInventoryGroup(item);
                                                                }} 
                                                                className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition" 
                                                                title="Xóa TOÀN BỘ phiếu của vật tư này"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {expandedMaterials[item.key] && (
                                                    <tr className="bg-slate-50/50 border-b border-slate-200 shadow-inner">
                                                        <td colSpan="11" className="p-0">
                                                            <div className="py-6 px-8 pl-[4.5rem] bg-gradient-to-r from-amber-50/40 to-transparent">
                                                                <div className="flex items-center gap-2 mb-4">
                                                                    <div className="p-1.5 bg-amber-100 rounded-lg text-amber-600 shadow-sm">
                                                                        <ArrowUpFromLine size={16} strokeWidth={2.5} />
                                                                    </div>
                                                                    <h4 className="text-sm font-black text-slate-700 tracking-wide uppercase">Lịch sử Xuất kho</h4>
                                                                    <div className="h-px bg-slate-200 flex-1 ml-4"></div>
                                                                </div>
                                                                
                                                                {item.export_transactions.length > 0 ? (
                                                                    <div className="bg-white/80 rounded-xl border border-amber-200/60 shadow-sm overflow-hidden mt-2">
                                                                        <table className="w-full text-sm text-slate-600">
                                                                            <thead className="bg-amber-100/30">
                                                                                <tr className="text-left text-amber-800 uppercase text-xs tracking-wider">
                                                                                    <th className="py-3 px-6 font-bold w-[25%] border-b border-amber-200/60">Ngày xuất</th>
                                                                                    <th className="py-3 px-6 font-bold w-[20%] text-center border-b border-amber-200/60">Số lượng</th>
                                                                                    <th className="py-3 px-6 font-bold w-[45%] border-b border-amber-200/60">Nội dung / Vị trí</th>
                                                                                    <th className="py-3 px-6 font-bold w-[10%] text-center border-b border-amber-200/60">Thao tác</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-amber-100/50">
                                                                                {item.export_transactions.map(ex => {
                                                                                    const cleanNote = ex.note ? ex.note.replace(/\[Đợt giá: .*?\]\s*/g, '').replace(/Tự động từ ĐVT: .*?\s*/g, '').trim() : '';
                                                                                    return (
                                                                                        <tr key={ex.id} className="hover:bg-white transition-colors">
                                                                                            <td className="py-3 px-6 font-medium text-slate-600 flex items-center gap-2">
                                                                                                <Calendar size={14} className="text-slate-400" />
                                                                                                {formatDateVN(ex.date)}
                                                                                            </td>
                                                                                            <td className="py-3 px-6 text-center">
                                                                                                <span className="font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-100">
                                                                                                    -{ex.quantity} <span className="text-[11px] font-semibold">{item.unit}</span>
                                                                                                </span>
                                                                                            </td>
                                                                                            <td className="py-3 px-6 text-slate-600">
                                                                                                {cleanNote || <span className="italic text-slate-400">Không có vị trí/ghi chú</span>}
                                                                                            </td>
                                                                                            <td className="py-3 px-6 text-center">
                                                                                                <div className="flex items-center justify-center gap-1">
                                                                                                    <button onClick={(e) => {
                                                                                                        e.stopPropagation();
                                                                                                        const phaseMatch = ex.note ? ex.note.match(/\[Đợt giá: (.*?)\]/) : null;
                                                                                                        const phase = phaseMatch ? phaseMatch[1] : '';
                                                                                                        setFormData({
                                                                                                            project_name: ex.project_name,
                                                                                                            material_name: ex.material_name,
                                                                                                            color_code: ex.color_code || '',
                                                                                                            unit: ex.unit,
                                                                                                            quantity: ex.quantity,
                                                                                                            date: ex.date,
                                                                                                            price_phase: phase,
                                                                                                            note: cleanNote
                                                                                                        });
                                                                                                        setModalType('XUẤT');
                                                                                                        setEditingId(ex.id);
                                                                                                        setShowModal(true);
                                                                                                    }} className="text-slate-400 hover:text-amber-500 hover:bg-amber-50 p-1.5 rounded-md transition" title="Sửa phiếu xuất">
                                                                                                        <Edit2 size={14} />
                                                                                                    </button>
                                                                                                    <button onClick={async (e) => {
                                                                                                        e.stopPropagation();
                                                                                                        handleDelete(ex.id);
                                                                                                    }} className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-md transition" title="Xóa phiếu xuất">
                                                                                                        <Trash2 size={14} />
                                                                                                    </button>
                                                                                                </div>
                                                                                            </td>
                                                                                        </tr>
                                                                                    );
                                                                                })}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                                                        <span className="text-sm text-slate-400 font-medium italic">Chưa có dữ liệu xuất kho cho vật tư này.</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                                </React.Fragment>
                                                );
                                            })}
                                        </React.Fragment>
                                        );
                                    });
                                })()}
                                {filteredInventory.length > 0 && (
                                    <tr className="bg-slate-200 font-black text-slate-800 text-base border-t-4 border-slate-300">
                                        <td colSpan="8" className="px-6 py-4 text-right uppercase">Tổng cộng toàn bộ:</td>
                                        <td colSpan="3" className="px-6 py-4 text-right whitespace-nowrap text-blue-700">
                                            Đã nhập: {new Intl.NumberFormat('vi-VN').format(filteredInventory.reduce((s, i) => s + i.totalImportValue, 0))} ₫
                                            <br/>
                                            <span className="text-emerald-700 mt-1 block">Tồn kho: {new Intl.NumberFormat('vi-VN').format(filteredInventory.reduce((s, i) => s + i.totalValue, 0))} ₫</span>
                                        </td>
                                    </tr>
                                )}
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
                                    <th className="px-6 py-4">Đợt giá</th>
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
                                    filteredTransactions.map((t) => {
                                        let parsedPhase = '';
                                        let parsedNoteText = t.note || '';
                                        if (parsedNoteText) {
                                            const match = parsedNoteText.match(/\[Đợt giá: (.*?)\]/);
                                            if (match) {
                                                parsedPhase = match[1];
                                                parsedNoteText = parsedNoteText.replace(match[0], '').trim();
                                            } else if (parsedNoteText.includes('Tự động từ ĐVT')) {
                                                const phaseMatch = parsedNoteText.match(/ĐVT: (.*)/);
                                                if (phaseMatch) {
                                                    parsedPhase = phaseMatch[1];
                                                }
                                            }
                                        }

                                        return (
                                        <tr key={t.id} className="hover:bg-slate-50 transition">
                                            <td className="px-6 py-4 font-medium">{formatDateVN(t.date)}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${t.transaction_type === 'NHẬP' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    {t.transaction_type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-700">{t.project_name}</td>
                                            <td className="px-6 py-4 font-bold text-indigo-600 text-xs">{parsedPhase || '-'}</td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold">{t.material_name}</div>
                                                <div className="text-xs text-slate-500">Mã màu: {t.color_code || '-'} | ĐVT: {t.unit}</div>
                                                {parsedNoteText && <div className="text-xs italic text-slate-400 mt-1">Lưu ý: {parsedNoteText}</div>}
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
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal Nhập / Xuất */}
            {showModal && (() => {
                const selectedInventoryItem = modalType === 'XUẤT' && formData.material_name ? inventoryList.find(i => 
                    i.project_name === formData.project_name && 
                    i.material_name === formData.material_name && 
                    (i.color_code || '') === (formData.color_code || '') && 
                    (i.price_phase || '') === (formData.price_phase || '')
                ) : null;
                return (
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
                                                value={formData.material_name ? JSON.stringify({name: formData.material_name, color: formData.color_code || '', phase: formData.price_phase || ''}) : ''}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (!val) {
                                                        setFormData({...formData, material_name: '', color_code: '', unit: '', price_phase: ''});
                                                        return;
                                                    }
                                                    try {
                                                        const { name, color, phase } = JSON.parse(val);
                                                        const matchedMat = inventoryList.find(i => i.project_name === formData.project_name && i.material_name === name && (i.color_code || '') === color && (i.price_phase || '') === (phase || ''));
                                                        setFormData({
                                                            ...formData, 
                                                            material_name: name,
                                                            unit: matchedMat ? matchedMat.unit : formData.unit,
                                                            color_code: color,
                                                            price_phase: phase || formData.price_phase
                                                        });
                                                    } catch(err) {}
                                                }}
                                                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:border-indigo-500 outline-none font-bold text-slate-700"
                                            >
                                                <option value="">-- Chọn vật tư để xuất --</option>
                                                {inventoryList.filter(i => i.project_name === formData.project_name && i.remaining > 0).map(i => (
                                                    <option key={`${i.material_name}-${i.color_code}-${i.price_phase}`} value={JSON.stringify({name: i.material_name, color: i.color_code || '', phase: i.price_phase || ''})}>
                                                        {i.material_name} {i.color_code ? `(Mã: ${i.color_code})` : ''} {i.price_phase ? `[${i.price_phase}]` : ''} - Tồn: {i.remaining} {i.unit}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <>
                                                {!isCustomMaterial ? (
                                                    <select 
                                                        required
                                                        value={formData.material_name ? JSON.stringify({name: formData.material_name, color: formData.color_code || ''}) : ''}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            if (val === 'CUSTOM') {
                                                                setIsCustomMaterial(true);
                                                                setFormData({...formData, material_name: '', color_code: '', unit: ''});
                                                                return;
                                                            }
                                                            if (!val) {
                                                                setFormData({...formData, material_name: '', color_code: '', unit: ''});
                                                                return;
                                                            }
                                                            try {
                                                                const { name, color } = JSON.parse(val);
                                                                const matchedMat = availableMaterialsForImport.find(i => i.material_name === name && (i.color_code || '') === color);
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
                                                        <option value="">-- Chọn vật tư để nhập --</option>
                                                        {availableMaterialsForImport.map(i => (
                                                            <option key={`${i.material_name}-${i.color_code}`} value={JSON.stringify({name: i.material_name, color: i.color_code || ''})}>
                                                                {i.material_name} {i.color_code ? `(Mã: ${i.color_code})` : ''} - {i.unit}
                                                            </option>
                                                        ))}
                                                        <option value="CUSTOM">+ Vật tư khác (Nhập tay)...</option>
                                                    </select>
                                                ) : (
                                                    <div className="flex gap-2">
                                                        <input 
                                                            required
                                                            type="text" 
                                                            value={formData.material_name} 
                                                            onChange={(e) => setFormData({...formData, material_name: e.target.value})}
                                                            className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 focus:border-indigo-500 outline-none"
                                                            placeholder="Nhập tên vật tư mới..."
                                                            autoFocus
                                                        />
                                                        <button 
                                                            type="button" 
                                                            onClick={() => {
                                                                setIsCustomMaterial(false);
                                                                setFormData({...formData, material_name: '', color_code: '', unit: 'Thùng/18lit'});
                                                            }}
                                                            className="px-3 py-2 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-xl font-bold transition whitespace-nowrap"
                                                            title="Chọn từ danh sách"
                                                        >
                                                            Hủy
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Mã màu</label>
                                        <input 
                                            type="text" 
                                            value={formData.color_code || ''} 
                                            onChange={(e) => setFormData({...formData, color_code: e.target.value})}
                                            className={`w-full border border-slate-200 rounded-xl px-3 py-2.5 outline-none ${!isCustomMaterial ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'focus:border-indigo-500'}`}
                                            placeholder="Để trống nếu không có"
                                            disabled={!isCustomMaterial}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Đơn vị *</label>
                                        <input 
                                            required
                                            type="text" 
                                            value={formData.unit || ''} 
                                            onChange={(e) => setFormData({...formData, unit: e.target.value})}
                                            className={`w-full border border-slate-200 rounded-xl px-3 py-2.5 outline-none ${!isCustomMaterial ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'focus:border-indigo-500'}`}
                                            disabled={!isCustomMaterial}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">
                                            Số lượng * {modalType === 'XUẤT' && selectedInventoryItem && <span className="text-amber-600 font-normal ml-1">(Tối đa: {selectedInventoryItem.remaining})</span>}
                                        </label>
                                        <input 
                                            required
                                            type="number" 
                                            step="0.01"
                                            max={modalType === 'XUẤT' && selectedInventoryItem ? selectedInventoryItem.remaining : undefined}
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

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Đợt giá (Tùy chọn)</label>
                                        <select 
                                            value={formData.price_phase} 
                                            onChange={(e) => setFormData({...formData, price_phase: e.target.value})}
                                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:border-indigo-500 outline-none font-bold text-indigo-700 bg-indigo-50"
                                        >
                                            <option value="">-- Không chọn --</option>
                                            {projectVersions.map((v, i) => (
                                                <option key={v.id} value={v.name || `Đợt ${i + 1} - ${v.date}`}>{v.name || `Đợt ${i + 1} - Áp dụng từ ${formatDateVN(v.date)}`}</option>
                                            ))}
                                        </select>
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
                );
            })()}

            <ConfirmModal 
                isOpen={confirmModal.isOpen}
                message={confirmModal.message}
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal({ isOpen: false, message: '', onConfirm: null })}
            />

            {infoModal.isOpen && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[9999]">
                    <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-black text-slate-800 mb-4">Thông báo</h3>
                        <p className="text-sm text-slate-600 mb-6 whitespace-pre-line">{infoModal.message}</p>
                        <div className="flex justify-end">
                            <button onClick={() => setInfoModal({ isOpen: false, message: '' })} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition">OK</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
