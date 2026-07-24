'use client';
/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    ClipboardList, Plus, Trash2, Edit3, Edit2, Printer, 
    Download, Save, X, Search, MapPin, Briefcase, 
    User, Calendar, Info, Check, Copy, Eye, EyeOff
} from 'lucide-react';
import { formatCurrency, formatDateVN } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import ConfirmModal from './ConfirmModal';
import CurrencyInput from './CurrencyInput';

export const DEFAULT_CATEGORIES = [
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

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const getMaterialOrderPhaseSources = (projectName, ordersList = [], dnttList = []) => {
    if (!projectName) return [];
    const normalizedProjectName = normalizeText(projectName);
    const projectOrders = (ordersList || []).filter(o =>
        normalizeText(o.project_name) === normalizedProjectName && !o.is_deleted
    );

    const dnttOrders = (dnttList || []).reduce((acc, d) => {
        if (d.doc_type !== 'Đơn Vật Tư' || normalizeText(d.project_name) !== normalizedProjectName) return acc;
        try {
            const parsed = JSON.parse(d.reason || '{}');
            if (parsed.orderPhase) {
                acc.push({
                    project_name: d.project_name,
                    order_phase: parsed.orderPhase,
                    is_deleted: d.status === 'Deleted' || d.status === 'Đã xóa'
                });
            }
        } catch (e) {}
        return acc;
    }, []);

    return [...projectOrders, ...dnttOrders].filter(o => !o.is_deleted);
};

const getNextOrderPhaseForProject = (projectName, ordersList = [], dnttList = []) => {
    if (!projectName) return 'ĐỢT 1';
    const projectOrders = getMaterialOrderPhaseSources(projectName, ordersList, dnttList);
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

const getProjectMaterialTemplateData = (projectName, allTemplates = {}) => {
    if (!projectName) return { versions: [] };
    const projData = allTemplates[projectName];
    if (Array.isArray(projData) && projData.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        return {
            versions: [{ id: Date.now().toString(), date: today, categories: projData }]
        };
    }
    if (projData && projData.versions) {
        return projData;
    }
    return { versions: [] };
};

const getProjectMaterialTemplate = (projectName, allTemplates = {}, versionId = null) => {
    const data = getProjectMaterialTemplateData(projectName, allTemplates);
    if (!data || !data.versions || data.versions.length === 0) return JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
    if (versionId) {
        const ver = data.versions.find(v => v.id === versionId);
        if (ver) return JSON.parse(JSON.stringify(ver.categories));
    }
    const activeVerId = data.activeVersionId;
    if (activeVerId) {
        const ver = data.versions.find(v => v.id === activeVerId);
        if (ver) return JSON.parse(JSON.stringify(ver.categories));
    }
    return JSON.parse(JSON.stringify(data.versions[data.versions.length - 1].categories));
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

const calculateMaterialSubtotal = (categories = []) => {
    return (Array.isArray(categories) ? categories : []).reduce((total, cat) => {
        const items = Array.isArray(cat?.items) ? cat.items : [];
        return total + items.reduce((sum, item) => {
            return sum + ((parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0));
        }, 0);
    }, 0);
};

const calculateMaterialTotals = (categories = []) => {
    const subtotal = calculateMaterialSubtotal(categories);
    const vat = Math.round(subtotal * 0.08);
    return {
        subtotal,
        vat,
        totalAfterTax: subtotal + vat
    };
};

export default function MaterialOrder({ currentUser, usersList, projects, showToast, onCreateAccountingRequest, dnttList, onUpdateAccountingRequest, realtimeVersion }) {
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
    const recipientInputRef = useRef(null);



    const moveRecordsToTrash = async (tableName, records = []) => {
        const validRecords = records.filter(Boolean);
        if (validRecords.length === 0) return;
        const trashRecords = validRecords.map(record => ({
            original_table: tableName,
            record_data: JSON.stringify(record),
            deleted_by: currentUser?.username || 'unknown',
            deleted_at: new Date().toISOString()
        }));

        try {
            const { error } = await supabase.from('trash_bin').insert(trashRecords);
            if (error) throw error;
        } catch(e) {
            const saved = localStorage.getItem('system_trash_bin');
            const parsed = saved ? JSON.parse(saved) : [];
            trashRecords.forEach((tr, idx) => parsed.unshift({ ...tr, id: `local_${Date.now()}_${idx}` }));
            localStorage.setItem('system_trash_bin', JSON.stringify(parsed));
        }
    };

    const [allTemplates, setAllTemplates] = useState({});
    const [showPriceCols, setShowPriceCols] = useState(true);
    const [showNonEmptyOnly, setShowNonEmptyOnly] = useState(false);
    const [isCustomCategory, setIsCustomCategory] = useState(false);
    const categoryInputRef = useRef(null);
    const [isCustomOrderCompany, setIsCustomOrderCompany] = useState(false);
    const orderCompanyInputRef = useRef(null);

    // Form state
    const [formData, setFormData] = useState({
        id: null,
        project_name: '',
        order_phase: '',
        order_date: new Date().toISOString().split('T')[0],
        address: '',
        category: '',
        company: '',
        order_company: 'CÔNG TY TNHH XDTM TTNT QT PHÚC KHANG',
        recipient: '',
        categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
        show_signature: true,
        configVersionId: ''
    });

    const projectPersonnel = useMemo(() => {
        if (!formData?.project_name || !projects) return [];
        const proj = projects.find(p => p.name === formData.project_name);
        if (!proj) return [];

        const names = (proj.cht_name || '').split(',').map(s => s.trim()).filter(Boolean);
        const phones = (proj.cht_phone || '').split(',').map(s => s.trim()).filter(Boolean);

        return names.map((name, index) => {
            let phone = phones[index] || '';
            if (!phone && usersList) {
                const u = usersList.find(user => user.name === name);
                if (u?.phone) phone = u.phone;
            }
            return { name, phone };
        });
    }, [formData.project_name, projects, usersList]);

    const updateFormDataForProject = (projectName, templatesMap = allTemplates) => {
        const proj = projects.find(p => p.name === projectName);
        if (!proj) return;
        const nextPhase = getNextOrderPhaseForProject(proj.name, orders, dnttList);
        const templateData = getProjectMaterialTemplateData(proj.name, templatesMap);
        const activeVerId = templateData.activeVersionId || (templateData.versions?.[0]?.id) || '';
        const template = getProjectMaterialTemplate(proj.name, templatesMap, activeVerId);
        
        setFormData(prev => ({
            ...prev,
            project_name: projectName,
            order_phase: nextPhase,
            address: proj.address || '',
            recipient: proj.cht_name ? (proj.cht_phone ? `${proj.cht_name} (SĐT: ${proj.cht_phone})` : proj.cht_name) : '',
            categories: template,
            configVersionId: activeVerId
        }));
    };

    // Auto-update initial project selections on asynchronous projects load
    useEffect(() => {
        if (projects?.length > 0 && !formData.id && !formData.project_name) {
            updateFormDataForProject(projects[0].name, allTemplates);
        }
    }, [projects, orders, allTemplates]);

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

    const getMatchedRequest = (order) => {
        if (!dnttList || dnttList.length === 0) return null;
        return dnttList.find(d => {
            if (d.doc_type !== 'Đơn Vật Tư') return false;
            try {
                const parsed = JSON.parse(d.reason);
                if (parsed.material_order_id && parsed.material_order_id === order.id) return true;
                
                // Fallback matching
                return d.project_name === order.project_name && 
                       parsed.orderPhase === order.order_phase &&
                       parsed.date === order.order_date;
            } catch (e) {
                return false;
            }
        }) || null;
    };

    const fetchOrders = async () => {
        setIsLoading(true);
        try {
            // Lấy templates từ Supabase
            let templatesMap = {};
            try {
                const res = await supabase.from('material_templates').select('*');
                if (res.data) {
                    res.data.forEach(row => {
                        templatesMap[row.project_name] = row.data;
                    });
                }
            } catch(e) {}

            // Thử lấy thêm từ localStorage để phòng hờ Supabase bị lỗi không lưu được
            try {
                const localStr = localStorage.getItem('misa_project_material_templates');
                if (localStr) {
                    const localData = JSON.parse(localStr);
                    for (const proj of Object.keys(localData)) {
                        if (!templatesMap[proj]) {
                            templatesMap[proj] = localData[proj];
                        }
                    }
                }
            } catch(e) {}

            setAllTemplates(templatesMap);

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
                        const nextPhase = getNextOrderPhaseForProject(firstProj.name, data, dnttList);
                        const templateData = getProjectMaterialTemplateData(firstProj.name, templatesMap);
                        const activeVerId = templateData.activeVersionId || (templateData.versions?.[0]?.id) || '';
                        const template = getProjectMaterialTemplate(firstProj.name, templatesMap, activeVerId);
                        return {
                            ...prev,
                            project_name: firstProj.name,
                            order_phase: nextPhase,
                            categories: template,
                            configVersionId: activeVerId,
                            address: firstProj.address || '',
                            recipient: firstProj.cht_name 
                                ? (firstProj.cht_phone ? `${firstProj.cht_name} (SĐT: ${firstProj.cht_phone})` : firstProj.cht_name) 
                                : ''
                        };
                    } else if (!prev.id) {
                        // Project name already set by state default, let's update phase and template
                        const nextPhase = getNextOrderPhaseForProject(prev.project_name, data, dnttList);
                        const templateData = getProjectMaterialTemplateData(prev.project_name, templatesMap);
                        const activeVerId = templateData.activeVersionId || (templateData.versions?.[0]?.id) || '';
                        const template = getProjectMaterialTemplate(prev.project_name, templatesMap, activeVerId);
                        return {
                            ...prev,
                            order_phase: nextPhase,
                            configVersionId: activeVerId,
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
                        const nextPhase = getNextOrderPhaseForProject(firstProj.name, loadedOrders, dnttList);
                        const templateData = getProjectMaterialTemplateData(firstProj.name, allTemplates);
                        const activeVerId = templateData.activeVersionId || (templateData.versions?.[0]?.id) || '';
                        const template = getProjectMaterialTemplate(firstProj.name, allTemplates, activeVerId);
                        return {
                            ...prev,
                            project_name: firstProj.name,
                            order_phase: nextPhase,
                            categories: template,
                            configVersionId: activeVerId,
                            address: firstProj.address || '',
                            recipient: firstProj.cht_name 
                                ? (firstProj.cht_phone ? `${firstProj.cht_name} (SĐT: ${firstProj.cht_phone})` : firstProj.cht_name) 
                                : ''
                        };
                    } else if (!prev.id) {
                        const nextPhase = getNextOrderPhaseForProject(prev.project_name, loadedOrders, dnttList);
                        const templateData = getProjectMaterialTemplateData(prev.project_name, allTemplates);
                        const activeVerId = templateData.activeVersionId || (templateData.versions?.[0]?.id) || '';
                        const template = getProjectMaterialTemplate(prev.project_name, allTemplates, activeVerId);
                        return {
                            ...prev,
                            order_phase: nextPhase,
                            configVersionId: activeVerId,
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

    useEffect(() => {
        if (realtimeVersion > 0) {
            fetchOrders();
        }
    }, [realtimeVersion]);

    const handleSave = async (e) => {
        e.preventDefault();
        
        if (!formData.project_name) {
            showToast('Vui lòng chọn công trình!', 'error');
            return;
        }

        const selectedProjForSave = projects.find(p => p.name === formData.project_name);
        const isMainContractorSave = selectedProjForSave?.project_type === 'TỔNG THẦU MUA HỘ';

        if (!isMainContractorSave) {
            if (!formData.address || !formData.address.trim()) {
                showToast('Vui lòng nhập địa chỉ dự án!', 'error');
                return;
            }
            if (!formData.company || !formData.company.trim()) {
                showToast('Vui lòng chọn/nhập nhà cung cấp!', 'error');
                return;
            }
            if (!formData.recipient || !formData.recipient.trim()) {
                showToast('Vui lòng nhập người nhận hàng!', 'error');
                return;
            }
        }

        const existingPhaseOrder = getMaterialOrderPhaseSources(formData.project_name, orders, dnttList).find(o => 
            normalizeText(o.project_name) === normalizeText(formData.project_name) && 
            normalizeText(o.order_phase) === normalizeText(formData.order_phase) && 
            o.id !== formData.id
        );

        if (existingPhaseOrder) {
            showToast(`Dự án này đã có Đơn đặt hàng cho ${formData.order_phase}! Vui lòng chọn đợt khác.`, 'error');
            return;
        }

        setIsLoading(true);

        const payload = {
            project_name: formData.project_name,
            order_phase: formData.order_phase,
            order_date: formData.order_date,
            address: isMainContractorSave ? '' : formData.address,
            category: formData.category,
            company: isMainContractorSave ? '' : formData.company,
            recipient: formData.recipient,
            items: formData.categories,
            show_signature: formData.show_signature,
            created_by: currentUser.username
        };

        if (payload.items && payload.items.length > 0) {
            let pbName = '';
            if (formData.price_batch) {
                // formData.price_batch is "Đợt giá: {date || id}"
                // We need to store the actual version ID. 
                const projData = getProjectMaterialTemplateData(formData.project_name, allTemplates);
                const selectedVer = projData?.versions?.find(v => `Đợt giá: ${v.id}` === formData.price_batch);
                if (selectedVer) {
                    pbName = selectedVer.id;
                } else {
                    pbName = formData.price_batch.replace('Đợt giá: ', '').trim();
                }
            }
            payload.items[0]._price_batch = pbName;
            payload.items[0]._order_company = formData.order_company || '';
        }

        try {
            let savedOrderId = formData.id;
            if (isDbStorage) {
                if (formData.id) {
                    const { error } = await supabase
                        .from('material_orders')
                        .update(payload)
                        .eq('id', formData.id);
                    if (error) throw error;
                    showToast('Cập nhật đơn đặt hàng thành công!');
                } else {
                    const { data: insertedOrder, error } = await supabase
                        .from('material_orders')
                        .insert([payload])
                        .select('id')
                        .single();
                    if (error) throw error;
                    savedOrderId = insertedOrder?.id || null;
                    showToast('Lưu đơn đặt hàng thành công!');
                }
            } else {
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

            const selectedProj = projects.find(p => p.name === formData.project_name);
            const isMainContractor = selectedProj?.project_type === 'TỔNG THẦU MUA HỘ';

            if ((onCreateAccountingRequest || onUpdateAccountingRequest) && !isMainContractor && isDbStorage) {
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
                    const grandTotal = calculateMaterialSubtotal(formData.categories);
                    const grandTotalAfterTax = Math.round(grandTotal * 1.08);
                    
                    const dnttPayload = {
                        doc_type: 'Đơn Vật Tư',
                        project_name: formData.project_name,
                        recipient: formData.company || formData.recipient,
                        total_amount: grandTotalAfterTax,
                        status: 'Waiting QS', 
                        reason: JSON.stringify({
                            docType: 'Đơn Vật Tư',
                            date: formData.order_date,
                            recipient: formData.company || formData.recipient,
                            project: formData.project_name,
                            paymentMethod: 'chuyen_khoan',
                            orderPhase: formData.order_phase,
                            priceBatch: formData.configVersionId,
                            material_order_id: savedOrderId,
                            items: itemsList
                        })
                    };
                    
                    if (onUpdateAccountingRequest && savedOrderId) {
                        await onUpdateAccountingRequest(savedOrderId, dnttPayload);
                    } else if (onCreateAccountingRequest) {
                        await onCreateAccountingRequest(dnttPayload);
                    }
                }
            }

            fetchOrders();
            if (isMainContractorSave) {
                showToast('Đã lưu đơn mua hộ. Xem tại tab "Quản Lý Đơn Order Hộ".', 'success');
            }
            setView('list');
        } catch (err) {
            console.error(err);
            showToast(`Lỗi khi lưu đơn hàng: ${err?.message || err}. Đang chuyển sang lưu cục bộ!`, 'error');
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
            message: 'Bạn có chắc chắn muốn chuyển đơn vật tư này (và các yêu cầu thanh toán liên quan) vào thùng rác?',
            onConfirm: async () => {
                setConfirmModal({ isOpen: false, message: '', onConfirm: null });
                setIsLoading(true);
                try {
                    const orderToDelete = orders.find(o => o.id === id);
                    
                    if (isDbStorage && !id.toString().startsWith('local_')) {
                        await moveRecordsToTrash('material_orders', orderToDelete ? [orderToDelete] : []);
                        const { error } = await supabase
                            .from('material_orders')
                            .delete()
                            .eq('id', id);
                        if (error) throw error;
                        
                         if (orderToDelete) {
                              const { data: dntts } = await supabase.from('approval_requests')
                                  .select('*')
                                  .eq('project_name', orderToDelete.project_name)
                                  .eq('doc_type', 'Đơn Vật Tư')
                                  .eq('recipient', orderToDelete.recipient);
                             
                             if (dntts) {
                                  for (const dntt of dntts) {
                                      if (dntt.reason && dntt.reason.includes(orderToDelete.order_date)) {
                                           const { data: relatedTransactions } = await supabase
                                               .from('transactions')
                                               .select('*')
                                               .ilike('note', `%[ID:${dntt.id}]%`);
                                           await moveRecordsToTrash('approval_requests', [dntt]);
                                           await moveRecordsToTrash('transactions', relatedTransactions || []);
                                           await supabase.from('approval_requests').delete().eq('id', dntt.id);
                                           await supabase.from('transactions').delete().ilike('note', `%[ID:${dntt.id}]%`);
                                      }
                                 }
                             }
                        }
                        
                        showToast('Đã chuyển đơn đặt hàng và dữ liệu đồng bộ vào thùng rác!');
                    } else {
                        const localOrders = orders.filter(o => o.id !== id);
                        localStorage.setItem('misa_material_orders', JSON.stringify(localOrders));
                        setOrders(localOrders);
                        showToast('Đã chuyển đơn đặt hàng vào thùng rác!');
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
        const nextPhase = getNextOrderPhaseForProject(projName, orders, dnttList);
        const templateData = getProjectMaterialTemplateData(firstProj.name, allTemplates);
        const activeVerId = templateData.activeVersionId || (templateData.versions?.[0]?.id) || '';
        const template = getProjectMaterialTemplate(firstProj.name, allTemplates, activeVerId);
        const recipient = firstProj?.cht_name 
            ? (firstProj.cht_phone ? `${firstProj.cht_name} (SĐT: ${firstProj.cht_phone})` : firstProj.cht_name) 
            : '';

        setFormData({
            id: null,
            project_name: firstProj.name,
            order_phase: nextPhase,
            order_date: new Date().toISOString().split('T')[0],
            address: firstProj.address || '',
            category: 'SƠN NƯỚC',
            company: '',
            order_company: 'CÔNG TY TNHH XDTM TTNT QT PHÚC KHANG',
            recipient: recipient,
            categories: template,
            show_signature: true,
            configVersionId: activeVerId
        });
        setView('create');
    };

    const openDetail = (order) => {
        setSelectedOrder(order);
        setView('detail');
    };

    const openEdit = (order) => {
        let pb = '';
        if (order.items && order.items.length > 0 && order.items[0]._price_batch) {
            pb = order.items[0]._price_batch;
        }
        let orderCompany = 'CÔNG TY TNHH XDTM TTNT QT PHÚC KHANG';
        if (order.items && order.items.length > 0 && order.items[0]._order_company) {
            orderCompany = order.items[0]._order_company;
        } else if (order.order_company) {
            orderCompany = order.order_company;
        }
        setFormData({
            id: order.id,
            project_name: order.project_name,
            order_phase: order.order_phase,
            order_date: order.order_date,
            address: order.address,
            category: order.category,
            company: order.company,
            order_company: orderCompany,
            recipient: order.recipient,
            categories: Array.isArray(order.items) ? JSON.parse(JSON.stringify(order.items)) : JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
            show_signature: order.show_signature !== undefined ? order.show_signature : true,
            configVersionId: pb
        });
        setView('create');
    };

    // Form logic helpers
    const handleItemChange = (catIdx, itemIdx, field, value) => {
        const updated = [...formData.categories];
        updated[catIdx].items[itemIdx][field] = value;
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
        const orderTotals = calculateMaterialTotals(orderItems);

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
                        ${showPriceCols ? `<td style="border: 1px solid #000; text-align: right; vertical-align: middle; font-family: 'Times New Roman'; font-size: 12pt; padding-right: 5px;">${price ? formatCurrency(price) : ''}</td>
                        <td style="border: 1px solid #000; text-align: right; vertical-align: middle; font-weight: bold; color: #1e3a8a; font-family: 'Times New Roman'; font-size: 12pt; padding-right: 5px;">${price && qty ? formatCurrency(price * qty) : ''}</td>` : ''}
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
                        ${showPriceCols ? `<col width="100" style="width: 100pt;" />
                        <col width="120" style="width: 120pt;" />` : ''}
                    </colgroup>
                    
                    <!-- TITLE -->
                    <tr style="height: 55px;">
                        <td colspan="${showPriceCols ? 7 : 5}" style="text-align: center; vertical-align: middle; font-weight: bold; font-size: 16pt; font-family: 'Times New Roman';">
                            ĐƠN ĐẶT HÀNG VẬT TƯ SƠN NƯỚC ${orderData.order_phase.toUpperCase()}
                        </td>
                    </tr>
                    
                    <!-- METADATA (MERGED AND SPACED FOR ABSOLUTE VISUAL BEAUTY, NO CUTS) -->
                    <tr style="height: 35px;">
                        <td colspan="2" style="font-family: 'Times New Roman'; font-size: 12pt; font-weight: bold; vertical-align: middle;">
                            DỰ ÁN :
                        </td>
                        <td colspan="${showPriceCols ? 5 : 3}" style="font-family: 'Times New Roman'; font-size: 12pt; font-weight: bold; color: #1d4ed8; vertical-align: middle;">
                            ${orderData.project_name.toUpperCase()}
                        </td>
                    </tr>
                    <tr style="height: 35px;">
                        <td colspan="2" style="font-family: 'Times New Roman'; font-size: 12pt; font-weight: bold; vertical-align: middle;">
                            ĐỊA CHỈ :
                        </td>
                        <td colspan="${showPriceCols ? 5 : 3}" style="font-family: 'Times New Roman'; font-size: 12pt; vertical-align: middle;">
                            ${(orderData.address || '').toUpperCase()}
                        </td>
                    </tr>
                    <tr style="height: 35px;">
                        <td colspan="2" style="font-family: 'Times New Roman'; font-size: 12pt; font-weight: bold; background-color: #ffff00; border: 1px solid #eab308; vertical-align: middle;">
                            HẠNG MỤC :
                        </td>
                        <td colspan="${showPriceCols ? 5 : 3}" style="font-family: 'Times New Roman'; font-size: 12pt; font-weight: bold; background-color: #ffff00; border: 1px solid #eab308; vertical-align: middle;">
                            ${(orderData.category || '').toUpperCase()}
                        </td>
                    </tr>
                    <tr style="height: 35px;">
                        <td colspan="2" style="font-family: 'Times New Roman'; font-size: 12pt; font-weight: bold; vertical-align: middle;">
                            CÔNG TY ĐẶT HÀNG :
                        </td>
                        <td colspan="${showPriceCols ? 5 : 3}" style="font-family: 'Times New Roman'; font-size: 12pt; font-weight: bold; color: #000000; vertical-align: middle;">
                            ${(orderData.items?.[0]?._order_company || orderData.order_company || 'CÔNG TY CỔ PHẦN TRANG TRÍ NỘI THẤT INTERNATIONAL PK').toUpperCase()}
                        </td>
                    </tr>
                    <tr style="height: 35px;">
                        <td colspan="2" style="font-family: 'Times New Roman'; font-size: 12pt; font-weight: bold; vertical-align: middle;">
                            NHÀ CUNG CẤP :
                        </td>
                        <td colspan="${showPriceCols ? 5 : 3}" style="font-family: 'Times New Roman'; font-size: 12pt; font-weight: bold; color: #000000; vertical-align: middle;">
                            ${(orderData.company || '').toUpperCase()}
                        </td>
                    </tr>
                    <tr style="height: 35px;">
                        <td colspan="2" style="font-family: 'Times New Roman'; font-size: 12pt; font-weight: bold; vertical-align: middle;">
                            NGƯỜI NHẬN HÀNG :
                        </td>
                        <td colspan="${showPriceCols ? 5 : 3}" style="font-family: 'Times New Roman'; font-size: 12pt; font-weight: bold; color: #0f172a; vertical-align: middle;">
                            ${(orderData.recipient || '').toUpperCase()}
                        </td>
                    </tr>
                    <tr style="height: 20px;"><td colspan="${showPriceCols ? 7 : 5}"></td></tr>
                    
                    <!-- TABLE HEADERS -->
                    <tr style="background-color: #e6e6e6; height: 45px;">
                        <th width="60" style="border: 1px solid #000; vertical-align: middle; font-weight: bold; text-align: center; font-size: 13pt; font-family: 'Times New Roman';">STT</th>
                        <th width="300" style="border: 1px solid #000; font-weight: bold; text-align: center; vertical-align: middle; font-size: 13pt; font-family: 'Times New Roman';">Chủng loại vật tư</th>
                        <th width="100" style="border: 1px solid #000; font-weight: bold; text-align: center; vertical-align: middle; font-size: 13pt; font-family: 'Times New Roman';">Mã màu</th>
                        <th width="100" style="border: 1px solid #000; font-weight: bold; text-align: center; vertical-align: middle; font-size: 13pt; font-family: 'Times New Roman';">DVT</th>
                        <th width="100" style="border: 1px solid #000; font-weight: bold; text-align: center; vertical-align: middle; font-size: 13pt; font-family: 'Times New Roman';">Số lượng</th>
                        ${showPriceCols ? `<th width="100" style="border: 1px solid #000; font-weight: bold; text-align: center; vertical-align: middle; font-size: 13pt; font-family: 'Times New Roman';">Đơn giá</th>
                        <th width="120" style="border: 1px solid #000; font-weight: bold; text-align: center; vertical-align: middle; font-size: 13pt; font-family: 'Times New Roman';">Thành tiền</th>` : ''}
                    </tr>
                    
                    ${rowsHtml}
                    
                    ${showPriceCols ? `
                    <tr style="height: 40px;">
                        <td colspan="6" style="border: 1px solid #000; text-align: right; vertical-align: middle; font-weight: bold; font-family: 'Times New Roman'; font-size: 12pt; padding-right: 5px;">Tổng trước thuế:</td>
                        <td style="border: 1px solid #000; text-align: right; vertical-align: middle; font-weight: bold; color: #1e3a8a; font-family: 'Times New Roman'; font-size: 13pt; padding-right: 5px;">
                            ${formatCurrency(orderTotals.subtotal)} VNĐ
                        </td>
                    </tr>
                    <tr style="height: 40px;">
                        <td colspan="6" style="border: 1px solid #000; text-align: right; vertical-align: middle; font-weight: bold; font-family: 'Times New Roman'; font-size: 12pt; padding-right: 5px;">Thuế VAT (8%):</td>
                        <td style="border: 1px solid #000; text-align: right; vertical-align: middle; font-weight: bold; color: #ff0000; font-family: 'Times New Roman'; font-size: 13pt; padding-right: 5px;">
                            ${formatCurrency(orderTotals.vat)} VNĐ
                        </td>
                    </tr>
                    <tr style="height: 40px;">
                        <td colspan="6" style="border: 1px solid #000; text-align: right; vertical-align: middle; font-weight: bold; font-family: 'Times New Roman'; font-size: 12pt; padding-right: 5px;">Tổng sau thuế:</td>
                        <td style="border: 1px solid #000; text-align: right; vertical-align: middle; font-weight: bold; color: #ff0000; font-family: 'Times New Roman'; font-size: 13pt; padding-right: 5px;">
                            ${formatCurrency(orderTotals.totalAfterTax)} VNĐ
                        </td>
                    </tr>` : ''}
                    
                    <tr style="height: 30px;"><td colspan="${showPriceCols ? 7 : 5}"></td></tr>
                    
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

    // Filtered orders — chỉ hàng chờ đơn trực tiếp (nháp hoặc bị từ chối); đơn mua hộ nằm ở tab Quản lý Order Hộ
    const isMuaHoProject = (projectName) =>
        projects.find(p => p.name === projectName)?.project_type === 'TỔNG THẦU MUA HỘ';

    const filteredOrders = orders.filter(o => {
        if (isMuaHoProject(o.project_name)) return false;

        const allowedProjectNames = projects
            .filter(p => p.project_type !== 'TỔNG THẦU MUA HỘ')
            .map(p => p.name);
        if (!allowedProjectNames.includes(o.project_name)) return false;

        const matchesProject = selectedProjectFilter ? o.project_name === selectedProjectFilter : true;
        const matchesSearch = o.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              o.order_phase.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              o.recipient.toLowerCase().includes(searchTerm.toLowerCase());
        
        const req = getMatchedRequest(o);
        const status = req ? req.status : 'Draft';
        const isPlaced = status !== 'Rejected' && status !== 'Bị từ chối' && status !== 'Draft';

        return matchesProject && matchesSearch && !isPlaced;
    });

    return (
        <div className="w-full animate-in fade-in duration-500 pb-16">
            
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
                        <p className="text-slate-500 text-sm mt-1">Hàng chờ đơn đặt hàng trực tiếp (nháp hoặc bị từ chối). Đơn mua hộ xem tại tab Quản Lý Đơn Order Hộ.</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
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
                                {projects.filter(p => p.project_type !== 'TỔNG THẦU MUA HỘ').map(p => (
                                    <option key={p.name} value={p.name}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* CARD GRID */}
                    {filteredOrders.length === 0 ? (
                        <div className="bg-white p-16 text-center rounded-3xl border border-dashed border-slate-300 text-slate-400">
                            <ClipboardList className="mx-auto mb-4 text-slate-300" size={48} />
                            <p className="font-bold text-slate-500 text-lg">Chưa có đơn trực tiếp nào trong hàng chờ</p>
                            <p className="text-slate-400 text-sm mt-1">Bấm &quot;Lập đơn đặt hàng mới&quot; để tạo đơn, hoặc kiểm tra tab Quản Lý Đơn Order Hộ cho đơn mua hộ.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {filteredOrders.map((order) => {
                                const itemCount = Array.isArray(order.items) 
                                    ? order.items.reduce((sum, cat) => sum + (cat.items?.length || 0), 0)
                                    : 0;
                                const req = getMatchedRequest(order);
                                const isRejected = req && (req.status === 'Rejected' || req.status === 'Bị từ chối');
                                return (
                                    <div 
                                        key={order.id} 
                                        className={`bg-white rounded-3xl shadow-sm border ${isRejected ? 'border-red-300 bg-red-50/30' : 'border-slate-200'} p-6 flex flex-col justify-between hover:shadow-md hover:border-blue-300 transition-all duration-300 group`}
                                    >
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-start">
                                                <div className="flex gap-2 items-center">
                                                    <span className="px-3 py-1 bg-blue-50 text-blue-700 text-[10px] font-black uppercase rounded-lg border border-blue-100 tracking-wider">
                                                        {order.order_phase}
                                                    </span>
                                                    {isRejected && (
                                                        <span className="px-3 py-1 bg-red-100 text-red-700 text-[10px] font-black uppercase rounded-lg border border-red-200 tracking-wider">
                                                            Bị Từ Chối
                                                        </span>
                                                    )}
                                                </div>
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
                                                {(currentUser?.role?.toUpperCase() === 'ADMIN' || (currentUser?.role?.toUpperCase()?.startsWith('KẾ TOÁN') && currentUser?.role?.toUpperCase() !== 'KẾ TOÁN THUẾ') || currentUser?.department?.toUpperCase() === 'KẾ TOÁN') && (
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
                        
                        {/* ALERT FOR TỔNG THẦU MUA HỘ */}
                        {projects.find(p => p.name === formData.project_name)?.project_type === 'TỔNG THẦU MUA HỘ' && (
                            <div className="bg-amber-50 text-amber-800 p-4 rounded-2xl border border-amber-200 flex items-start gap-3 shadow-sm animate-in slide-in-from-top">
                                <Info size={24} className="text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-black text-sm uppercase tracking-tight text-amber-900">CÔNG TRÌNH TỔNG THẦU MUA HỘ</h4>
                                    <p className="text-sm mt-1 text-amber-800/80 font-medium">Đơn đặt vật tư này sẽ chỉ được lưu để theo dõi tiến độ nhập kho, <strong>KHÔNG tạo Đề nghị thanh toán (DNTT)</strong> sang bên hệ thống kế toán.</p>
                                </div>
                            </div>
                        )}

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
                                        const recipient = proj?.cht_name ? (proj.cht_phone ? `${proj.cht_name} (SĐT: ${proj.cht_phone})` : proj.cht_name) : '';
                                        const nextPhase = getNextOrderPhaseForProject(selectedName, orders, dnttList);
                                        const templateData = getProjectMaterialTemplateData(selectedName, allTemplates);
                                        const activeVerId = templateData.activeVersionId || (templateData.versions?.[0]?.id) || '';
                                        const template = getProjectMaterialTemplate(selectedName, allTemplates, activeVerId);
                                        setFormData({ 
                                            ...formData, 
                                            project_name: selectedName, 
                                            address: address || '',
                                            recipient: recipient,
                                            order_phase: nextPhase,
                                            categories: template,
                                            configVersionId: activeVerId
                                        });
                                    }}
                                    className="w-full p-3.5 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 bg-slate-50 font-bold text-slate-800 transition"
                                    required
                                >
                                    {projects.map(p => {
                                        const isCompleted = p.status === 'Finish';
                                        const isCurrentProject = formData.project_name === p.name;
                                        return (
                                            <option key={p.name} value={p.name} disabled={isCompleted && !isCurrentProject}>
                                                {p.name} {isCompleted ? ' (FINISH - ĐÃ KHÓA)' : ''}
                                            </option>
                                        );
                                    })}
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

                            {projects.find(p => p.name === formData.project_name)?.project_type !== 'TỔNG THẦU MUA HỘ' && (
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
                            )}

                            <div className="space-y-2">
                                <label className="block text-xs font-black text-slate-900 uppercase">Đợt giá áp dụng (Thay đổi đơn giá)</label>
                                <select 
                                    value={formData.price_batch || ''}
                                    onChange={(e) => {
                                        const selectedVerId = e.target.value;
                                        setFormData(prev => {
                                            const newData = { ...prev, price_batch: selectedVerId };
                                            if (selectedVerId) {
                                                const projData = getProjectMaterialTemplateData(prev.project_name, allTemplates);
                                                const selectedVer = projData?.versions?.find(v => `Đợt giá: ${v.id}` === selectedVerId);
                                                if (selectedVer && selectedVer.categories) {
                                                    const newCats = JSON.parse(JSON.stringify(prev.categories));
                                                    newCats.forEach(cat => {
                                                        cat.items.forEach(item => {
                                                            const verCat = selectedVer.categories.find(c => c.name === cat.name);
                                                            if (verCat) {
                                                                const verItem = verCat.items.find(i => i.name === item.name && (i.colorCode || '') === (item.colorCode || ''));
                                                                if (verItem) {
                                                                    item.price = verItem.price;
                                                                }
                                                            }
                                                        });
                                                    });
                                                    newData.categories = newCats;
                                                }
                                            }
                                            return newData;
                                        });
                                    }}
                                    className="w-full p-3.5 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 bg-slate-50 font-bold text-slate-800 transition"
                                >
                                    <option value="">-- Giữ nguyên đơn giá hiện tại --</option>
                                    {(getProjectMaterialTemplateData(formData.project_name, allTemplates)?.versions || []).map((v, vIdx) => (
                                        <option key={v.id} value={`Đợt giá: ${v.id}`}>{v.name || `Đơn giá lần ${vIdx + 1}`} (Áp dụng từ {formatDateVN(v.date)})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-black text-slate-900 uppercase">Hạng mục thi công</label>
                                <select
                                    value={["SƠN NƯỚC", "THẠCH CAO"].includes(formData.category) ? formData.category : (formData.category === '' ? 'SƠN NƯỚC' : 'custom')}
                                    onChange={(e) => {
                                        if (e.target.value === 'custom') {
                                            setIsCustomCategory(true);
                                            setFormData({ ...formData, category: '' });
                                            setTimeout(() => {
                                                if (categoryInputRef.current) categoryInputRef.current.focus();
                                            }, 50);
                                        } else {
                                            setIsCustomCategory(false);
                                            setFormData({ ...formData, category: e.target.value });
                                        }
                                    }}
                                    className="w-full p-3.5 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 bg-slate-50 font-bold text-slate-800 transition"
                                >
                                    <option value="SƠN NƯỚC">SƠN NƯỚC (SN)</option>
                                    <option value="THẠCH CAO">THẠCH CAO (TC)</option>
                                    <option value="custom">Khác (Nhập tay)...</option>
                                </select>
                                {(isCustomCategory || !["SƠN NƯỚC", "THẠCH CAO", ""].includes(formData.category)) && (
                                    <input 
                                        ref={categoryInputRef}
                                        type="text"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        placeholder="Nhập tên hạng mục khác..."
                                        className="w-full mt-2 p-3.5 border-2 border-blue-200 rounded-2xl outline-none focus:border-blue-500 bg-white font-medium text-slate-800 transition animate-in slide-in-from-top-2"
                                        required
                                    />
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-black text-slate-900 uppercase">Công ty đặt hàng</label>
                                <select
                                    value={
                                        isCustomOrderCompany ? "custom" : (
                                            [
                                                "CÔNG TY TNHH XDTM TTNT QT PHÚC KHANG",
                                                "CÔNG TY CỔ PHẦN TRANG TRÍ NỘI THẤT INTERNATIONAL PK"
                                            ].includes(formData.order_company) ? formData.order_company : (formData.order_company === '' ? '' : 'custom')
                                        )
                                    }
                                    onChange={(e) => {
                                        if (e.target.value === 'custom') {
                                            setIsCustomOrderCompany(true);
                                            setFormData({ ...formData, order_company: '' });
                                            setTimeout(() => {
                                                if (orderCompanyInputRef.current) {
                                                    orderCompanyInputRef.current.focus();
                                                }
                                            }, 50);
                                        } else {
                                            setIsCustomOrderCompany(false);
                                            setFormData({ ...formData, order_company: e.target.value });
                                        }
                                    }}
                                    className="w-full p-3.5 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 bg-slate-50 font-bold text-slate-800 transition"
                                    required
                                >
                                    <option value="">-- Chọn công ty đặt hàng --</option>
                                    <option value="CÔNG TY TNHH XDTM TTNT QT PHÚC KHANG">CÔNG TY TNHH XDTM TTNT QT PHÚC KHANG</option>
                                    <option value="CÔNG TY CỔ PHẦN TRANG TRÍ NỘI THẤT INTERNATIONAL PK">CÔNG TY CỔ PHẦN TRANG TRÍ NỘI THẤT INTERNATIONAL PK</option>
                                    <option value="custom">Khác (Nhập tay)...</option>
                                </select>
                                {(isCustomOrderCompany || ![
                                    "CÔNG TY TNHH XDTM TTNT QT PHÚC KHANG",
                                    "CÔNG TY CỔ PHẦN TRANG TRÍ NỘI THẤT INTERNATIONAL PK",
                                    ""
                                ].includes(formData.order_company)) && (
                                    <input 
                                        ref={orderCompanyInputRef}
                                        type="text"
                                        value={formData.order_company}
                                        onChange={(e) => setFormData({ ...formData, order_company: e.target.value })}
                                        placeholder="Nhập tên công ty đặt hàng khác..."
                                        className="w-full mt-2 p-3.5 border-2 border-blue-200 rounded-2xl outline-none focus:border-blue-500 bg-white font-medium text-slate-800 transition animate-in slide-in-from-top-2"
                                        required
                                    />
                                )}
                            </div>

                            {projects.find(p => p.name === formData.project_name)?.project_type !== 'TỔNG THẦU MUA HỘ' && (
                                <div className="space-y-2">
                                    <label className="block text-xs font-black text-slate-900 uppercase">Nhà cung cấp</label>
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
                                        <option value="">-- Chọn nhà cung cấp --</option>
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
                                            placeholder="Nhập tên nhà cung cấp khác..."
                                            className="w-full mt-2 p-3.5 border-2 border-blue-200 rounded-2xl outline-none focus:border-blue-500 bg-white font-medium text-slate-800 transition animate-in slide-in-from-top-2"
                                        />
                                    ) : null}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="block text-xs font-black text-slate-900 uppercase">Gợi ý người nhận hàng từ danh sách</label>
                                <select 
                                    value={projectPersonnel.some(p => (p.phone ? `${p.name} (SĐT: ${p.phone})` : p.name) === formData.recipient) ? formData.recipient : (formData.recipient === '' ? '' : 'custom')}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === 'custom') {
                                            setFormData({ ...formData, recipient: '' });
                                            setTimeout(() => {
                                                if (recipientInputRef.current) {
                                                    recipientInputRef.current.focus();
                                                }
                                            }, 50);
                                        } else if (val) {
                                            setFormData({ ...formData, recipient: val });
                                        }
                                    }}
                                    className="w-full p-3.5 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 bg-slate-50 font-bold text-slate-800 transition"
                                >
                                    <option value="">-- Chọn nhân sự gợi ý (CHT, GS) --</option>
                                    {projectPersonnel.map((p, idx) => (
                                        <option key={idx} value={p.phone ? `${p.name} (SĐT: ${p.phone})` : p.name}>
                                            {p.name} {p.phone ? `- SĐT: ${p.phone}` : ''}
                                        </option>
                                    ))}
                                    <option value="custom">Khác (Nhập tay nếu là công nhân...)</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-black text-slate-900 uppercase">Người nhận hàng & SĐT thực tế</label>
                                <input 
                                    ref={recipientInputRef}
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
                                                    <tr key={itemIdx} className="group/row hover:bg-slate-50/50">
                                                        <td className="border border-black p-2 text-center font-medium text-sm text-slate-500">{itemIdx + 1}</td>
                                                        <td className="border border-black p-2 font-bold text-slate-800">
                                                            {item.name}
                                                        </td>
                                                        <td className="border border-black p-2 text-center text-sm font-medium text-slate-600">
                                                            {item.colorCode}
                                                        </td>
                                                        <td className="border border-black p-2 text-center text-sm font-medium text-slate-600">
                                                            {item.unit}
                                                        </td>
                                                        <td className="border border-black p-1 bg-yellow-50/30">
                                                            <input 
                                                                type="number"
                                                                inputMode="numeric"
                                                                min="0"
                                                                step="any"
                                                                value={item.quantity === undefined || item.quantity === null || item.quantity === '' ? '' : item.quantity}
                                                                onChange={(e) => {
                                                                    const raw = e.target.value;
                                                                    if (raw === '') {
                                                                        handleItemChange(catIdx, itemIdx, 'quantity', '');
                                                                        return;
                                                                    }
                                                                    const val = parseFloat(raw);
                                                                    if (isNaN(val) || val < 0) {
                                                                        handleItemChange(catIdx, itemIdx, 'quantity', 0);
                                                                    } else {
                                                                        handleItemChange(catIdx, itemIdx, 'quantity', val);
                                                                    }
                                                                }}
                                                                onFocus={(e) => e.target.select()}
                                                                className="w-full px-2 py-2 outline-none text-center font-bold bg-transparent text-blue-700 placeholder:text-slate-300 placeholder:font-normal placeholder:text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:bg-yellow-100/60 rounded transition-colors cursor-text"
                                                                placeholder="Nhập SL..."
                                                            />
                                                        </td>
                                                        <td className="border border-black p-2 text-right text-sm font-medium text-slate-500">
                                                            {formatCurrency(item.price)}
                                                        </td>
                                                        <td className="border border-black p-2 text-right font-bold text-red-600">
                                                            {(parseFloat(item.quantity) || 0) > 0 && (parseFloat(item.price) || 0) > 0 ? formatCurrency(parseFloat(item.quantity) * parseFloat(item.price)) : ''}
                                                        </td>
                                                        <td className="border-none"></td>
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        ))}
                                        {(() => {
                                            const totals = calculateMaterialTotals(formData.categories);
                                            return (
                                                <>
                                                    <tr>
                                                        <td colSpan="6" className="border border-black p-3 text-right font-extrabold uppercase text-slate-900 bg-slate-100">
                                                            Tổng trước thuế:
                                                        </td>
                                                        <td className="border border-black p-3 text-right font-black text-blue-800 text-[17px] bg-slate-100">
                                                            {formatCurrency(totals.subtotal)} VNĐ
                                                        </td>
                                                        <td className="border-none"></td>
                                                    </tr>
                                                    <tr>
                                                        <td colSpan="6" className="border border-black p-3 text-right font-extrabold uppercase text-slate-900 bg-slate-100">
                                                            Thuế VAT (8%):
                                                        </td>
                                                        <td className="border border-black p-3 text-right font-black text-red-600 text-[17px] bg-slate-100">
                                                            {formatCurrency(totals.vat)} VNĐ
                                                        </td>
                                                        <td className="border-none"></td>
                                                    </tr>
                                                    <tr>
                                                        <td colSpan="6" className="border border-black p-3 text-right font-extrabold uppercase text-slate-900 bg-slate-100">
                                                            Tổng sau thuế:
                                                        </td>
                                                        <td className="border border-black p-3 text-right font-black text-red-600 text-[17px] bg-slate-100">
                                                            {formatCurrency(totals.totalAfterTax)} VNĐ
                                                        </td>
                                                        <td className="border-none"></td>
                                                    </tr>
                                                </>
                                            );
                                        })()}
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
                                            <>
                                                {currentUser?.signature_url ? (
                                                    <img src={currentUser.signature_url} className="max-h-16 object-contain opacity-90 animate-in fade-in duration-300" style={{ mixBlendMode: 'multiply', filter: 'contrast(1.2)' }} alt="Chữ ký" />
                                                ) : (
                                                    <div className="font-['Brush_Script_MT',_cursive,_sans-serif] text-4xl text-blue-700 select-none animate-in fade-in duration-300">
                                                        {getSignatureName(getCommanderName(formData.recipient))}
                                                    </div>
                                                )}
                                            </>
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
                                <Save size={18} /> {getMatchedRequest(formData)?.status === 'Rejected' ? 'ĐẶT LẠI ĐƠN HÀNG' : 'LƯU ĐƠN ĐẶT HÀNG'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* PRINT PREVIEW / DETAIL VIEW */}
            {view === 'detail' && selectedOrder && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center justify-start overflow-y-auto bg-black/60 backdrop-blur-sm p-4 sm:p-8 print:p-0 print:bg-white print:block">
                    <style>{`
                        @media print {
                            @page { size: A4 portrait; margin: 10mm 12mm; }
                            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                            body * { visibility: hidden; }
                            .print-area, .print-area * { visibility: visible; }
                            .print-area { 
                                position: absolute; 
                                left: 0; 
                                top: 0; 
                                width: 100%; 
                                border: none !important; 
                                box-shadow: none !important; 
                                margin: 0; 
                                padding: 0 !important; 
                                min-height: 265mm !important;
                                height: auto !important;
                                display: flex !important;
                                flex-direction: column !important;
                                justify-content: space-between !important;
                            }
                        }
                    `}</style>
                    <div className="w-full max-w-[1050px] animate-in zoom-in-95 duration-200 relative mt-4 print:mt-0 print:w-auto">
                        <header className="mb-4 flex flex-wrap justify-between items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-lg print:hidden">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <ClipboardList className="text-blue-600" /> Bản in xem trước
                                </h3>
                            </div>
                            <div className="flex flex-wrap gap-2 items-center">
                                <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-xl border border-slate-200 mr-2">
                                    <label className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-white rounded-lg cursor-pointer text-sm font-semibold text-slate-700 transition shadow-sm">
                                        <input type="checkbox" checked={!showPriceCols} onChange={e => setShowPriceCols(!e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
                                        Ẩn giá & tiền
                                    </label>
                                    <label className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-white rounded-lg cursor-pointer text-sm font-semibold text-slate-700 transition shadow-sm border-l border-slate-200 pl-3">
                                        <input type="checkbox" checked={showNonEmptyOnly} onChange={e => setShowNonEmptyOnly(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
                                        Chỉ in hàng
                                    </label>
                                </div>
                                <button 
                                    onClick={() => {
                                        setTimeout(() => window.print(), 300);
                                    }}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold transition flex items-center gap-2 shadow-md"
                                >
                                    <Printer size={18} /> In Phiếu
                                </button>
                                <button 
                                    onClick={() => handleExportExcel(selectedOrder)}
                                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-bold transition flex items-center gap-2 shadow-md"
                                >
                                    <Download size={18} /> Xuất Excel
                                </button>
                                <button 
                                    onClick={() => { setView('create'); setSelectedOrder(null); setShowNonEmptyOnly(false); }}
                                    className="bg-slate-100 text-slate-600 hover:bg-slate-200 px-4 py-2 rounded-xl font-bold transition flex items-center gap-2"
                                >
                                    <Edit3 size={18} /> Sửa Đơn
                                </button>
                                <button 
                                    onClick={() => { setView('list'); setSelectedOrder(null); setShowNonEmptyOnly(false); }}
                                    className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition ml-2"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </header>

                        {/* DỰ ÁN PREVIEW SIMULATOR */}
                        <div className="print-area bg-white shadow-2xl rounded-sm p-8 md:p-12 font-['Times_New_Roman',_serif] text-[16px] text-black w-full max-w-[950px] min-h-[1340px] flex flex-col justify-between mx-auto">
                        
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
                                <div className="flex flex-col sm:flex-row gap-0.5 sm:gap-2">
                                    <span className="font-bold whitespace-nowrap min-w-[165px] shrink-0">CÔNG TY ĐẶT HÀNG :</span>
                                    <span className="font-bold text-black break-words">{(selectedOrder.items?.[0]?._order_company || selectedOrder.order_company || 'CÔNG TY CỔ PHẦN TRANG TRÍ NỘI THẤT INTERNATIONAL PK').toUpperCase()}</span>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-0.5 sm:gap-2">
                                    <span className="font-bold whitespace-nowrap min-w-[165px] shrink-0">NHÀ CUNG CẤP :</span>
                                    <span className="font-bold text-black break-words">{selectedOrder.company.toUpperCase()}</span>
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
                                            {showPriceCols && <th className="border border-black p-2.5 text-center w-32 font-bold text-[15px] relative group">
                                                Đơn giá
                                                <button onClick={() => setShowPriceCols(false)} className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all p-1 bg-slate-200/50 rounded print:hidden" title="Ẩn cột này"><EyeOff size={14} /></button>
                                            </th>}
                                            {showPriceCols && <th className="border border-black p-2.5 text-right w-36 font-bold text-[15px]">Thành tiền</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(() => {
                                            const categoriesToRender = (Array.isArray(selectedOrder.items) ? selectedOrder.items : DEFAULT_CATEGORIES).map(cat => ({
                                                ...cat,
                                                items: showNonEmptyOnly 
                                                    ? cat.items.filter(item => (parseFloat(item.quantity) || 0) > 0) 
                                                    : cat.items
                                            })).filter(cat => cat.items.length > 0);

                                            return categoriesToRender.map((cat, catIdx) => (
                                                <React.Fragment key={catIdx}>
                                                    {/* CATEGORY HEADER ROW */}
                                                    <tr>
                                                        <td colSpan={showPriceCols ? "7" : "5"} className="border border-black p-2 text-center font-bold text-[15px] uppercase text-black bg-slate-50">
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
                                                            {showPriceCols && <td className="border border-black p-2 text-right pr-4">
                                                                {item.price ? formatCurrency(item.price) : '-'}
                                                            </td>}
                                                            {showPriceCols && <td className="border border-black p-2 text-right pr-4 font-bold text-blue-800">
                                                                {(parseFloat(item.quantity) || 0) > 0 && (parseFloat(item.price) || 0) > 0 ? formatCurrency(parseFloat(item.quantity) * parseFloat(item.price)) : '-'}
                                                            </td>}
                                                        </tr>
                                                    ))}
                                                </React.Fragment>
                                            ));
                                        })()}
                                        {showPriceCols && (() => {
                                            const orderItems = Array.isArray(selectedOrder.items) ? selectedOrder.items : DEFAULT_CATEGORIES;
                                            const totals = calculateMaterialTotals(orderItems);
                                            return (
                                                <>
                                                    <tr>
                                                        <td colSpan="6" className="border border-black p-3 text-right font-bold uppercase text-black bg-slate-100">
                                                            Tổng trước thuế:
                                                        </td>
                                                        <td className="border border-black p-3 text-right font-bold text-blue-800 text-[17px] bg-slate-100">
                                                            {formatCurrency(totals.subtotal)} VNĐ
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td colSpan="6" className="border border-black p-3 text-right font-bold uppercase text-black bg-slate-100">
                                                            Thuế VAT (8%):
                                                        </td>
                                                        <td className="border border-black p-3 text-right font-bold text-red-600 text-[17px] bg-slate-100">
                                                            {formatCurrency(totals.vat)} VNĐ
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td colSpan="6" className="border border-black p-3 text-right font-bold uppercase text-black bg-slate-100">
                                                            Tổng sau thuế:
                                                        </td>
                                                        <td className="border border-black p-3 text-right font-bold text-red-600 text-[17px] bg-slate-100">
                                                            {formatCurrency(totals.totalAfterTax)} VNĐ
                                                        </td>
                                                    </tr>
                                                </>
                                            );
                                        })()}
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
                                    {selectedOrder.show_signature && (() => {
                                        const creatorUsername = selectedOrder.created_by || currentUser?.username;
                                        const signatureUrl = usersList?.find(u => u.username === creatorUsername)?.signature_url;
                                        return (
                                            <>
                                                {signatureUrl ? (
                                                    <img src={signatureUrl} className="max-h-16 object-contain opacity-90" style={{ mixBlendMode: 'multiply', filter: 'contrast(1.2)' }} alt="Chữ ký" />
                                                ) : (
                                                    <div className="font-['Brush_Script_MT',_cursive,_sans-serif] text-4xl text-blue-700 select-none">
                                                        {getSignatureName(getCommanderName(selectedOrder.recipient))}
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                                
                                <p className="font-bold text-black border-t border-black pt-2 text-sm uppercase">
                                    {getCommanderName(selectedOrder.recipient)}
                                </p>
                            </div>
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
