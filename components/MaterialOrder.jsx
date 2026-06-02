'use client';
/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

import React, { useState, useEffect } from 'react';
import { 
    ClipboardList, Plus, Trash2, Edit3, Printer, 
    Download, Save, X, Search, MapPin, Briefcase, 
    User, Calendar, Info, Check, Copy
} from 'lucide-react';
import { formatCurrency, formatDateVN, parseVietnameseNumber } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import ConfirmModal from './ConfirmModal';
import CurrencyInput from './CurrencyInput';

const DEFAULT_CATEGORIES = [
    {
        name: "Hệ nội thất",
        items: [
            { stt: 1, name: "", unit: "Thùng/18lit", quantity: "", price: "", colorCode: "" }
        ]
    },
    {
        name: "Hệ ngoại thất",
        items: [
            { stt: 1, name: "", unit: "Thùng/18lit", quantity: "", price: "", colorCode: "" }
        ]
    }
];

const getNextOrderPhaseForProject = (projectName, ordersList) => {
    if (!projectName) return 'ĐỢT 1';
    const projectOrders = ordersList.filter(o => o.project_name === projectName);
    if (projectOrders.length === 0) return 'ĐỢT 1';
    
    let maxPhase = 0;
    projectOrders.forEach(o => {
        const match = o.order_phase?.match(/(\d+)/);
        if (match) {
            const num = parseInt(match[1]);
            if (num > maxPhase) maxPhase = num;
        }
    });
    return `ĐỢT ${maxPhase + 1}`;
};

const getProjectMaterialTemplate = (projectName) => {
    if (!projectName) return JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
    try {
        const savedTemplates = localStorage.getItem('misa_project_material_templates');
        if (savedTemplates) {
            const templates = JSON.parse(savedTemplates);
            if (templates[projectName] && Array.isArray(templates[projectName]) && templates[projectName].length > 0) {
                return JSON.parse(JSON.stringify(templates[projectName]));
            }
        }
    } catch (e) {
        console.error("Error reading material templates:", e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
};

const getCommanderName = (recipient) => {
    if (!recipient) return '';
    return recipient.split(' (SĐT:')[0].trim().toUpperCase();
};

const getSignatureName = (commanderName) => {
    if (!commanderName) return '';
    const parts = commanderName.split(' ');
    let lastWord = parts[parts.length - 1];
    lastWord = lastWord.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
    return lastWord.charAt(0).toUpperCase() + lastWord.slice(1).toLowerCase();
};

export default function MaterialOrder({ currentUser, projects, showToast, onCreateAccountingRequest }) {
    const [view, setView] = useState('list'); // 'list', 'create', 'detail'
    const [orders, setOrders] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [isDbStorage, setIsDbStorage] = useState(false);
    const [showSqlModal, setShowSqlModal] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProjectFilter, setSelectedProjectFilter] = useState('');
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });
    const [isCustomCompany, setIsCustomCompany] = useState(false);

    // Config state
    const [configProjectName, setConfigProjectName] = useState(projects[0]?.name || '');
    const [configCategories, setConfigCategories] = useState([]);

    // Form state
    const [formData, setFormData] = useState(() => {
        const firstProj = projects[0];
        const projName = firstProj?.name || '';
        return {
            id: null,
            project_name: projName,
            order_phase: 'ĐỢT 1',
            order_date: new Date().toISOString().split('T')[0],
            address: firstProj?.address || 'BÌNH HÒA, TP HCM',
            category: 'THI CÔNG SƠN NƯỚC',
            company: '',
            recipient: (firstProj?.cht_name && firstProj?.cht_phone)
                ? `${firstProj.cht_name} (SĐT: ${firstProj.cht_phone})`
                : 'VÕ NGỌC LÂM (SĐT: 033 2620148)',
            categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
            show_signature: true
        };
    });

    // Auto-update initial project selections on asynchronous projects load
    useEffect(() => {
        if (projects?.length > 0 && !formData.id && !formData.project_name) {
            const firstProj = projects[0];
            const nextPhase = getNextOrderPhaseForProject(firstProj.name, orders);
            const template = getProjectMaterialTemplate(firstProj.name);
            setFormData(prev => ({
                ...prev,
                project_name: firstProj.name,
                order_phase: nextPhase,
                address: firstProj.address || 'BÌNH HÒA, TP HCM',
                categories: template,
                recipient: (firstProj.cht_name && firstProj.cht_phone)
                    ? `${firstProj.cht_name} (SĐT: ${firstProj.cht_phone})`
                    : 'VÕ NGỌC LÂM (SĐT: 033 2620148)'
            }));
        }
    }, [projects, orders]);

    const sqlScript = `CREATE TABLE IF NOT EXISTS material_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_name TEXT NOT NULL,
    order_phase TEXT NOT NULL,
    order_date DATE NOT NULL,
    address TEXT,
    category TEXT,
    company TEXT,
    recipient TEXT,
    items JSONB NOT NULL,
    show_signature BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_by TEXT
);`;

    const fetchOrders = async () => {
        setIsLoading(true);
        try {
            // Thử lấy từ Supabase
            const { data, error } = await supabase
                .from('material_orders')
                .select('*')
                .order('order_date', { ascending: false });

            if (error) throw error;
            
            setOrders(data || []);
            setIsDbStorage(true);

            // Auto-update initial phase and categories for the selected project once orders load
            if (projects?.length > 0 && data) {
                const firstProj = projects[0];
                setFormData(prev => {
                    if (!prev.id && !prev.project_name) {
                        const nextPhase = getNextOrderPhaseForProject(firstProj.name, data);
                        const template = getProjectMaterialTemplate(firstProj.name);
                        return {
                            ...prev,
                            project_name: firstProj.name,
                            order_phase: nextPhase,
                            categories: template,
                            address: firstProj.address || 'BÌNH HÒA, TP HCM',
                            recipient: (firstProj.cht_name && firstProj.cht_phone)
                                ? `${firstProj.cht_name} (SĐT: ${firstProj.cht_phone})`
                                : 'VÕ NGỌC LÂM (SĐT: 033 2620148)'
                        };
                    } else if (!prev.id) {
                        // Project name already set by state default, let's update phase and template
                        const nextPhase = getNextOrderPhaseForProject(prev.project_name, data);
                        const template = getProjectMaterialTemplate(prev.project_name);
                        return {
                            ...prev,
                            order_phase: nextPhase,
                            categories: template
                        };
                    }
                    return prev;
                });
            }
        } catch (err) {
            console.warn("Supabase table 'material_orders' not found. Falling back to LocalStorage.");
            setIsDbStorage(false);
            const localData = localStorage.getItem('misa_material_orders');
            let loadedOrders = [];
            if (localData) {
                loadedOrders = JSON.parse(localData);
                setOrders(loadedOrders);
            } else {
                setOrders([]);
            }

            // Auto-update initial phase and categories for the selected project once orders load (local)
            if (projects?.length > 0) {
                const firstProj = projects[0];
                setFormData(prev => {
                    if (!prev.id && !prev.project_name) {
                        const nextPhase = getNextOrderPhaseForProject(firstProj.name, loadedOrders);
                        const template = getProjectMaterialTemplate(firstProj.name);
                        return {
                            ...prev,
                            project_name: firstProj.name,
                            order_phase: nextPhase,
                            categories: template,
                            address: firstProj.address || 'BÌNH HÒA, TP HCM',
                            recipient: (firstProj.cht_name && firstProj.cht_phone)
                                ? `${firstProj.cht_name} (SĐT: ${firstProj.cht_phone})`
                                : 'VÕ NGỌC LÂM (SĐT: 033 2620148)'
                        };
                    } else if (!prev.id) {
                        const nextPhase = getNextOrderPhaseForProject(prev.project_name, loadedOrders);
                        const template = getProjectMaterialTemplate(prev.project_name);
                        return {
                            ...prev,
                            order_phase: nextPhase,
                            categories: template
                        };
                    }
                    return prev;
                });
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        
        if (!formData.project_name) {
            alert('Vui lòng chọn công trình!');
            return;
        }

        setIsLoading(true);
        const payload = {
            project_name: formData.project_name,
            order_phase: formData.order_phase,
            order_date: formData.order_date,
            address: formData.address,
            category: formData.category,
            company: formData.company,
            recipient: formData.recipient,
            items: formData.categories,
            show_signature: formData.show_signature,
            created_by: currentUser.username
        };

        try {
            // Save project material template to localStorage so it remembers the material names/units for next time
            try {
                const projectTemplates = JSON.parse(localStorage.getItem('misa_project_material_templates') || '{}');
                const cleanCategoriesForTemplate = formData.categories.map(cat => ({
                    name: cat.name,
                    items: cat.items.map(it => ({
                        stt: it.stt,
                        name: it.name,
                        unit: it.unit,
                        colorCode: it.colorCode || "",
                        quantity: "", // template has blank quantity
                        price: it.price || ""
                    }))
                }));
                projectTemplates[formData.project_name] = cleanCategoriesForTemplate;
                localStorage.setItem('misa_project_material_templates', JSON.stringify(projectTemplates));
            } catch (tempErr) {
                console.error("Error saving project material template:", tempErr);
            }

            if (isDbStorage) {
                if (formData.id) {
                    const { error } = await supabase
                        .from('material_orders')
                        .update(payload)
                        .eq('id', formData.id);
                    if (error) throw error;
                    showToast('Cập nhật đơn đặt hàng thành công!');
                } else {
                    const { error } = await supabase
                        .from('material_orders')
                        .insert([payload]);
                    if (error) throw error;
                    showToast('Lưu đơn đặt hàng thành công!');
                }
            } else {
                // Lưu LocalStorage
                const localOrders = [...orders];
                if (formData.id) {
                    const idx = localOrders.findIndex(o => o.id === formData.id);
                    if (idx !== -1) {
                        localOrders[idx] = { ...payload, id: formData.id, created_at: localOrders[idx].created_at || new Date().toISOString() };
                    }
                } else {
                    const newOrder = {
                        ...payload,
                        id: 'local_' + Date.now(),
                        created_at: new Date().toISOString()
                    };
                    localOrders.unshift(newOrder);
                }
                localStorage.setItem('misa_material_orders', JSON.stringify(localOrders));
                setOrders(localOrders);
                showToast('Đã lưu đơn hàng cục bộ trên thiết bị!');
            }

            // Tự động chuyển tiếp đơn hàng vật tư sang cho kế toán hạch toán
            if (onCreateAccountingRequest && !formData.id) {
                const itemsList = [];
                formData.categories.forEach(cat => {
                    cat.items.forEach(it => {
                        if (it.quantity && parseFloat(it.quantity) > 0) {
                            itemsList.push({
                                id: it.stt + '_' + Math.random(),
                                content: `- Tên vật tư: ${it.name}${it.colorCode ? `\n- Mã màu: ${it.colorCode}` : ''}\n- Đơn vị: ${it.unit}\n- SL: ${it.quantity}\n- Đơn giá: ${formatCurrency(it.price || 0)}`,
                                amount: ((parseFloat(it.quantity) || 0) * (parseFloat(it.price) || 0)),
                                note: `${cat.name} | ${formData.order_phase}`
                            });
                        }
                    });
                });

                if (itemsList.length > 0) {
                    const grandTotal = formData.categories.reduce((total, cat) => total + cat.items.reduce((sum, item) => sum + ((parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0)), 0), 0);
                    
                    const dnttPayload = {
                        doc_type: 'Đơn Vật Tư',
                        project_name: formData.project_name,
                        recipient: formData.recipient,
                        total_amount: grandTotal,
                        status: 'Waiting QS', // Phải được QS duyệt trước
                        reason: JSON.stringify({
                            docType: 'Đơn Vật Tư',
                            date: formData.order_date,
                            recipient: formData.recipient,
                            project: formData.project_name,
                            paymentMethod: 'chuyen_khoan',
                            orderPhase: formData.order_phase,
                            items: itemsList
                        })
                    };
                    await onCreateAccountingRequest(dnttPayload);
                }
            }

            fetchOrders();
            setView('list');
        } catch (err) {
            console.error(err);
            showToast(`Lỗi khi lưu đơn hàng: ${err?.message || err}. Đang chuyển sang lưu cục bộ!`, 'error');
            // Fallback ngay lập tức sang local
            setIsDbStorage(false);
            const localOrders = [...orders];
            const newOrder = {
                ...payload,
                id: 'local_' + Date.now(),
                created_at: new Date().toISOString()
            };
            localOrders.unshift(newOrder);
            localStorage.setItem('misa_material_orders', JSON.stringify(localOrders));
            setOrders(localOrders);
            setView('list');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id) => {
        setConfirmModal({
            isOpen: true,
            message: 'Bạn có chắc chắn muốn xóa đơn đặt hàng vật tư này (và các yêu cầu thanh toán liên quan)?',
            onConfirm: async () => {
                setConfirmModal({ isOpen: false, message: '', onConfirm: null });
                setIsLoading(true);
                try {
                    const orderToDelete = orders.find(o => o.id === id);
                    
                    if (isDbStorage && !id.toString().startsWith('local_')) {
                        const { error } = await supabase
                            .from('material_orders')
                            .delete()
                            .eq('id', id);
                        if (error) throw error;
                        
                        // Đồng bộ xóa DNTT
                        if (orderToDelete) {
                             const { data: dntts } = await supabase.from('approval_requests')
                                 .select('id, reason')
                                 .eq('project_name', orderToDelete.project_name)
                                 .eq('doc_type', 'Đơn Vật Tư')
                                 .eq('recipient', orderToDelete.recipient);
                             
                             if (dntts) {
                                 for (const dntt of dntts) {
                                     if (dntt.reason && dntt.reason.includes(orderToDelete.order_date)) {
                                          await supabase.from('approval_requests').delete().eq('id', dntt.id);
                                          await supabase.from('transactions').delete().ilike('note', `%[ID:${dntt.id}]%`);
                                     }
                                 }
                             }
                        }
                        
                        showToast('Đã xóa đơn đặt hàng và dữ liệu đồng bộ!');
                    } else {
                        const localOrders = orders.filter(o => o.id !== id);
                        localStorage.setItem('misa_material_orders', JSON.stringify(localOrders));
                        setOrders(localOrders);
                        showToast('Đã xóa đơn đặt hàng cục bộ!');
                    }
                    fetchOrders();
                } catch (err) {
                    showToast('Lỗi khi xóa dữ liệu!', 'error');
                } finally {
                    setIsLoading(false);
                }
            }
        });
    };

    const openCreate = () => {
        const firstProj = projects[0];
        const projName = firstProj?.name || '';
        const nextPhase = getNextOrderPhaseForProject(projName, orders);
        const template = getProjectMaterialTemplate(projName);
        const address = firstProj?.address || 'BÌNH HÒA, TP HCM';
        const recipient = (firstProj?.cht_name && firstProj?.cht_phone)
            ? `${firstProj.cht_name} (SĐT: ${firstProj.cht_phone})`
            : 'VÕ NGỌC LÂM (SĐT: 033 2620148)';

        setFormData({
            id: null,
            project_name: projName,
            order_phase: nextPhase,
            order_date: new Date().toISOString().split('T')[0],
            address: address,
            category: 'THI CÔNG SƠN NƯỚC',
            company: '',
            recipient: recipient,
            categories: template,
            show_signature: true
        });
        setView('create');
    };

    const openEdit = (order) => {
        setFormData({
            id: order.id,
            project_name: order.project_name,
            order_phase: order.order_phase,
            order_date: order.order_date,
            address: order.address,
            category: order.category,
            company: order.company,
            recipient: order.recipient,
            categories: Array.isArray(order.items) ? JSON.parse(JSON.stringify(order.items)) : JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
            show_signature: order.show_signature !== undefined ? order.show_signature : true
        });
        setView('create');
    };

    const openDetail = (order) => {
        setSelectedOrder(order);
        setView('detail');
    };

    const openConfig = () => {
        const proj = configProjectName || projects[0]?.name;
        if (proj) {
            setConfigProjectName(proj);
            setConfigCategories(getProjectMaterialTemplate(proj));
        }
        setView('config');
    };

    const handleSaveConfig = () => {
        if (!configProjectName) return;
        try {
            const projectTemplates = JSON.parse(localStorage.getItem('misa_project_material_templates') || '{}');
            projectTemplates[configProjectName] = configCategories;
            localStorage.setItem('misa_project_material_templates', JSON.stringify(projectTemplates));
            showToast('Đã lưu cấu hình danh mục vật tư cho công trình!');
            setView('list');
        } catch (err) {
            console.error("Error saving project material template:", err);
            showToast('Lỗi khi lưu cấu hình!', 'error');
        }
    };

    // Form logic helpers
    const handleCategoryNameChange = (catIdx, newName) => {
        const updated = [...formData.categories];
        updated[catIdx].name = newName;
        setFormData({ ...formData, categories: updated });
    };

    const handleItemChange = (catIdx, itemIdx, field, value) => {
        const updated = [...formData.categories];
        updated[catIdx].items[itemIdx][field] = value;
        setFormData({ ...formData, categories: updated });
    };

    const addItem = (catIdx) => {
        const updated = [...formData.categories];
        const nextStt = updated[catIdx].items.length + 1;
        updated[catIdx].items.push({
            stt: nextStt,
            name: '',
            unit: 'Thùng/18lit',
            quantity: '',
            colorCode: ''
        });
        setFormData({ ...formData, categories: updated });
    };

    const removeItem = (catIdx, itemIdx) => {
        const updated = [...formData.categories];
        updated[catIdx].items.splice(itemIdx, 1);
        // Re-number STT
        updated[catIdx].items.forEach((item, idx) => {
            item.stt = idx + 1;
        });
        setFormData({ ...formData, categories: updated });
    };

    const addCategory = () => {
        const updated = [...formData.categories];
        updated.push({
            name: 'Hệ vật tư mới',
            items: [
                { stt: 1, name: '', unit: 'Thùng/18lit', quantity: '', colorCode: '' }
            ]
        });
        setFormData({ ...formData, categories: updated });
    };

    const removeCategory = (catIdx) => {
        if (formData.categories.length <= 1) return;
        const updated = [...formData.categories];
        updated.splice(catIdx, 1);
        setFormData({ ...formData, categories: updated });
    };

    const getVietnameseDateComponents = (dateStr) => {
        if (!dateStr) return { day: '...', month: '...', year: '...' };
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return { day: '...', month: '...', year: '...' };
        return {
            day: d.getDate().toString().padStart(2, '0'),
            month: (d.getMonth() + 1).toString().padStart(2, '0'),
            year: d.getFullYear().toString()
        };
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(sqlScript);
        showToast('Đã copy câu lệnh SQL tạo bảng!');
    };

    // Excel Export Logic
    const handleExportExcel = (order) => {
        const orderData = order || selectedOrder;
        if (!orderData) return;

        const dateComp = getVietnameseDateComponents(orderData.order_date);
        const fileName = `Don_Dat_Hang_Vat_Tu_${orderData.project_name.replace(/\s+/g, '_')}_${orderData.order_phase.replace(/\s+/g, '_')}`;

        // Create table HTML for Excel download
        let rowsHtml = '';
        const orderItems = Array.isArray(orderData.items) ? orderData.items : DEFAULT_CATEGORIES;

        orderItems.forEach(cat => {
            const catHasQuantity = cat.items.some(it => parseFloat(it.quantity) > 0);
            if (!catHasQuantity) return;

            rowsHtml += `
                <tr style="height: 40px;">
                    <td colspan="7" style="border: 1px solid #000; font-weight: bold; text-align: center; vertical-align: middle; background-color: #f2f2f2; font-family: 'Times New Roman'; font-size: 13pt;">${cat.name}</td>
                </tr>
            `;
            cat.items.forEach(it => {
                const qty = parseFloat(it.quantity);
                const price = parseFloat(it.price) || 0;
                if (isNaN(qty) || qty <= 0) return;

                rowsHtml += `
                    <tr style="height: 35px;">
                        <td style="border: 1px solid #000; text-align: center; vertical-align: middle; font-family: 'Times New Roman'; font-size: 12pt;">${it.stt}</td>
                        <td style="border: 1px solid #000; vertical-align: middle; font-family: 'Times New Roman'; font-size: 12pt; padding-left: 5px;">${it.name}</td>
                        <td style="border: 1px solid #000; text-align: center; vertical-align: middle; font-family: 'Times New Roman'; font-size: 12pt;">${it.colorCode || ''}</td>
                        <td style="border: 1px solid #000; text-align: center; vertical-align: middle; font-family: 'Times New Roman'; font-size: 12pt;">${it.unit}</td>
                        <td style="border: 1px solid #000; text-align: right; vertical-align: middle; font-weight: bold; font-family: 'Times New Roman'; font-size: 12pt; padding-right: 5px;">${qty}</td>
                        <td style="border: 1px solid #000; text-align: right; vertical-align: middle; font-family: 'Times New Roman'; font-size: 12pt; padding-right: 5px;">${price ? formatCurrency(price) : ''}</td>
                        <td style="border: 1px solid #000; text-align: right; vertical-align: middle; font-weight: bold; color: #1e3a8a; font-family: 'Times New Roman'; font-size: 12pt; padding-right: 5px;">${price && qty ? formatCurrency(price * qty) : ''}</td>
                    </tr>
                `;
            });
        });

        const html = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta charset="utf-8">
                <!--[if gte mso 9]>
                <xml>
                    <x:ExcelWorkbook>
                        <x:ExcelWorksheets>
                            <x:ExcelWorksheet>
                                <x:Name>Don_Dat_Hang</x:Name>
                                <x:WorksheetOptions>
                                    <x:DisplayGridlines/>
                                </x:WorksheetOptions>
                            </x:ExcelWorksheet>
                        </x:ExcelWorksheets>
                    </x:ExcelWorkbook>
                </xml>
                <![endif]-->
                <style>
                    td { vertical-align: middle; }
                </style>
            </head>
            <body>
                <table style="border-collapse: collapse; font-family: 'Times New Roman';">
                    <colgroup>
                        <col width="60" style="width: 60pt;" />
                        <col width="300" style="width: 300pt;" />
                        <col width="100" style="width: 100pt;" />
                        <col width="100" style="width: 100pt;" />
                        <col width="100" style="width: 100pt;" />
                        <col width="100" style="width: 100pt;" />
                        <col width="120" style="width: 120pt;" />
                    </colgroup>
                    
                    <!-- TITLE -->
                    <tr style="height: 55px;">
                        <td colspan="7" style="text-align: center; vertical-align: middle; font-weight: bold; font-size: 16pt; font-family: 'Times New Roman';">
                            ĐƠN ĐẶT HÀNG VẬT TƯ SƠN NƯỚC ${orderData.order_phase.toUpperCase()}
                        </td>
                    </tr>
                    
                    <!-- METADATA (MERGED AND SPACED FOR ABSOLUTE VISUAL BEAUTY, NO CUTS) -->
                    <tr style="height: 35px;">
                        <td colspan="2" style="font-family: 'Times New Roman'; font-size: 12pt; font-weight: bold; vertical-align: middle;">
                            DỰ ÁN :
                        </td>
                        <td colspan="5" style="font-family: 'Times New Roman'; font-size: 12pt; font-weight: bold; color: #1d4ed8; vertical-align: middle;">
                            ${orderData.project_name.toUpperCase()}
                        </td>
                    </tr>
                    <tr style="height: 35px;">
                        <td colspan="2" style="font-family: 'Times New Roman'; font-size: 12pt; font-weight: bold; vertical-align: middle;">
                            ĐỊA CHỈ :
                        </td>
                        <td colspan="5" style="font-family: 'Times New Roman'; font-size: 12pt; vertical-align: middle;">
                            ${(orderData.address || '').toUpperCase()}
                        </td>
                    </tr>
                    <tr style="height: 35px;">
                        <td colspan="2" style="font-family: 'Times New Roman'; font-size: 12pt; font-weight: bold; background-color: #ffff00; border: 1px solid #eab308; vertical-align: middle;">
                            HẠNG MỤC :
                        </td>
                        <td colspan="5" style="font-family: 'Times New Roman'; font-size: 12pt; font-weight: bold; background-color: #ffff00; border: 1px solid #eab308; vertical-align: middle;">
                            ${(orderData.category || '').toUpperCase()}
                        </td>
                    </tr>
                    <tr style="height: 35px;">
                        <td colspan="7" style="font-family: 'Times New Roman'; font-size: 12pt; font-weight: bold; color: #334155; vertical-align: middle;">
                            ${(orderData.company || '').toUpperCase()}
                        </td>
                    </tr>
                    <tr style="height: 35px;">
                        <td colspan="2" style="font-family: 'Times New Roman'; font-size: 12pt; font-weight: bold; vertical-align: middle;">
                            NGƯỜI NHẬN HÀNG :
                        </td>
                        <td colspan="5" style="font-family: 'Times New Roman'; font-size: 12pt; font-weight: bold; color: #0f172a; vertical-align: middle;">
                            ${(orderData.recipient || '').toUpperCase()}
                        </td>
                    </tr>
                    <tr style="height: 20px;"><td colspan="7"></td></tr>
                    
                    <!-- TABLE HEADERS -->
                    <tr style="background-color: #e6e6e6; height: 45px;">
                        <th width="60" style="border: 1px solid #000; vertical-align: middle; font-weight: bold; text-align: center; font-size: 13pt; font-family: 'Times New Roman';">STT</th>
                        <th width="300" style="border: 1px solid #000; font-weight: bold; text-align: center; vertical-align: middle; font-size: 13pt; font-family: 'Times New Roman';">Chủng loại vật tư</th>
                        <th width="100" style="border: 1px solid #000; font-weight: bold; text-align: center; vertical-align: middle; font-size: 13pt; font-family: 'Times New Roman';">Mã màu</th>
                        <th width="100" style="border: 1px solid #000; font-weight: bold; text-align: center; vertical-align: middle; font-size: 13pt; font-family: 'Times New Roman';">DVT</th>
                        <th width="100" style="border: 1px solid #000; font-weight: bold; text-align: center; vertical-align: middle; font-size: 13pt; font-family: 'Times New Roman';">Số lượng</th>
                        <th width="100" style="border: 1px solid #000; font-weight: bold; text-align: center; vertical-align: middle; font-size: 13pt; font-family: 'Times New Roman';">Đơn giá</th>
                        <th width="120" style="border: 1px solid #000; font-weight: bold; text-align: center; vertical-align: middle; font-size: 13pt; font-family: 'Times New Roman';">Thành tiền</th>
                    </tr>
                    
                    ${rowsHtml}
                    
                    <tr style="height: 40px;">
                        <td colspan="6" style="border: 1px solid #000; text-align: right; vertical-align: middle; font-weight: bold; font-family: 'Times New Roman'; font-size: 12pt; padding-right: 5px;">Tổng cộng:</td>
                        <td style="border: 1px solid #000; text-align: right; vertical-align: middle; font-weight: bold; color: #ff0000; font-family: 'Times New Roman'; font-size: 13pt; padding-right: 5px;">
                            ${formatCurrency(orderItems.reduce((total, cat) => total + cat.items.reduce((sum, item) => sum + ((parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0)), 0), 0))} VNĐ
                        </td>
                    </tr>
                    
                    <tr style="height: 30px;"><td colspan="7"></td></tr>
                    
                    <!-- SIGNATURE BLOCK -->
                    <tr>
                        <td colspan="4"></td>
                        <td colspan="3" style="text-align: center; font-style: italic; font-family: 'Times New Roman'; font-size: 12pt;">
                            NGÀY ${dateComp.day} THÁNG ${dateComp.month} NĂM ${dateComp.year}
                        </td>
                    </tr>
                    <tr>
                        <td colspan="4"></td>
                        <td colspan="3" style="text-align: center; font-weight: bold; font-family: 'Times New Roman'; font-size: 12pt;">
                            NGƯỜI LẬP
                        </td>
                    </tr>
                    <tr style="height: 60px;">
                        <td colspan="4"></td>
                        <td colspan="3" style="text-align: center; vertical-align: middle;">
                            ${orderData.show_signature ? `
                            <span style="font-family: 'Brush Script MT', cursive, sans-serif; font-size: 24pt; color: #1e3a8a;">
                                ${getSignatureName(getCommanderName(orderData.recipient))}
                            </span>` : ''}
                        </td>
                    </tr>
                    <tr>
                        <td colspan="4"></td>
                        <td colspan="3" style="text-align: center; font-weight: bold; font-family: 'Times New Roman'; font-size: 12pt;">
                            ${getCommanderName(orderData.recipient)}
                        </td>
                    </tr>
                </table>
            </body>
            </html>
        `;

        const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = fileName + '.xls';
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        showToast('Đã xuất file Excel đơn đặt hàng thành công!');
    };

    // Filtered orders
    const filteredOrders = orders.filter(o => {
        const matchesProject = selectedProjectFilter ? o.project_name === selectedProjectFilter : true;
        const matchesSearch = o.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              o.order_phase.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              o.recipient.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesProject && matchesSearch;
    });

    return (
        <div className="max-w-6xl mx-auto animate-in fade-in duration-500 pb-16">
            
            {/* SQL Banner for Local Storage */}
            {!isDbStorage && !isLoading && (
                <div className="bg-amber-500/10 border-2 border-amber-500/20 text-amber-800 rounded-3xl p-5 mb-8 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm animate-pulse">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-amber-500 text-white rounded-2xl">
                            <Info size={22} />
                        </div>
                        <div>
                            <h4 className="font-extrabold text-sm uppercase tracking-tight">Lưu Trữ Cục Bộ (Local Storage)</h4>
                            <p className="text-xs text-amber-700 mt-1 font-medium leading-relaxed">
                                Đơn đặt hàng đang lưu tạm trên trình duyệt của bạn. Để đồng bộ đám mây và hoạt động ổn định trên Supabase, hãy tạo bảng <strong>material_orders</strong>.
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setShowSqlModal(true)} 
                        className="bg-amber-600 text-white hover:bg-amber-700 px-5 py-2.5 rounded-2xl text-xs font-black transition whitespace-nowrap shadow-md shadow-amber-600/20"
                    >
                        XEM HƯỚNG DẪN SQL
                    </button>
                </div>
            )}

            {/* HEADER AREA */}
            {view === 'list' && (
                <header className="mb-8 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                            <div className="bg-blue-600 p-2.5 rounded-2xl text-white shadow-lg shadow-blue-600/25">
                                <ClipboardList size={22} />
                            </div>
                            <span>Đặt Hàng Vật Tư</span>
                        </h2>
                        <p className="text-slate-500 text-sm mt-1">Lập và quản lý các đơn đặt hàng vật tư, sơn nước cho công trình.</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <button 
                            onClick={openConfig}
                            className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-3 rounded-2xl font-black shadow-xl shadow-slate-800/20 hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2"
                        >
                            <Edit3 size={18} /> THÔNG TIN VẬT TƯ
                        </button>
                        <button 
                            onClick={openCreate}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-black shadow-xl shadow-blue-600/20 hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2"
                        >
                            <Plus size={18} /> LẬP ĐƠN ĐẶT HÀNG MỚI
                        </button>
                    </div>
                </header>
            )}

            {/* LIST VIEW */}
            {view === 'list' && (
                <div className="space-y-6">
                    {/* FILTER BAR */}
                    <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200 flex flex-col lg:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
                            <input 
                                type="text"
                                placeholder="Tìm theo công trình, đợt đặt hàng, người nhận..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-3 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition"
                            />
                        </div>
                        <div className="w-full lg:w-64">
                            <select 
                                value={selectedProjectFilter}
                                onChange={(e) => setSelectedProjectFilter(e.target.value)}
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-600 outline-none focus:border-blue-500 focus:bg-white transition"
                            >
                                <option value="">-- Tất cả công trình --</option>
                                {projects.map(p => (
                                    <option key={p.name} value={p.name}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* CARD GRID */}
                    {filteredOrders.length === 0 ? (
                        <div className="bg-white p-16 text-center rounded-3xl border border-dashed border-slate-300 text-slate-400">
                            <ClipboardList className="mx-auto mb-4 text-slate-300" size={48} />
                            <p className="font-bold text-slate-500 text-lg">Chưa có đơn đặt hàng vật tư nào</p>
                            <p className="text-slate-400 text-sm mt-1">Bấm &quot;Lập đơn đặt hàng mới&quot; để tạo đơn hàng đầu tiên.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {filteredOrders.map((order) => {
                                const itemCount = Array.isArray(order.items) 
                                    ? order.items.reduce((sum, cat) => sum + (cat.items?.length || 0), 0)
                                    : 0;
                                return (
                                    <div 
                                        key={order.id} 
                                        className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:shadow-md hover:border-blue-300 transition-all duration-300 group"
                                    >
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-start">
                                                <span className="px-3 py-1 bg-blue-50 text-blue-700 text-[10px] font-black uppercase rounded-lg border border-blue-100 tracking-wider">
                                                    {order.order_phase}
                                                </span>
                                                <span className="text-xs text-slate-400 font-mono">
                                                    {formatDateVN(order.order_date)}
                                                </span>
                                            </div>
                                            <div>
                                                <h3 className="font-black text-slate-900 text-lg tracking-tight group-hover:text-blue-600 transition">
                                                    ĐƠN ĐẶT HÀNG SƠN NƯỚC
                                                </h3>
                                                <p className="text-xs text-slate-400 mt-1 font-semibold">{order.company}</p>
                                            </div>
                                            
                                            <div className="space-y-2 border-t border-slate-100 pt-4 text-sm text-slate-600">
                                                <div className="flex items-center gap-2.5">
                                                    <Briefcase size={15} className="text-slate-400 shrink-0" />
                                                    <span className="font-bold text-slate-800 truncate">{order.project_name}</span>
                                                </div>
                                                <div className="flex items-center gap-2.5">
                                                    <MapPin size={15} className="text-slate-400 shrink-0" />
                                                    <span className="truncate">{order.address}</span>
                                                </div>
                                                <div className="flex items-center gap-2.5">
                                                    <User size={15} className="text-slate-400 shrink-0" />
                                                    <span className="truncate">Người nhận: <strong className="text-slate-800">{order.recipient.split('(')[0]}</strong></span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                                            <span className="text-xs text-slate-500 font-bold bg-slate-50 px-2.5 py-1 rounded-lg">
                                                {itemCount} chủng loại vật tư
                                            </span>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => openDetail(order)}
                                                    className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition"
                                                    title="Xem Chi Tiết & In Phiếu"
                                                >
                                                    <Printer size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => handleExportExcel(order)}
                                                    className="p-2 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded-xl transition"
                                                    title="Xuất file Excel"
                                                >
                                                    <Download size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => openEdit(order)}
                                                    className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition"
                                                    title="Chỉnh sửa đơn hàng"
                                                >
                                                    <Edit3 size={18} />
                                                </button>
                                                {currentUser?.role?.toUpperCase() === 'ADMIN' && (
                                                    <button 
                                                        onClick={() => handleDelete(order.id)}
                                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition"
                                                        title="Xóa đơn hàng"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* CONFIG VIEW */}
            {view === 'config' && (
                <div className="bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden mt-6">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h3 className="font-black text-xl text-slate-800 flex items-center gap-2">
                            <Edit3 className="text-blue-600" /> Thông tin Danh mục Vật tư
                        </h3>
                        <button onClick={() => setView('list')} className="p-2 bg-slate-200 hover:bg-slate-300 rounded-full transition">
                            <X size={20} className="text-slate-600" />
                        </button>
                    </div>
                    
                    <div className="p-6">
                        <div className="mb-6">
                            <label className="block text-sm font-bold text-slate-700 mb-2">Chọn công trình cần cấu hình:</label>
                            <select
                                value={configProjectName}
                                onChange={(e) => {
                                    const proj = e.target.value;
                                    setConfigProjectName(proj);
                                    setConfigCategories(getProjectMaterialTemplate(proj));
                                }}
                                className="w-full md:w-1/2 p-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold outline-none focus:border-blue-500 transition"
                            >
                                {projects.map(p => (
                                    <option key={p.name} value={p.name}>{p.name}</option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-500 mt-2 italic">Lưu ý: Bạn đang định nghĩa danh sách vật tư mặc định sẽ hiện ra mỗi khi lập Đơn đặt hàng mới cho công trình này.</p>
                        </div>

                        <div className="space-y-6">
                            {configCategories.map((cat, catIdx) => (
                                <div key={catIdx} className="border-2 border-slate-200 rounded-2xl overflow-hidden group">
                                    <div className="bg-slate-100 p-3 border-b-2 border-slate-200 flex items-center justify-between">
                                        <input
                                            type="text"
                                            value={cat.name}
                                            onChange={(e) => {
                                                const updated = [...configCategories];
                                                updated[catIdx].name = e.target.value;
                                                setConfigCategories(updated);
                                            }}
                                            className="font-bold text-blue-900 bg-transparent border-none outline-none w-1/2 focus:ring-2 focus:ring-blue-500 rounded px-2"
                                            placeholder="Tên hạng mục..."
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                if (configCategories.length <= 1) return;
                                                const updated = [...configCategories];
                                                updated.splice(catIdx, 1);
                                                setConfigCategories(updated);
                                            }}
                                            className="text-red-500 hover:bg-red-200 p-1.5 rounded transition"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    <div className="p-4 bg-white">
                                        <div className="space-y-2 mb-3">
                                            {cat.items.map((item, itemIdx) => (
                                                <div key={itemIdx} className="flex gap-2 items-center">
                                                    <span className="w-8 text-center text-xs font-bold text-slate-400">{itemIdx + 1}</span>
                                                    <input 
                                                        type="text" 
                                                        value={item.name}
                                                        onChange={(e) => {
                                                            const updated = [...configCategories];
                                                            updated[catIdx].items[itemIdx].name = e.target.value;
                                                            setConfigCategories(updated);
                                                        }}
                                                        placeholder="Tên vật tư / chủng loại"
                                                        className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:border-blue-500"
                                                    />
                                                    <input 
                                                        type="text" 
                                                        value={item.colorCode || ''}
                                                        onChange={(e) => {
                                                            const updated = [...configCategories];
                                                            updated[catIdx].items[itemIdx].colorCode = e.target.value;
                                                            setConfigCategories(updated);
                                                        }}
                                                        placeholder="Mã màu"
                                                        className="w-24 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-center font-medium outline-none focus:border-blue-500"
                                                    />
                                                    <input 
                                                        type="text" 
                                                        value={item.unit}
                                                        onChange={(e) => {
                                                            const updated = [...configCategories];
                                                            updated[catIdx].items[itemIdx].unit = e.target.value;
                                                            setConfigCategories(updated);
                                                        }}
                                                        placeholder="ĐVT"
                                                        className="w-24 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-center font-medium outline-none focus:border-blue-500"
                                                    />
                                                    <CurrencyInput 
                                                        value={item.price || 0}
                                                        onChange={(val) => {
                                                            const updated = [...configCategories];
                                                            updated[catIdx].items[itemIdx].price = val;
                                                            setConfigCategories(updated);
                                                        }}
                                                        placeholder="Đơn giá"
                                                        className="w-32 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-right font-medium outline-none focus:border-blue-500"
                                                    />
                                                    <button 
                                                        type="button" 
                                                        onClick={() => {
                                                            const updated = [...configCategories];
                                                            updated[catIdx].items.splice(itemIdx, 1);
                                                            updated[catIdx].items.forEach((it, idx) => it.stt = idx + 1);
                                                            setConfigCategories(updated);
                                                        }}
                                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                const updated = [...configCategories];
                                                updated[catIdx].items.push({ stt: updated[catIdx].items.length + 1, name: '', unit: '', quantity: '', price: '', colorCode: '' });
                                                setConfigCategories(updated);
                                            }}
                                            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                        >
                                            <Plus size={14} /> Thêm vật tư
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <div className="mt-4">
                            <button 
                                type="button" 
                                onClick={() => {
                                    const updated = [...configCategories];
                                    updated.push({ name: 'Hạng mục mới', items: [{ stt: 1, name: '', unit: '', quantity: '', price: '', colorCode: '' }] });
                                    setConfigCategories(updated);
                                }}
                                className="text-sm font-bold text-slate-600 hover:text-slate-800 border-2 border-dashed border-slate-300 w-full py-3 rounded-xl hover:border-slate-400 transition flex items-center justify-center gap-2"
                            >
                                <Plus size={16} /> Thêm Hạng Mục Mới
                            </button>
                        </div>
                    </div>
                    
                    <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                        <button type="button" onClick={() => setView('list')} className="px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition">
                            Hủy
                        </button>
                        <button onClick={handleSaveConfig} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-black shadow-lg shadow-blue-600/20 transition flex items-center gap-2">
                            <Save size={18} /> LƯU CẤU HÌNH
                        </button>
                    </div>
                </div>
            )}

            {/* CREATE / EDIT FORM */}
            {view === 'create' && (
                <div className="animate-in zoom-in-95 duration-200">
                    <header className="mb-6 flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                        <div>
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <ClipboardList className="text-blue-600" />
                                {formData.id ? 'Chỉnh Sửa Đơn Đặt Hàng' : 'Lập Đơn Đặt Hàng Vật Tư Mới'}
                            </h3>
                            <p className="text-slate-500 text-sm mt-0.5">Nhập các thông tin vật tư sơn nước cần cung cấp.</p>
                        </div>
                        <button 
                            onClick={() => setView('list')}
                            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-500 transition"
                        >
                            <X size={20} />
                        </button>
                    </header>

                    {/* FORM CONTAINER */}
                    <form onSubmit={handleSave} className="space-y-6">
                        
                        {/* METADATA CONFIG CARD */}
                        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="block text-xs font-black text-slate-900 uppercase">Công trình / Dự án</label>
                                <select 
                                    value={formData.project_name}
                                    onChange={(e) => {
                                        const selectedName = e.target.value;
                                        const proj = projects.find(p => p.name === selectedName);
                                        const address = proj?.address || '';
                                        const recipient = (proj?.cht_name && proj?.cht_phone)
                                            ? `${proj.cht_name} (SĐT: ${proj.cht_phone})`
                                            : 'VÕ NGỌC LÂM (SĐT: 033 2620148)';
                                        const nextPhase = getNextOrderPhaseForProject(selectedName, orders);
                                        const template = getProjectMaterialTemplate(selectedName);
                                        setFormData({ 
                                            ...formData, 
                                            project_name: selectedName, 
                                            address: address || 'BÌNH HÒA, TP HCM', 
                                            recipient: recipient,
                                            order_phase: nextPhase,
                                            categories: template
                                        });
                                    }}
                                    className="w-full p-3.5 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 bg-slate-50 font-bold text-slate-800 transition"
                                    required
                                >
                                    {projects.map(p => (
                                        <option key={p.name} value={p.name}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="space-y-2">
                                <label className="block text-xs font-black text-slate-900 uppercase">Số đợt đặt hàng</label>
                                <input 
                                    type="text"
                                    value={formData.order_phase}
                                    onChange={(e) => setFormData({ ...formData, order_phase: e.target.value })}
                                    placeholder="Ví dụ: Đợt 16"
                                    className="w-full p-3.5 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 bg-slate-50 font-bold text-slate-800 transition"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-black text-slate-900 uppercase">Địa chỉ dự án</label>
                                <input 
                                    type="text"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    placeholder="Địa chỉ công trình..."
                                    className="w-full p-3.5 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 bg-slate-50 font-bold text-slate-800 transition"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-black text-slate-900 uppercase">Hạng mục thi công</label>
                                <input 
                                    type="text"
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className="w-full p-3.5 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 bg-yellow-50 focus:bg-white font-bold text-slate-800 transition"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-black text-slate-900 uppercase">Đơn vị đặt hàng (Công ty)</label>
                                <select 
                                    value={
                                        isCustomCompany ? "custom" : (
                                            [
                                                "CÔNG TY TNHH AKZO NOBEL VIỆT NAM",
                                                "CÔNG TY TNHH THƯƠNG MẠI VÀ XÂY DỰNG THẾ HỆ MỚI",
                                                "Công ty TNHH Sơn Jotun Việt Nam",
                                                "CÔNG TY CỔ PHẦN ĐẦU TƯ SẢN XUẤT LÊ TRẦN",
                                                "CÔNG TY TNHH DT TM DV XÂY DỰNG HOÀNG KIM",
                                                "CÔNG TY CỔ PHẦN XÂY DỰNG VÀ THIẾT KẾ SỐ 1",
                                                "CÔNG TY CP NAM VIỆT ÚC",
                                                "CÔNG TY TNHH MỘT THÀNH VIÊN THƯƠNG MẠI SƠN MINH PHÁT",
                                                "CÔNG TY TNHH SƠN NGHĨA PHÁT",
                                                ""
                                            ].includes(formData.company) ? formData.company : "custom"
                                        )
                                    }
                                    onChange={(e) => {
                                        if (e.target.value === 'custom') {
                                            setIsCustomCompany(true);
                                            setFormData({ ...formData, company: '' });
                                        } else {
                                            setIsCustomCompany(false);
                                            setFormData({ ...formData, company: e.target.value });
                                        }
                                    }}
                                    className="w-full p-3.5 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 bg-slate-50 font-medium text-slate-800 transition"
                                >
                                    <option value="">-- Chọn đơn vị đặt hàng --</option>
                                    <option value="CÔNG TY TNHH AKZO NOBEL VIỆT NAM">CÔNG TY TNHH AKZO NOBEL VIỆT NAM</option>
                                    <option value="CÔNG TY TNHH THƯƠNG MẠI VÀ XÂY DỰNG THẾ HỆ MỚI">CÔNG TY TNHH THƯƠNG MẠI VÀ XÂY DỰNG THẾ HỆ MỚI</option>
                                    <option value="Công ty TNHH Sơn Jotun Việt Nam">Công ty TNHH Sơn Jotun Việt Nam</option>
                                    <option value="CÔNG TY CỔ PHẦN ĐẦU TƯ SẢN XUẤT LÊ TRẦN">CÔNG TY CỔ PHẦN ĐẦU TƯ SẢN XUẤT LÊ TRẦN</option>
                                    <option value="CÔNG TY TNHH DT TM DV XÂY DỰNG HOÀNG KIM">CÔNG TY TNHH DT TM DV XÂY DỰNG HOÀNG KIM</option>
                                    <option value="CÔNG TY CỔ PHẦN XÂY DỰNG VÀ THIẾT KẾ SỐ 1">CÔNG TY CỔ PHẦN XÂY DỰNG VÀ THIẾT KẾ SỐ 1</option>
                                    <option value="CÔNG TY CP NAM VIỆT ÚC">CÔNG TY CP NAM VIỆT ÚC</option>
                                    <option value="CÔNG TY TNHH MỘT THÀNH VIÊN THƯƠNG MẠI SƠN MINH PHÁT">CÔNG TY TNHH MỘT THÀNH VIÊN THƯƠNG MẠI SƠN MINH PHÁT</option>
                                    <option value="CÔNG TY TNHH SƠN NGHĨA PHÁT">CÔNG TY TNHH SƠN NGHĨA PHÁT</option>
                                    <option value="custom">Khác (Nhập tay)...</option>
                                </select>
                                {isCustomCompany || ![
                                    "CÔNG TY TNHH AKZO NOBEL VIỆT NAM",
                                    "CÔNG TY TNHH THƯƠNG MẠI VÀ XÂY DỰNG THẾ HỆ MỚI",
                                    "Công ty TNHH Sơn Jotun Việt Nam",
                                    "CÔNG TY CỔ PHẦN ĐẦU TƯ SẢN XUẤT LÊ TRẦN",
                                    "CÔNG TY TNHH DT TM DV XÂY DỰNG HOÀNG KIM",
                                    "CÔNG TY CỔ PHẦN XÂY DỰNG VÀ THIẾT KẾ SỐ 1",
                                    "CÔNG TY CP NAM VIỆT ÚC",
                                    "CÔNG TY TNHH MỘT THÀNH VIÊN THƯƠNG MẠI SƠN MINH PHÁT",
                                    "CÔNG TY TNHH SƠN NGHĨA PHÁT",
                                    ""
                                ].includes(formData.company) ? (
                                    <input 
                                        type="text"
                                        value={formData.company}
                                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                        placeholder="Nhập tên đơn vị đặt hàng khác..."
                                        className="w-full mt-2 p-3.5 border-2 border-blue-200 rounded-2xl outline-none focus:border-blue-500 bg-white font-medium text-slate-800 transition animate-in slide-in-from-top-2"
                                    />
                                ) : null}
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-black text-slate-900 uppercase">Gợi ý Chỉ Huy Trưởng</label>
                                <select 
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === 'custom') {
                                            setFormData({ ...formData, recipient: '' });
                                        } else if (val) {
                                            setFormData({ ...formData, recipient: val });
                                        }
                                    }}
                                    className="w-full p-3.5 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 bg-slate-50 font-bold text-slate-800 transition"
                                >
                                    <option value="">-- Chọn CHT gợi ý --</option>
                                    {projects.filter(p => p.cht_name).map(p => (
                                        <option key={p.name} value={`${p.cht_name} (SĐT: ${p.cht_phone || ''})`}>
                                            {p.cht_name} - CHT {p.name} {p.cht_phone ? `(SĐT: ${p.cht_phone})` : ''}
                                        </option>
                                    ))}
                                    <option value="custom">Tự nhập người nhận khác...</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-black text-slate-900 uppercase">Người nhận hàng & SĐT thực tế</label>
                                <input 
                                    type="text"
                                    value={formData.recipient}
                                    onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
                                    placeholder="Nhập tên người nhận và SĐT..."
                                    className="w-full p-3.5 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 bg-slate-50 font-bold text-slate-800 transition"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-black text-slate-900 uppercase">Ngày lập đơn</label>
                                <input 
                                    type="date"
                                    value={formData.order_date}
                                    onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                                    className="w-full p-3.5 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 bg-slate-50 font-bold text-slate-800 transition"
                                    required
                                />
                            </div>

                            <div className="flex items-center gap-3 pt-6">
                                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 text-sm select-none">
                                    <input 
                                        type="checkbox"
                                        checked={formData.show_signature}
                                        onChange={(e) => setFormData({ ...formData, show_signature: e.target.checked })}
                                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                    />
                                    Hiển thị chữ ký người lập tự động
                                </label>
                            </div>
                        </div>

                        {/* EXCEL SHEET INTERACTIVE GRID */}
                        <div className="bg-white border border-slate-200 shadow-xl rounded-3xl overflow-hidden p-6 md:p-10 font-['Times_New_Roman',_serif] text-[15px] text-black">
                            
                            {/* SHEET TITLE */}
                            <div className="text-center mb-6">
                                <h1 className="font-extrabold text-xl md:text-2xl uppercase tracking-wider">
                                    ĐƠN ĐẶT HÀNG VẬT TƯ SƠN NƯỚC {formData.order_phase.toUpperCase()}
                                </h1>
                            </div>

                            {/* GRID SUMMARY INFO */}
                            <div className="mb-6 space-y-1.5 border-l-4 border-yellow-400 pl-4 py-1">
                                <div className="flex flex-col sm:flex-row gap-0.5 sm:gap-2">
                                    <span className="font-bold whitespace-nowrap min-w-[165px] shrink-0">DỰ ÁN :</span>
                                    <span className="font-bold text-blue-700 break-words">{formData.project_name.toUpperCase()}</span>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-0.5 sm:gap-2">
                                    <span className="font-bold whitespace-nowrap min-w-[165px] shrink-0">ĐỊA CHỈ :</span>
                                    <span className="break-words">{formData.address.toUpperCase()}</span>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-0.5 sm:gap-2">
                                    <span className="font-bold bg-yellow-300 px-1 border border-yellow-400 whitespace-nowrap min-w-[165px] shrink-0">HẠNG MỤC :</span>
                                    <span className="font-bold bg-yellow-300 px-1 border border-yellow-400 break-words">{formData.category.toUpperCase()}</span>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-0.5 sm:gap-2 text-slate-700">
                                    <span className="font-bold text-slate-700 break-words">{formData.company.toUpperCase()}</span>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-0.5 sm:gap-2">
                                    <span className="font-bold whitespace-nowrap min-w-[165px] shrink-0">NGƯỜI NHẬN HÀNG :</span>
                                    <span className="font-bold text-slate-900 break-words">{formData.recipient.toUpperCase()}</span>
                                </div>
                            </div>

                            {/* EXCEL GRID TABLE */}
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse border border-black min-w-[600px]">
                                    <thead>
                                        <tr className="bg-slate-100">
                                            <th className="border border-black p-2 text-center w-16">STT</th>
                                            <th className="border border-black p-2 text-left">Chủng loại vật tư</th>
                                            <th className="border border-black p-2 text-center w-28">Mã màu</th>
                                            <th className="border border-black p-2 text-center w-28">DVT</th>
                                            <th className="border border-black p-2 text-center w-28">Số lượng</th>
                                            <th className="border border-black p-2 text-center w-36">Đơn giá</th>
                                            <th className="border border-black p-2 text-right w-40">Thành tiền</th>
                                            <th className="border-none w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formData.categories.map((cat, catIdx) => (
                                            <React.Fragment key={catIdx}>
                                                {/* CATEGORY HEADER ROW */}
                                                <tr className="bg-slate-50">
                                                    <td colSpan="7" className="border border-black p-2 text-center font-bold text-base uppercase text-slate-800">
                                                        {cat.name}
                                                    </td>
                                                    <td className="border-none"></td>
                                                </tr>

                                                {/* CATEGORY ITEMS */}
                                                {cat.items.map((item, itemIdx) => (
                                                    <tr key={itemIdx} className="group/row">
                                                        <td className="border border-black p-2 text-center font-medium">{item.stt}</td>
                                                        <td className="border border-black p-2">
                                                            <input 
                                                                type="text"
                                                                value={item.name}
                                                                onChange={(e) => handleItemChange(catIdx, itemIdx, 'name', e.target.value)}
                                                                placeholder="Nhập tên vật tư..."
                                                                className="w-full outline-none bg-transparent"
                                                                required
                                                            />
                                                        </td>
                                                        <td className="border border-black p-2">
                                                            <input 
                                                                type="text"
                                                                value={item.colorCode || ''}
                                                                onChange={(e) => handleItemChange(catIdx, itemIdx, 'colorCode', e.target.value)}
                                                                className="w-full outline-none bg-transparent text-center"
                                                                placeholder="Mã màu..."
                                                            />
                                                        </td>
                                                        <td className="border border-black p-2">
                                                            <input 
                                                                type="text"
                                                                value={item.unit}
                                                                onChange={(e) => handleItemChange(catIdx, itemIdx, 'unit', e.target.value)}
                                                                className="w-full outline-none bg-transparent text-center"
                                                                placeholder="Bao/40kg..."
                                                            />
                                                        </td>
                                                        <td className="border border-black p-2">
                                                            <input 
                                                                type="number"
                                                                min="0"
                                                                value={item.quantity}
                                                                onChange={(e) => {
                                                                    let val = e.target.value === '' ? '' : parseInt(e.target.value);
                                                                    if (val !== '' && val < 0) val = 0;
                                                                    handleItemChange(catIdx, itemIdx, 'quantity', val);
                                                                }}
                                                                className="w-full outline-none text-right font-bold bg-transparent text-slate-900"
                                                                placeholder="-"
                                                            />
                                                        </td>
                                                        <td className="border border-black p-2">
                                                            <CurrencyInput 
                                                                value={item.price || 0}
                                                                onChange={(val) => handleItemChange(catIdx, itemIdx, 'price', val)}
                                                                placeholder="Đơn giá"
                                                                className="w-full outline-none text-right font-medium bg-transparent text-slate-900"
                                                            />
                                                        </td>
                                                        <td className="border border-black p-2 text-right font-bold text-blue-800">
                                                            {(parseFloat(item.quantity) || 0) > 0 && (parseFloat(item.price) || 0) > 0 ? formatCurrency(parseFloat(item.quantity) * parseFloat(item.price)) : ''}
                                                        </td>
                                                        <td className="border-none align-middle pl-2">
                                                            <button 
                                                                type="button" 
                                                                onClick={() => removeItem(catIdx, itemIdx)}
                                                                className="text-red-400 hover:text-red-600 opacity-0 group-hover/row:opacity-100 transition p-1"
                                                                title="Xóa dòng"
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}

                                                {/* ADD ROW BUTTON */}
                                                <tr>
                                                    <td colSpan="7" className="border border-black p-1 text-center bg-slate-50/50 hover:bg-slate-50 cursor-pointer text-blue-600 transition font-sans text-xs font-bold" onClick={() => addItem(catIdx)}>
                                                        + Thêm dòng vật tư vào &quot;{cat.name}&quot;
                                                    </td>
                                                    <td className="border-none"></td>
                                                </tr>
                                            </React.Fragment>
                                        ))}
                                        <tr>
                                            <td colSpan="6" className="border border-black p-3 text-right font-extrabold uppercase text-slate-900 bg-slate-100">
                                                Tổng cộng:
                                            </td>
                                            <td className="border border-black p-3 text-right font-black text-red-600 text-[17px] bg-slate-100">
                                                {formatCurrency(formData.categories.reduce((total, cat) => total + cat.items.reduce((sum, item) => sum + ((parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0)), 0), 0))} VNĐ
                                            </td>
                                            <td className="border-none"></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Cố định chỉ gồm Hệ nội thất & Hệ ngoại thất */}

                            {/* SIGNATURE BLOCK */}
                            <div className="mt-12 flex justify-end font-sans">
                                <div className="text-center w-72 space-y-1">
                                    <p className="text-xs uppercase font-extrabold tracking-widest text-slate-400">
                                        NGÀY {getVietnameseDateComponents(formData.order_date).day} THÁNG {getVietnameseDateComponents(formData.order_date).month} NĂM {getVietnameseDateComponents(formData.order_date).year}
                                    </p>
                                    <p className="font-extrabold text-sm text-slate-800">NGƯỜI LẬP</p>
                                    
                                    {/* SIGNATURE BOX */}
                                    <div className="h-20 flex items-center justify-center">
                                        {formData.show_signature && (
                                            <div className="font-['Brush_Script_MT',_cursive,_sans-serif] text-4xl text-blue-700 select-none animate-in fade-in duration-300">
                                                {getSignatureName(getCommanderName(formData.recipient))}
                                            </div>
                                        )}
                                    </div>
                                    
                                    <p className="font-extrabold text-slate-900 border-t border-slate-100 pt-2 text-sm uppercase">
                                        {getCommanderName(formData.recipient)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* SUBMIT BUTTONS */}
                        <div className="flex gap-4">
                            <button 
                                type="button" 
                                onClick={() => setView('list')} 
                                className="bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold py-3.5 px-6 rounded-2xl flex-1 transition"
                            >
                                Hủy bỏ
                            </button>
                            <button 
                                type="submit" 
                                disabled={isLoading} 
                                className="bg-blue-600 text-white hover:bg-blue-700 font-black py-3.5 px-8 rounded-2xl flex-1 shadow-lg shadow-blue-600/20 hover:-translate-y-0.5 transition flex items-center justify-center gap-2"
                            >
                                <Save size={18} /> LƯU ĐƠN ĐẶT HÀNG
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* PRINT PREVIEW / DETAIL VIEW */}
            {view === 'detail' && selectedOrder && (
                <div className="space-y-6">
                    <header className="mb-6 flex flex-wrap justify-between items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm print:hidden">
                        <div>
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <ClipboardList className="text-blue-600" /> Xem Chi Tiết Đơn Đặt Hàng
                            </h3>
                            <p className="text-slate-500 text-sm mt-0.5">Dưới đây là bản xem trước của đơn đặt hàng chuẩn in A4.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button 
                                onClick={() => window.print()}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-2xl font-bold transition flex items-center gap-2 shadow-md shadow-blue-600/20"
                            >
                                <Printer size={18} /> In Phiếu
                            </button>
                            <button 
                                onClick={() => handleExportExcel(selectedOrder)}
                                className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-2xl font-bold transition flex items-center gap-2 shadow-md shadow-green-600/20"
                            >
                                <Download size={18} /> Xuất Excel
                            </button>
                            <button 
                                onClick={() => openEdit(selectedOrder)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2.5 rounded-2xl font-bold transition flex items-center gap-2"
                            >
                                <Edit3 size={18} /> Sửa Đơn
                            </button>
                            <button 
                                onClick={() => setView('list')}
                                className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-500 transition"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </header>

                    {/* DỰ ÁN PREVIEW SIMULATOR */}
                    <div className="print-area bg-white border-2 border-slate-200 shadow-2xl rounded-3xl overflow-hidden p-8 md:p-16 font-['Times_New_Roman',_serif] text-[16px] text-black print:border-none print:shadow-none print:p-0 w-full max-w-[800px] mx-auto min-h-[1050px] flex flex-col justify-between">
                        
                        <div>
                            {/* SHEET TITLE */}
                            <div className="text-center mb-8">
                                <h1 className="font-extrabold text-2xl uppercase tracking-wider leading-normal">
                                    ĐƠN ĐẶT HÀNG VẬT TƯ SƠN NƯỚC {selectedOrder.order_phase.toUpperCase()}
                                </h1>
                            </div>

                            {/* GRID SUMMARY INFO */}
                            <div className="mb-8 space-y-2 text-[15px] pl-2">
                                <div className="flex flex-col sm:flex-row gap-0.5 sm:gap-2">
                                    <span className="font-bold whitespace-nowrap min-w-[165px] shrink-0">DỰ ÁN :</span>
                                    <span className="font-bold text-black text-lg break-words">{selectedOrder.project_name.toUpperCase()}</span>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-0.5 sm:gap-2">
                                    <span className="font-bold whitespace-nowrap min-w-[165px] shrink-0">ĐỊA CHỈ :</span>
                                    <span className="break-words">{selectedOrder.address.toUpperCase()}</span>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-0.5 sm:gap-2">
                                    <span className="font-bold whitespace-nowrap min-w-[165px] shrink-0">HẠNG MỤC :</span>
                                    <span className="font-bold break-words">{selectedOrder.category.toUpperCase()}</span>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-0.5 sm:gap-2 text-slate-700">
                                    <span className="font-semibold text-slate-800 break-words">{selectedOrder.company.toUpperCase()}</span>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-0.5 sm:gap-2">
                                    <span className="font-bold whitespace-nowrap min-w-[165px] shrink-0">NGƯỜI NHẬN HÀNG :</span>
                                    <span className="font-bold text-black break-words">{selectedOrder.recipient.toUpperCase()}</span>
                                </div>
                            </div>

                            {/* EXCEL GRID TABLE */}
                            <div className="overflow-x-auto print:overflow-visible">
                                <table className="w-full border-collapse border border-black min-w-[600px] print:min-w-0">
                                    <thead>
                                        <tr className="text-black bg-slate-100">
                                            <th className="border border-black p-2.5 text-center w-16 font-bold text-[15px]">STT</th>
                                            <th className="border border-black p-2.5 text-left font-bold text-[15px]">Chủng loại vật tư</th>
                                            <th className="border border-black p-2.5 text-center w-28 font-bold text-[15px]">Mã màu</th>
                                            <th className="border border-black p-2.5 text-center w-20 font-bold text-[15px]">DVT</th>
                                            <th className="border border-black p-2.5 text-center w-24 font-bold text-[15px]">Số lượng</th>
                                            <th className="border border-black p-2.5 text-center w-32 font-bold text-[15px]">Đơn giá</th>
                                            <th className="border border-black p-2.5 text-right w-36 font-bold text-[15px]">Thành tiền</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(Array.isArray(selectedOrder.items) ? selectedOrder.items : DEFAULT_CATEGORIES).map((cat, catIdx) => (
                                            <React.Fragment key={catIdx}>
                                                {/* CATEGORY HEADER ROW */}
                                                <tr>
                                                    <td colSpan="7" className="border border-black p-2 text-center font-bold text-[15px] uppercase text-black bg-slate-50">
                                                        {cat.name}
                                                    </td>
                                                </tr>

                                                {/* CATEGORY ITEMS */}
                                                {cat.items.map((item, itemIdx) => (
                                                    <tr key={itemIdx}>
                                                        <td className="border border-black p-2 text-center font-medium">{item.stt}</td>
                                                        <td className="border border-black p-2 pl-4">{item.name}</td>
                                                        <td className="border border-black p-2 text-center">{item.colorCode || ''}</td>
                                                        <td className="border border-black p-2 text-center">{item.unit}</td>
                                                        <td className="border border-black p-2 text-center font-bold">
                                                            {item.quantity || '-'}
                                                        </td>
                                                        <td className="border border-black p-2 text-right pr-4">
                                                            {item.price ? formatCurrency(item.price) : '-'}
                                                        </td>
                                                        <td className="border border-black p-2 text-right pr-4 font-bold text-blue-800">
                                                            {(parseFloat(item.quantity) || 0) > 0 && (parseFloat(item.price) || 0) > 0 ? formatCurrency(parseFloat(item.quantity) * parseFloat(item.price)) : '-'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        ))}
                                        <tr>
                                            <td colSpan="6" className="border border-black p-3 text-right font-bold uppercase text-black bg-slate-100">
                                                Tổng cộng:
                                            </td>
                                            <td className="border border-black p-3 text-right font-bold text-red-600 text-[17px] bg-slate-100">
                                                {formatCurrency((Array.isArray(selectedOrder.items) ? selectedOrder.items : DEFAULT_CATEGORIES).reduce((total, cat) => total + cat.items.reduce((sum, item) => sum + ((parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0)), 0), 0))} VNĐ
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* SIGNATURE BLOCK */}
                        <div className="mt-12 flex justify-end font-sans">
                            <div className="text-center w-80 space-y-1">
                                <p className="text-xs uppercase font-extrabold tracking-widest text-slate-400">
                                    NGÀY {getVietnameseDateComponents(selectedOrder.order_date).day} THÁNG {getVietnameseDateComponents(selectedOrder.order_date).month} NĂM {getVietnameseDateComponents(selectedOrder.order_date).year}
                                </p>
                                <p className="font-extrabold text-sm text-slate-800">NGƯỜI LẬP</p>
                                
                                <div className="h-20 flex items-center justify-center">
                                    {selectedOrder.show_signature && (
                                        <div className="font-['Brush_Script_MT',_cursive,_sans-serif] text-4xl text-blue-700 select-none">
                                            {getSignatureName(getCommanderName(selectedOrder.recipient))}
                                        </div>
                                    )}
                                </div>
                                
                                <p className="font-bold text-black border-t border-black pt-2 text-sm uppercase">
                                    {getCommanderName(selectedOrder.recipient)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SQL CODE POPUP MODAL */}
            {showSqlModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <header className="bg-slate-900 text-white p-6 flex justify-between items-center">
                            <h3 className="font-extrabold text-lg uppercase tracking-tight">Cấu hình Bảng Supabase</h3>
                            <button 
                                onClick={() => setShowSqlModal(false)}
                                className="p-1.5 bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
                            >
                                <X size={18} />
                            </button>
                        </header>
                        
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-slate-500 font-medium">
                                Hãy copy đoạn mã SQL bên dưới và dán vào phần **SQL Editor** trong giao diện Supabase của bạn để khởi tạo bảng lưu trữ đám mây vĩnh viễn:
                            </p>
                            
                            <div className="relative">
                                <pre className="bg-slate-950 text-slate-300 p-4 rounded-2xl text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-56 select-all">
                                    {sqlScript}
                                </pre>
                                <button 
                                    onClick={copyToClipboard}
                                    className="absolute top-2 right-2 p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                                    title="Copy mã SQL"
                                >
                                    <Copy size={16} />
                                </button>
                            </div>
                            
                            <div className="p-4 bg-blue-50 border border-blue-100 text-blue-800 rounded-2xl flex items-start gap-3">
                                <Check size={18} className="shrink-0 mt-0.5 text-blue-600" />
                                <p className="text-xs font-medium">
                                    Sau khi chạy xong câu lệnh SQL này, vui lòng reload lại trang web để hệ thống tự động nhận dạng bảng mới và đồng bộ dữ liệu của bạn!
                                </p>
                            </div>
                        </div>
                        
                        <footer className="p-6 bg-slate-50 border-t border-slate-100 text-right">
                            <button 
                                onClick={() => setShowSqlModal(false)}
                                className="bg-slate-900 text-white hover:bg-slate-800 px-6 py-2.5 rounded-xl font-bold text-xs transition"
                            >
                                ĐÃ HIỂU
                            </button>
                        </footer>
                    </div>
                </div>
            )}

            {/* PRINT STYLE STYLING */}
            <style jsx global>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    main {
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    .print\\:border-none {
                        border: none !important;
                    }
                    .print\\:shadow-none {
                        box-shadow: none !important;
                    }
                    .print\\:p-0 {
                        padding: 0 !important;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                    div:has(> table) {
                        overflow: visible !important;
                    }
                    .print-area {
                        visibility: visible !important;
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                    .print-area * {
                        visibility: visible !important;
                    }
                }
            `}</style>

            <ConfirmModal 
                isOpen={confirmModal.isOpen} 
                message={confirmModal.message} 
                onConfirm={confirmModal.onConfirm} 
                onCancel={() => setConfirmModal({ isOpen: false, message: '', onConfirm: null })} 
            />
        </div>
    );
}
