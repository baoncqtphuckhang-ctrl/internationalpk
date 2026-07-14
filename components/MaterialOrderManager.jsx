'use client';
/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

import React, { useState, useEffect, useMemo } from 'react';
import { 
    Search, ClipboardList, Printer, Download, Eye, 
    Calendar, User, Briefcase, MapPin, CheckCircle, 
    Clock, AlertTriangle, XCircle, ArrowLeft, RefreshCw,
    DollarSign, Tag, Info, PieChart, Trash2, ChevronDown, ChevronUp, Truck, Package, CheckSquare, Upload, Save, Camera, Edit3, RotateCcw, X, Plus
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const STATUS_LABELS = {
    'Draft': { label: 'Nháp', color: 'bg-slate-50 text-slate-500 border-slate-100', icon: Info },
    'Waiting QS': { label: 'Chờ QS duyệt', color: 'bg-amber-50 text-amber-700 border-amber-100', icon: Clock },
    'Waiting Accounting': { label: 'Chờ KT duyệt', color: 'bg-amber-50 text-amber-700 border-amber-100', icon: Clock },
    'Waiting Print': { label: 'Chờ in UNC', color: 'bg-purple-50 text-purple-700 border-purple-100', icon: Clock },
    'Waiting Pay': { label: 'Chờ chi tiền', color: 'bg-blue-50 text-blue-700 border-blue-100', icon: Clock },
    'Paid': { label: 'Chờ hạch toán', color: 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100', icon: Clock },
    'Accounted': { label: 'Hoàn tất hạch toán', color: 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100', icon: CheckCircle },
    'Rejected': { label: 'Bị từ chối', color: 'bg-red-50 text-red-700 border-red-100 hover:bg-red-100', icon: XCircle },
    'Deleted': { label: 'Đã xóa', color: 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-200', icon: XCircle },
    // Fallback for legacy statuses
    'Pending': { label: 'Chờ hạch toán', color: 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100', icon: Clock },
    'Approved': { label: 'Hoàn tất hạch toán', color: 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100', icon: CheckCircle }
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

export default function MaterialOrderManager({ currentUser, usersList, projects, dnttList, showToast, onNavigateToHistory, onNavigateToHistoryWithId, onNavigateToProject, refreshData, isMuaHoManager = false, realtimeVersion, deleteRequests = [] }) {
    const adminPassword = usersList?.find(u => u.role?.toUpperCase() === 'ADMIN' || u.username?.toLowerCase() === 'admin')?.password || '123456';
    const [orders, setOrders] = useState([]);

    useEffect(() => {
        if (realtimeVersion > 0) {
            fetchOrders();
        }
    }, [realtimeVersion]);
    const [isLoading, setIsLoading] = useState(false);
    const [isDbStorage, setIsDbStorage] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProjectFilter, setSelectedProjectFilter] = useState('');
    const [selectedStatusFilter, setSelectedStatusFilter] = useState('');
    const [deliveryView, setDeliveryView] = useState('all');
    
    // View state
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [matchedRequest, setMatchedRequest] = useState(null);
    const [isStatsView, setIsStatsView] = useState(false);
    
    // Modal state
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });
    
    // Receiving items state
    const [expandedOrderId, setExpandedOrderId] = useState(null);
    const [receiveData, setReceiveData] = useState({});
    const [isSavingReceive, setIsSavingReceive] = useState(false);
    
    const [expandedItems, setExpandedItems] = useState({});
    const [uploadingId, setUploadingId] = useState(null);
    const [invoiceModal, setInvoiceModal] = useState({ isOpen: false, order: null, number: '', date: '' });
    const [editReceiveModal, setEditReceiveModal] = useState({ isOpen: false, data: null, order: null, catIdx: null, itemIdx: null, historyIdx: null });

    const toggleItemExpansion = (key) => {
        setExpandedItems(prev => ({...prev, [key]: !prev[key]}));
    };
    
    // Load orders
    const fetchOrders = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('material_orders')
                .select('*')
                .order('order_date', { ascending: false });

            if (error) throw error;
            setOrders(data || []);
            setIsDbStorage(true);
        } catch (err) {
            console.warn("Supabase table 'material_orders' not found or inaccessible. Falling back to LocalStorage.");
            setIsDbStorage(false);
            const localData = localStorage.getItem('misa_material_orders');
            if (localData) {
                setOrders(JSON.parse(localData));
            } else {
                setOrders([]);
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    // Helper: Match order with approval_requests
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

    // Merge actual orders with any orphaned DNTT requests of type 'Đơn Vật Tư'
    const allOrders = useMemo(() => {
        const list = [...orders];
        if (dnttList && dnttList.length > 0) {
            dnttList.forEach(d => {
                if (d.doc_type === 'Đơn Vật Tư') {
                    let parsed;
                    try {
                        parsed = JSON.parse(d.reason);
                    } catch(e) { return; }
                    
                    const hasOrder = list.some(o => 
                        (parsed.material_order_id && o.id === parsed.material_order_id) || 
                        (o.project_name === d.project_name && o.order_date === parsed.date)
                    );
                    
                    if (!hasOrder) {
                        list.push({
                            id: parsed.material_order_id || `orphan-${d.id}`,
                            project_name: d.project_name,
                            order_phase: parsed.orderPhase || 'Không rõ đợt',
                            recipient: d.recipient,
                            order_date: parsed.date || d.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
                            items: parsed.items || [],
                            is_deleted: false,
                            _is_orphan: true
                        });
                    }
                }
            });
        }
        return list;
    }, [orders, dnttList]);

    const getDeliveryProgress = (order) => {
        let totalOrdered = 0;
        let totalReceivedQty = 0;

        (order.items || []).forEach(cat => {
            (cat.items || []).forEach(item => {
                totalOrdered += parseFloat(item.quantity) || 0;
                totalReceivedQty += (item.received_history || []).reduce(
                    (sum, historyItem) => sum + (parseFloat(historyItem.qty) || 0),
                    0
                );
            });
        });

        return {
            totalOrdered,
            totalReceivedQty,
            isFullyReceived: totalOrdered > 0 && totalReceivedQty >= totalOrdered
        };
    };

    // Filters logic
    const filteredOrders = allOrders.filter(order => {
        const matchesSearch = 
            order.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.order_phase.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.recipient.toLowerCase().includes(searchTerm.toLowerCase());
            
        const matchesProject = selectedProjectFilter === '' || order.project_name === selectedProjectFilter;
        
        const req = getMatchedRequest(order);
        const status = req ? req.status : 'Draft';
        
        let normalizedStatus = status;
        if (status === 'Draft') normalizedStatus = 'Draft';
        else if (status === 'Bị từ chối' || status === 'Rejected') normalizedStatus = 'Rejected';
        else if (status === 'Hoàn tất hạch toán' || status === 'Đã hoàn tất' || status === 'Accounted' || status === 'Approved') normalizedStatus = 'Accounted';
        else if (status === 'Chờ hạch toán' || status === 'Paid') normalizedStatus = 'Paid';
        else normalizedStatus = 'Waiting QS'; // Treat other waiting states as Waiting

        const matchesStatus = selectedStatusFilter === '' || normalizedStatus === selectedStatusFilter;
        
        if (!isMuaHoManager) {
            const isDeadStatus = normalizedStatus === 'Draft' || normalizedStatus === 'Rejected';
            if (isDeadStatus) return false;
        } else if (normalizedStatus === 'Rejected') {
            return false;
        }
        
        // If the order has a matched request and it's active, DO NOT hide it even if it's marked as is_deleted
        // If the order has a matched request and it's active, DO NOT hide it even if it's marked as is_deleted
        if (order.is_deleted && !req) return false;
        
        const allowedProjectNames = projects.map(p => p.name);
        if (!allowedProjectNames.includes(order.project_name)) return false;
        
        const { totalOrdered, totalReceivedQty } = getDeliveryProgress(order);
        const isFullyReceived = (totalOrdered > 0 && totalReceivedQty >= totalOrdered) || 
                                ((normalizedStatus === 'Accounted' || normalizedStatus === 'Approved') && totalOrdered === 0);
        const matchesDeliveryView = deliveryView === 'all'
            || (deliveryView === 'delivering' && !isFullyReceived)
            || (deliveryView === 'received' && isFullyReceived);

        return matchesSearch && matchesProject && matchesStatus && matchesDeliveryView;
    });

    const formatDateVN = (dateStr) => {
        if (!dateStr) return '';
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    };

    const formatCurrency = (val) => {
        if (val === undefined || val === null) return '0 đ';
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
    };

    const handleSelectOrder = (order) => {
        const req = getMatchedRequest(order);
        setSelectedOrder(order);
        setMatchedRequest(req);
    };

    const handleDeleteOrder = (orderId, e, reqId) => {
        if (e) e.stopPropagation();
        
        const isAuthorizer = currentUser?.role?.toUpperCase() === 'ADMIN' || currentUser?.role?.toUpperCase() === 'QS TRƯỞNG';
        if (!isAuthorizer) {
            const order = orders.find(o => o.id === orderId);
            const recordName = `Đơn hàng vật tư ${order?.order_code || ''} công trình ${order?.project_name || ''}`;
            const reason = window.prompt(`Nhập lý do đề nghị xóa đơn đặt hàng ${order?.order_code || ''}:`);
            if (reason === null) return;
            if (!reason.trim()) return alert('Vui lòng nhập lý do!');
            
            setIsLoading(true);
            supabase.from('delete_requests').insert([{
                original_table: 'material_orders',
                record_id: orderId,
                record_name: recordName,
                requested_by: currentUser?.username || 'unknown',
                reason: reason.trim(),
                status: 'pending'
            }]).then(({ error }) => {
                setIsLoading(false);
                if (error) {
                    alert('Lỗi khi gửi đề nghị xóa: ' + error.message);
                } else {
                    alert('Đã gửi đề nghị xóa đơn đặt hàng tới Admin/QS Trưởng!');
                    if (refreshData) refreshData();
                    fetchOrders();
                }
            });
            return;
        }
        
        setConfirmModal({
            isOpen: true,
            requirePassword: true,
            message: 'Bạn có chắc chắn muốn xóa đơn đặt hàng này không? Dữ liệu này, cùng với Lịch sử chi tiền (nếu có) sẽ được chuyển vào thùng rác.',
            onConfirm: async () => {
                setConfirmModal({ isOpen: false, requirePassword: false, message: '', onConfirm: null });
                setIsLoading(true);
                try {
                    const moveToTrashLocal = async (tableName, matchColumn, matchValue, isIlike = false) => {
                        try {
                            const query = supabase.from(tableName).select('*');
                            const { data } = isIlike ? await query.ilike(matchColumn, matchValue) : await query.eq(matchColumn, matchValue);
                            if (data && data.length > 0) {
                                const trashRecords = data.map(record => ({
                                    original_table: tableName,
                                    record_data: JSON.stringify(record),
                                    deleted_by: currentUser?.username || 'unknown',
                                    deleted_at: new Date().toISOString()
                                }));
                                await supabase.from('trash_bin').insert(trashRecords);
                            }
                        } catch(err) { console.error('Trash error', err); }
                    };

                    if (reqId) {
                        // Delete transactions linked to this reqId
                        const { data: txs } = await supabase
                            .from('transactions')
                            .select('id')
                            .ilike('note', `%[ID:${reqId}]%`);
                            
                        if (txs && txs.length > 0) {
                            for (const tx of txs) {
                                await moveToTrashLocal('transactions', 'id', tx.id);
                                await supabase.from('transactions').delete().eq('id', tx.id);
                            }
                        }
                        
                        // Delete partner_debts linked to this reqId
                        const { data: debts } = await supabase
                            .from('partner_debts')
                            .select('id')
                            .ilike('note', `%[ID:${reqId}]%`);
                            
                        if (debts && debts.length > 0) {
                            for (const d of debts) {
                                await moveToTrashLocal('partner_debts', 'id', d.id);
                                await supabase.from('partner_debts').delete().eq('id', d.id);
                            }
                        }
                    }

                    if (!orderId.toString().startsWith('orphan-')) {
                        await moveToTrashLocal('material_orders', 'id', orderId);
                        const { error } = await supabase
                            .from('material_orders')
                            .delete()
                            .eq('id', orderId);
                        if (error) throw error;
                    }
                    if (reqId) {
                        await moveToTrashLocal('approval_requests', 'id', reqId);
                        const { error: reqErr } = await supabase
                            .from('approval_requests')
                            .delete()
                            .eq('id', reqId);
                        if (reqErr) throw reqErr;
                    }

                    // Xóa luôn các bản ghi nhập kho trong material_warehouse liên quan đến đơn này
                    try {
                        const orderObj = allOrders.find(o => o.id === orderId);
                        if (orderObj && orderObj.order_phase) {
                            // Tìm các bản ghi kho có note chứa "Theo Đơn vật tư <order_phase>"
                            const { data: whRecs } = await supabase
                                .from('material_warehouse')
                                .select('id')
                                .eq('project_name', orderObj.project_name)
                                .ilike('note', `%Theo Đơn vật tư ${orderObj.order_phase}.%`);
                            if (whRecs && whRecs.length > 0) {
                                const whIds = whRecs.map(r => r.id);
                                // Lưu từng record vào trash_bin trước khi xóa
                                for (const r of whRecs) {
                                    await moveToTrashLocal('material_warehouse', 'id', r.id);
                                }
                                // Xóa khỏi kho
                                await supabase.from('material_warehouse').delete().in('id', whIds);
                            }
                        }
                    } catch (whErr) {
                        console.warn('Không thể xóa bản ghi kho:', whErr);
                        // Không throw – không để lỗi kho block toàn bộ flow xóa đơn
                    }
                    showToast('Đã xóa đơn đặt hàng và dữ liệu liên đới thành công!');
                    await fetchOrders();
                    if (refreshData) {
                        refreshData();
                    }
                } catch (err) {
                    showToast('Lỗi khi xóa đơn đặt hàng!', 'error');
                    console.error(err);
                } finally {
                    setIsLoading(false);
                }
            }
        });
    };

    const handleRevertOrderStatus = async (reqId, e) => {
        if (e) e.stopPropagation();
        
        setConfirmModal({
            isOpen: true,
            requirePassword: false,
            message: 'Bạn có chắc chắn muốn hoàn tác trạng thái đơn hàng này về "Chờ QS duyệt" không?',
            onConfirm: async () => {
                setConfirmModal({ isOpen: false, requirePassword: false, message: '', onConfirm: null });
                setIsLoading(true);
                try {
                    const { error } = await supabase
                        .from('approval_requests')
                        .update({ status: 'Waiting QS' })
                        .eq('id', reqId);
                    if (error) throw error;
                    
                    showToast('Đã hoàn tác trạng thái thành công!');
                    if (refreshData) {
                        refreshData();
                    }
                } catch (err) {
                    showToast('Lỗi khi hoàn tác trạng thái!', 'error');
                    console.error(err);
                } finally {
                    setIsLoading(false);
                }
            }
        });
    };

    const getStatistics = () => {
        if (!selectedProjectFilter) return [];
        const projectOrders = orders.filter(o => o.project_name === selectedProjectFilter);
        
        const stats = {};
        projectOrders.forEach(order => {
            if (!Array.isArray(order.items)) return;
            order.items.forEach(cat => {
                if (!stats[cat.name]) stats[cat.name] = {};
                cat.items.forEach(it => {
                    const qty = parseFloat(it.quantity);
                    if (isNaN(qty) || qty <= 0) return;
                    const key = `${it.name}___${it.unit}`;
                    if (!stats[cat.name][key]) stats[cat.name][key] = 0;
                    stats[cat.name][key] += qty;
                });
            });
        });
        
        const result = [];
        for (const [catName, itemsMap] of Object.entries(stats)) {
            const itemsList = [];
            for (const [itemKey, totalQty] of Object.entries(itemsMap)) {
                const [name, unit] = itemKey.split('___');
                itemsList.push({ name, unit, totalQty });
            }
            if (itemsList.length > 0) {
                itemsList.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
                result.push({ name: catName, items: itemsList });
            }
        }
        result.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
        return result;
    };

    const handleSaveReceive = async (order, catIdx, itemIdx) => {
        const itemData = receiveData[`${order.id}_${catIdx}_${itemIdx}`];
        if (!itemData || !itemData.qty || itemData.qty <= 0 || !itemData.date) {
            showToast('Vui lòng nhập đủ ngày về và số lượng hợp lệ!', 'error');
            return;
        }

        setIsSavingReceive(true);
        let orderItemsBeforeReceive = null;
        let orderItemsUpdated = false;
        try {
            const currentItem = order.items[catIdx].items[itemIdx];
            const newHistory = currentItem.received_history ? [...currentItem.received_history] : [];
            newHistory.push({
                date: itemData.date,
                qty: parseFloat(itemData.qty),
                note: itemData.note || '',
                recorded_at: new Date().toISOString()
            });

            // Update in material_orders
            orderItemsBeforeReceive = order.items;
            const newOrderItems = [...order.items];
            newOrderItems[catIdx] = { ...newOrderItems[catIdx] };
            newOrderItems[catIdx].items = [...newOrderItems[catIdx].items];
            newOrderItems[catIdx].items[itemIdx] = {
                ...currentItem,
                received_history: newHistory
            };

            // Cannot update if it's an orphan
            if (order._is_orphan) {
                showToast('Đơn này là dữ liệu tạm, không thể lưu hàng về!', 'error');
                setIsSavingReceive(false);
                return;
            }

            const { error: updateError } = await supabase
                .from('material_orders')
                .update({ items: newOrderItems })
                .eq('id', order.id);

            if (updateError) throw updateError;
            orderItemsUpdated = true;

            // Insert into material_warehouse
            const priceVal = parseFloat(currentItem.price?.toString().replace(/\D/g, '') || 0);
            
            let priceBatchStr = (
                order.items?.[catIdx]?._price_batch ||
                currentItem._price_batch ||
                order.items?.find(cat => cat._price_batch)?._price_batch ||
                'Không rõ đợt'
            );
            // Make sure it doesn't duplicate the [Đợt giá:] prefix
            if (priceBatchStr.startsWith('Đợt giá: ')) {
                priceBatchStr = `[${priceBatchStr}]`;
            } else if (!priceBatchStr.startsWith('[')) {
                priceBatchStr = `[Đợt giá: ${priceBatchStr}]`;
            }

            const warehousePayload = {
                project_name: order.project_name,
                transaction_type: 'NHẬP',
                material_name: currentItem.name,
                color_code: currentItem.colorCode || currentItem.color_code || '',
                unit: currentItem.unit,
                quantity: parseFloat(itemData.qty),
                date: itemData.date,
                price: priceVal,
                total_value: priceVal * parseFloat(itemData.qty),
                note: `${priceBatchStr} Theo Đơn vật tư ${order.order_phase}. ${itemData.note || ''}`
            };

            const { error: whError } = await supabase
                .from('material_warehouse')
                .insert([warehousePayload]);

            if (whError) throw whError;

            showToast('Lưu hàng về & Nhập kho thành công!');
            
            // Clear input
            setReceiveData(prev => ({
                ...prev,
                [`${order.id}_${catIdx}_${itemIdx}`]: { date: '', qty: '', note: '' }
            }));
            
            await fetchOrders();
        } catch (err) {
            console.error('Save Receive Error:', err);
            if (orderItemsUpdated && orderItemsBeforeReceive && !order._is_orphan) {
                await supabase
                    .from('material_orders')
                    .update({ items: orderItemsBeforeReceive })
                    .eq('id', order.id);
            }
            showToast(`Có lỗi xảy ra: ${err.message || 'Không thể lưu dữ liệu'}`, 'error');
        } finally {
            setIsSavingReceive(false);
        }
    };

    const deleteReceiveHistory = async (order, catIdx, itemIdx, historyIdx, historyItem) => {
        setIsSavingReceive(true);
        try {
            const currentItem = order.items[catIdx].items[itemIdx];
            const newHistory = [...currentItem.received_history];
            newHistory.splice(historyIdx, 1);

            // Update in material_orders
            const newOrderItems = [...order.items];
            newOrderItems[catIdx] = { ...newOrderItems[catIdx] };
            newOrderItems[catIdx].items = [...newOrderItems[catIdx].items];
            newOrderItems[catIdx].items[itemIdx] = {
                ...currentItem,
                received_history: newHistory
            };

            const { error: updateError } = await supabase
                .from('material_orders')
                .update({ items: newOrderItems })
                .eq('id', order.id);

            if (updateError) throw updateError;

            // Attempt to delete from material_warehouse
            await supabase
                .from('material_warehouse')
                .delete()
                .eq('project_name', order.project_name)
                .eq('material_name', currentItem.name)
                .eq('quantity', historyItem.qty)
                .eq('date', historyItem.date)
                .eq('transaction_type', 'NHẬP');
                
            showToast('Đã xóa lịch sử nhận hàng thành công!');
            await fetchOrders();
        } catch (err) {
            console.error('Delete Receive Error:', err);
            showToast('Có lỗi xảy ra khi xóa!', 'error');
        } finally {
            setIsSavingReceive(false);
        }
    };

    const handleDeleteReceiveHistory = (order, catIdx, itemIdx, historyIdx, historyItem) => {
        setConfirmModal({
            isOpen: true,
            message: 'Bạn có chắc muốn xóa lần nhận hàng này? Dữ liệu nhập kho tương ứng cũng sẽ bị xóa.',
            onConfirm: async () => {
                setConfirmModal({ isOpen: false, message: '', onConfirm: null });
                await deleteReceiveHistory(order, catIdx, itemIdx, historyIdx, historyItem);
            }
        });
    };

    const handleSaveEditReceive = async () => {
        const { data: edData, order, catIdx, itemIdx, historyIdx, oldItem } = editReceiveModal;
        if (!edData.qty || edData.qty <= 0 || !edData.date) {
            showToast('Vui lòng nhập đủ ngày và số lượng hợp lệ!', 'error');
            return;
        }

        setIsSavingReceive(true);
        try {
            const currentItem = order.items[catIdx].items[itemIdx];
            const newHistory = [...currentItem.received_history];
            newHistory[historyIdx] = {
                ...oldItem,
                date: edData.date,
                qty: parseFloat(edData.qty),
                note: edData.note || ''
            };

            // Cập nhật mảng history trong order
            const newOrderItems = [...order.items];
            newOrderItems[catIdx] = { ...newOrderItems[catIdx] };
            newOrderItems[catIdx].items = [...newOrderItems[catIdx].items];
            newOrderItems[catIdx].items[itemIdx] = {
                ...currentItem,
                received_history: newHistory
            };

            const { error: updateError } = await supabase
                .from('material_orders')
                .update({ items: newOrderItems })
                .eq('id', order.id);

            if (updateError) throw updateError;

            // Xóa record cũ trong kho
            await supabase
                .from('material_warehouse')
                .delete()
                .eq('project_name', order.project_name)
                .eq('material_name', currentItem.name)
                .eq('quantity', oldItem.qty)
                .eq('date', oldItem.date)
                .eq('transaction_type', 'NHẬP');

            // Insert record mới vào kho
            const priceVal = parseFloat(currentItem.price?.toString().replace(/\D/g, '') || 0);
            const warehousePayload = {
                project_name: order.project_name,
                transaction_type: 'NHẬP',
                material_name: currentItem.name,
                color_code: currentItem.colorCode || currentItem.color_code || '',
                unit: currentItem.unit,
                quantity: parseFloat(edData.qty),
                date: edData.date,
                price: priceVal,
                total_value: priceVal * parseFloat(edData.qty),
                note: `[Đợt giá: ${formatDateVN(order.order_date)}] Theo Đơn vật tư ${order.order_phase}. ${edData.note || ''}`
            };

            const { error: whError } = await supabase
                .from('material_warehouse')
                .insert([warehousePayload]);

            if (whError) throw whError;

            showToast('Đã sửa đợt nhận hàng thành công!');
            setEditReceiveModal({ isOpen: false, data: null, order: null, catIdx: null, itemIdx: null, historyIdx: null, oldItem: null });
            await fetchOrders();
        } catch (err) {
            console.error('Save Edit Receive Error:', err);
            showToast('Có lỗi xảy ra khi sửa!', 'error');
        } finally {
            setIsSavingReceive(false);
        }
    };

    const openInvoiceModal = (order) => {
        let initialInvoices = Array.isArray(order.invoices) ? [...order.invoices] : [];
        if (initialInvoices.length === 0 && (order.invoice_number || order.invoice_date || order.invoice_pdf_url)) {
            initialInvoices.push({
                number: order.invoice_number || '',
                date: order.invoice_date || '',
                pdf_url: order.invoice_pdf_url || ''
            });
        }
        if (initialInvoices.length === 0) {
            initialInvoices.push({ number: '', date: '', pdf_url: '' });
        }
        setInvoiceModal({
            isOpen: true,
            order,
            invoices: initialInvoices
        });
    };

    const handleSaveInvoiceInfo = async (order, invoicesList) => {
        try {
            if (order._is_orphan) {
                showToast('Đơn này là dữ liệu tạm, không thể lưu hóa đơn!', 'error');
                return;
            }
            
            const cleanInvoices = invoicesList.filter(inv => inv.number?.trim() || inv.date || inv.pdf_url);
            const firstInvoice = cleanInvoices[0] || { number: '', date: '', pdf_url: '' };
            
            const { error } = await supabase
                .from('material_orders')
                .update({ 
                    invoices: cleanInvoices,
                    invoice_number: firstInvoice.number || null,
                    invoice_date: firstInvoice.date || null,
                    invoice_pdf_url: firstInvoice.pdf_url || null
                })
                .eq('id', order.id);
                
            if (error) throw error;
            
            showToast('Đã lưu thông tin hóa đơn!', 'success');
            setOrders(prev => prev.map(o => o.id === order.id ? { 
                ...o, 
                invoices: cleanInvoices,
                invoice_number: firstInvoice.number,
                invoice_date: firstInvoice.date,
                invoice_pdf_url: firstInvoice.pdf_url
            } : o));
            setInvoiceModal({ isOpen: false, order: null, invoices: [] });
        } catch (err) {
            console.error('Error saving invoice info:', err);
            showToast('Lỗi khi lưu thông tin hóa đơn: ' + err.message, 'error');
        }
    };

    const handleUploadInvoicePdfForIdx = async (e, order, idx) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            showToast('Vui lòng chọn file PDF!', 'error');
            e.target.value = '';
            return;
        }

        setUploadingId('invoice_pdf_' + idx);
        try {
            const fileExt = file.name.split('.').pop();
            const originalName = file.name.substring(0, file.name.lastIndexOf('.')) || 'invoice';
            const sanitizedName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
            const sanitizedProject = order.project_name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
            
            const fileName = 'mo_invoice_' + Date.now() + '_' + sanitizedName + '.' + fileExt;
            const filePath = sanitizedProject + '/invoices/' + fileName;

            const { error: uploadError } = await supabase.storage
                .from('invoices')
                .upload(filePath, file, { cacheControl: '3600', upsert: false });

            if (uploadError) {
                throw new Error(uploadError.message === 'Bucket not found' 
                    ? 'Không tìm thấy bucket "invoices"' 
                    : uploadError.message);
            }

            const { data: { publicUrl } } = supabase.storage
                .from('invoices')
                .getPublicUrl(filePath);

            setInvoiceModal(prev => {
                const newInvoices = [...prev.invoices];
                newInvoices[idx] = { ...newInvoices[idx], pdf_url: publicUrl };
                return { ...prev, invoices: newInvoices };
            });

            showToast('Tải lên hóa đơn PDF thành công! Hãy nhấn Lưu để hoàn tất.', 'success');
        } catch (err) {
            console.error('Upload PDF Error:', err);
            showToast(err.message || 'Lỗi khi tải file!', 'error');
        } finally {
            setUploadingId(null);
            if (e.target) e.target.value = '';
        }
    };

    const handleDeleteInvoicePdfForIdx = (idx) => {
        setInvoiceModal(prev => {
            const newInvoices = [...prev.invoices];
            newInvoices[idx] = { ...newInvoices[idx], pdf_url: '' };
            return { ...prev, invoices: newInvoices };
        });
        showToast('Đã gỡ hóa đơn PDF! Hãy nhấn Lưu để hoàn tất.', 'info');
    };

    const handleUploadInvoicePdf = async (e, order) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            showToast('Vui lòng chọn file PDF!', 'error');
            e.target.value = '';
            return;
        }

        setUploadingId(`invoice_pdf_${order.id}`);
        try {
            const fileExt = file.name.split('.').pop();
            const originalName = file.name.substring(0, file.name.lastIndexOf('.')) || 'invoice';
            const sanitizedName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
            const sanitizedProject = order.project_name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
            
            const fileName = `mo_invoice_${Date.now()}_${sanitizedName}.${fileExt}`;
            const filePath = `${sanitizedProject}/invoices/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('invoices')
                .upload(filePath, file, { cacheControl: '3600', upsert: false });

            if (uploadError) {
                throw new Error(uploadError.message === 'Bucket not found' 
                    ? 'Không tìm thấy bucket "invoices"' 
                    : uploadError.message);
            }

            const { data: { publicUrl } } = supabase.storage
                .from('invoices')
                .getPublicUrl(filePath);

            if (order._is_orphan) {
                showToast('Đơn này là dữ liệu tạm, không thể lưu PDF!', 'error');
                return;
            }

            const { error } = await supabase
                .from('material_orders')
                .update({ invoice_pdf_url: publicUrl })
                .eq('id', order.id);

            if (error) throw error;

            showToast('Tải lên hóa đơn PDF thành công!', 'success');
            setOrders(prev => prev.map(o => o.id === order.id ? { ...o, invoice_pdf_url: publicUrl } : o));
        } catch (err) {
            console.error('Upload PDF Error:', err);
            showToast(err.message || 'Lỗi khi tải file!', 'error');
        } finally {
            setUploadingId(null);
            if (e.target) e.target.value = '';
        }
    };

    const handleDeleteInvoicePdf = async (order) => {
        const pdfUrl = order.invoice_pdf_url;
        if (!pdfUrl) return;

        setIsLoading(true);
        try {
            if (pdfUrl.includes('/public/invoices/')) {
                const parts = pdfUrl.split('/public/invoices/');
                if (parts.length > 1) {
                    const filePath = decodeURIComponent(parts[1]);
                    const { error: storageError } = await supabase.storage.from('invoices').remove([filePath]);
                    if (storageError) console.warn('Error deleting PDF from storage:', storageError);
                }
            }

            if (order._is_orphan) {
                showToast('Đơn này là dữ liệu tạm, không thể xóa PDF!', 'error');
                return;
            }

            const { error } = await supabase
                .from('material_orders')
                .update({ invoice_pdf_url: null })
                .eq('id', order.id);

            if (error) throw error;

            showToast('Đã xóa hóa đơn PDF!');
            setOrders(prev => prev.map(o => o.id === order.id ? { ...o, invoice_pdf_url: null } : o));
        } catch (err) {
            console.error('Delete PDF Error:', err);
            showToast('Lỗi khi xóa file PDF!', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirmDeleteInvoicePdf = (order) => {
        setConfirmModal({
            isOpen: true,
            message: 'Bạn có chắc chắn muốn xóa hóa đơn PDF của đơn hàng này không?',
            onConfirm: async () => {
                setConfirmModal({ isOpen: false, message: '', onConfirm: null });
                await handleDeleteInvoicePdf(order);
            }
        });
    };

    const handleUploadReceipt = async (e, order, catIdx, itemIdx, historyIdx, historyItem) => {
        const files = Array.from(e.target.files);
        if (!files || files.length === 0) return;

        const uploadKey = `${order.id}_${catIdx}_${itemIdx}_${historyIdx}`;
        setUploadingId(uploadKey);
        try {
            const currentItem = order.items[catIdx].items[itemIdx];
            const sanitizedName = currentItem.name.substring(0, 20).replace(/[^a-zA-Z0-9.\-_]/g, '_');
            const sanitizedProject = order.project_name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
            
            const newHistory = [...currentItem.received_history];
            const urls = newHistory[historyIdx].receipt_urls || (newHistory[historyIdx].receipt_url ? [newHistory[historyIdx].receipt_url] : []);
            
            for (const file of files) {
                const fileExt = file.name.split('.').pop();
                const fileName = `receipt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${sanitizedName}.${fileExt}`;
                const filePath = `${sanitizedProject}/receipts/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('invoices')
                    .upload(filePath, file, { cacheControl: '3600', upsert: false });

                if (uploadError) {
                    throw new Error(uploadError.message === 'Bucket not found' 
                        ? 'Không tìm thấy bucket invoices' 
                        : uploadError.message);
                }

                const { data: { publicUrl } } = supabase.storage
                    .from('invoices')
                    .getPublicUrl(filePath);
                
                urls.push(publicUrl);
            }

            newHistory[historyIdx] = { 
                ...newHistory[historyIdx], 
                receipt_urls: urls,
                receipt_url: urls[0] // fallback for backward compatibility
            };

            const newOrderItems = [...order.items];
            newOrderItems[catIdx] = { ...newOrderItems[catIdx] };
            newOrderItems[catIdx].items = [...newOrderItems[catIdx].items];
            newOrderItems[catIdx].items[itemIdx] = {
                ...currentItem,
                received_history: newHistory
            };

            const { error: updateError } = await supabase
                .from('material_orders')
                .update({ items: newOrderItems })
                .eq('id', order.id);

            if (updateError) throw updateError;
            
            showToast(`Tải ${files.length} phiếu nhận hàng thành công!`);
            await fetchOrders();
        } catch (err) {
            console.error('Upload Receipt Error:', err);
            showToast(err.message || 'Có lỗi xảy ra khi tải file!', 'error');
        } finally {
            setUploadingId(null);
            // Reset input so the same files can be selected again if needed
            if (e.target) e.target.value = '';
        }
    };

    const handleDeleteReceiptOnly = async (order, catIdx, itemIdx, historyIdx, fileUrl) => {
        try {
            setIsLoading(true);
            const currentItem = order.items[catIdx].items[itemIdx];
            
            if (fileUrl && fileUrl.includes('/public/invoices/')) {
                const parts = fileUrl.split('/public/invoices/');
                if (parts.length > 1) {
                    const filePath = decodeURIComponent(parts[1]);
                    await supabase.storage.from('invoices').remove([filePath]);
                }
            }

            const newHistory = [...currentItem.received_history];
            let urls = newHistory[historyIdx].receipt_urls || (newHistory[historyIdx].receipt_url ? [newHistory[historyIdx].receipt_url] : []);
            urls = urls.filter(u => u !== fileUrl);

            if (urls.length === 0) {
                delete newHistory[historyIdx].receipt_urls;
                delete newHistory[historyIdx].receipt_url;
            } else {
                newHistory[historyIdx].receipt_urls = urls;
                newHistory[historyIdx].receipt_url = urls[0];
            }

            const newOrderItems = [...order.items];
            newOrderItems[catIdx] = { ...newOrderItems[catIdx] };
            newOrderItems[catIdx].items = [...newOrderItems[catIdx].items];
            newOrderItems[catIdx].items[itemIdx] = {
                ...currentItem,
                received_history: newHistory
            };

            const { error: updateError } = await supabase
                .from('material_orders')
                .update({ items: newOrderItems })
                .eq('id', order.id);

            if (updateError) throw updateError;
            
            showToast('Đã xóa phiếu nhận hàng!');
            await fetchOrders();
        } catch(err) {
            console.error('Delete Receipt Error:', err);
            showToast('Lỗi xóa phiếu nhận hàng!', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleExportStatsExcel = () => {
        if (!selectedProjectFilter) {
            showToast('Vui lòng chọn một công trình để thống kê xuất Excel', 'error');
            return;
        }
        const stats = getStatistics();
        if (stats.length === 0) {
            showToast('Không có dữ liệu thống kê cho công trình này', 'error');
            return;
        }

        const fileName = `Thong_Ke_Vat_Tu_${selectedProjectFilter.replace(/\s+/g, '_')}`;
        let rowsHtml = '';
        
        stats.forEach(cat => {
            rowsHtml += `
                <tr>
                    <td colspan="4" style="border: 1px solid #000; font-weight: bold; text-align: center; background-color: #f2f2f2; font-family: 'Times New Roman'; font-size: 13pt; height: 28px;">${cat.name}</td>
                </tr>
            `;
            cat.items.forEach((it, idx) => {
                rowsHtml += `
                    <tr style="height: 24px;">
                        <td style="border: 1px solid #000; text-align: center; font-family: 'Times New Roman'; font-size: 12pt;">${idx + 1}</td>
                        <td style="border: 1px solid #000; font-family: 'Times New Roman'; font-size: 12pt; padding-left: 5px;">${it.name}</td>
                        <td style="border: 1px solid #000; text-align: center; font-family: 'Times New Roman'; font-size: 12pt;">${it.unit}</td>
                        <td style="border: 1px solid #000; text-align: right; font-weight: bold; font-family: 'Times New Roman'; font-size: 12pt; padding-right: 5px;">${it.totalQty}</td>
                    </tr>
                `;
            });
        });

        const htmlContent = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head><meta charset="utf-8"></head>
            <body>
                <table style="border-collapse: collapse; font-family: 'Times New Roman';">
                    <tr>
                        <td colspan="4" style="text-align: center; font-weight: bold; font-size: 16pt; font-family: 'Times New Roman'; height: 45px;">
                            BẢNG TỔNG HỢP VẬT TƯ CÔNG TRÌNH
                        </td>
                    </tr>
                    <tr style="height: 26px;">
                        <td colspan="4" style="font-family: 'Times New Roman'; font-size: 12pt;">
                            <b>DỰ ÁN:</b> ${selectedProjectFilter.toUpperCase()}
                        </td>
                    </tr>
                    <tr style="height: 15px;"><td colspan="4"></td></tr>
                    <tr style="background-color: #e6e6e6; height: 32px;">
                        <th width="60" style="border: 1px solid #000; font-weight: bold; text-align: center; font-size: 13pt; font-family: 'Times New Roman';">STT</th>
                        <th width="380" style="border: 1px solid #000; font-weight: bold; text-align: center; font-size: 13pt; font-family: 'Times New Roman';">Chủng loại vật tư</th>
                        <th width="120" style="border: 1px solid #000; font-weight: bold; text-align: center; font-size: 13pt; font-family: 'Times New Roman';">DVT</th>
                        <th width="120" style="border: 1px solid #000; font-weight: bold; text-align: center; font-size: 13pt; font-family: 'Times New Roman';">Tổng Nhập</th>
                    </tr>
                    ${rowsHtml}
                </table>
            </body>
            </html>
        `;

        const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName + '.xls';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Xuất báo cáo thống kê thành công!');
    };

    // Print A4
    const handlePrint = () => {
        window.print();
    };

    // Export Excel
    const handleExportExcel = (order) => {
        const orderData = order || selectedOrder;
        if (!orderData) return;

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

        const dateComp = getVietnameseDateComponents(orderData.order_date);
        const fileName = `Don_Dat_Hang_Vat_Tu_${orderData.project_name.replace(/\s+/g, '_')}_${orderData.order_phase.replace(/\s+/g, '_')}`;

        // Create table HTML for Excel download
        let rowsHtml = '';
        const orderItems = Array.isArray(orderData.items) ? orderData.items : [];

        orderItems.forEach(cat => {
            const currentCatItems = Array.isArray(cat?.items) ? cat.items : [];
            const catHasQuantity = currentCatItems.some(it => parseFloat(it.quantity) > 0);
            if (!catHasQuantity) return;

            rowsHtml += `
                <tr style="height: 40px;">
                    <td colspan="7" style="border: 1px solid #000; font-weight: bold; text-align: center; vertical-align: middle; background-color: #f2f2f2; font-family: 'Times New Roman'; font-size: 13pt;">${cat.name}</td>
                </tr>
            `;
            currentCatItems.forEach(it => {
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

        const htmlContent = `
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
                            ${formatCurrency(orderItems.reduce((total, cat) => total + (Array.isArray(cat?.items) ? cat.items : []).reduce((sum, item) => sum + ((parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0)), 0), 0))} VNĐ
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

        const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName + '.xls';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Xuất Excel thành công!');
    };

    return (
        <div className="space-y-6">
            {/* PRINT VIEW STYLE BLOCK */}
            <style dangerouslySetInnerHTML={{__html: `
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .print-area, .print-area * {
                        visibility: visible !important;
                    }
                    .print-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}} />

                <>
                    {/* HEADER */}
                    <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                                <div className="bg-indigo-600 p-2.5 rounded-2xl text-white shadow-lg shadow-indigo-600/25">
                                    <ClipboardList size={22} />
                                </div>
                                <span>{isMuaHoManager ? 'Quản Lý Đơn Order Hộ' : 'Quản Lý Đơn Vật Tư'}</span>
                            </h2>
                            <p className="text-slate-500 text-sm mt-1">
                                {isMuaHoManager
                                    ? 'Danh sách đơn đặt hàng vật tư cho công trình tổng thầu mua hộ (theo dõi nhập kho).'
                                    : 'Danh sách và tình trạng phê duyệt, phân bổ chi phí của các đơn đặt hàng vật tư sơn nước.'}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setIsStatsView(!isStatsView)}
                                className={`px-4 py-2.5 rounded-2xl text-sm font-black border transition-all flex items-center gap-2 ${isStatsView ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-white hover:bg-slate-50 text-indigo-600 border-indigo-200 shadow-sm'}`}
                            >
                                <PieChart size={16} /> THỐNG KÊ VẬT TƯ
                            </button>
                            <button 
                                onClick={fetchOrders}
                                className="bg-white hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-2xl text-sm font-black border border-slate-200 transition-all flex items-center gap-2 shadow-sm"
                            >
                                <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} /> LÀM MỚI
                            </button>
                        </div>
                    </header>

                    {!isStatsView && (
                        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                            {[
                                { key: 'all', label: 'Tất cả đơn', icon: ClipboardList },
                                { key: 'delivering', label: 'Lịch sử đơn đang giao', icon: Truck },
                                { key: 'received', label: 'Lịch sử đơn đã giao', icon: CheckCircle }
                            ].map(view => {
                                const ViewIcon = view.icon;
                                return (
                                    <button
                                        key={view.key}
                                        type="button"
                                        onClick={() => setDeliveryView(view.key)}
                                        className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition ${deliveryView === view.key
                                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                                            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}
                                    >
                                        <ViewIcon size={16} /> {view.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* SEARCH & FILTERS */}
                    <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 flex flex-col lg:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
                            <input 
                                type="text"
                                placeholder="Tìm theo tên công trình, đợt đặt hàng, người nhận..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-3 text-sm font-medium outline-none focus:border-indigo-500 focus:bg-white transition"
                            />
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                            <div className="w-full lg:w-56">
                            <select 
                                value={selectedProjectFilter}
                                onChange={(e) => setSelectedProjectFilter(e.target.value)}
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-600 outline-none focus:border-indigo-500 focus:bg-white transition"
                            >
                                <option value="">-- Công trình --</option>
                                {projects.map(p => (
                                    <option key={p.name} value={p.name}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="w-full lg:w-56">
                            <select 
                                value={selectedStatusFilter}
                                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-600 outline-none focus:border-indigo-500 focus:bg-white transition"
                            >
                                <option value="">-- Trạng thái --</option>
                                <option value="Waiting QS">Chờ QS duyệt</option>
                                <option value="Paid">Chờ hạch toán</option>
                                <option value="Accounted">Đã hoàn tất</option>
                            </select>
                        </div>
                        </div>
                    </div>

                    {/* TABLE / STATS VIEW */}
                    {isStatsView ? (
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                <div>
                                    <h3 className="font-black text-lg text-slate-800 flex items-center gap-2">
                                        <PieChart className="text-indigo-600" size={20} /> Bảng Tổng Hợp Vật Tư
                                    </h3>
                                    {selectedProjectFilter ? (
                                        <p className="text-sm text-slate-500 mt-1">Dự án: <strong className="text-indigo-600">{selectedProjectFilter}</strong></p>
                                    ) : (
                                        <p className="text-sm text-amber-600 mt-1 flex items-center gap-1"><AlertTriangle size={14}/> Vui lòng chọn Công trình ở bộ lọc bên trên để xem thống kê</p>
                                    )}
                                </div>
                                {selectedProjectFilter && (
                                    <button 
                                        onClick={handleExportStatsExcel}
                                        className="bg-green-50 hover:bg-green-100 text-green-700 px-4 py-2 rounded-xl text-sm font-bold border border-green-200 transition-all flex items-center gap-2"
                                    >
                                        <Download size={16} /> Xuất Excel
                                    </button>
                                )}
                            </div>
                            
                            {selectedProjectFilter && getStatistics().length > 0 ? (
                                <div className="p-6">
                                    <div className="border border-slate-200 rounded-2xl overflow-x-auto">
                                        <table className="w-full text-left border-collapse text-sm min-w-[600px]">
                                            <thead>
                                                <tr className="bg-slate-100 border-b-2 border-slate-200 font-bold text-slate-700 uppercase text-xs tracking-wider">
                                                    <th className="px-6 py-4 text-center w-16">STT</th>
                                                    <th className="px-6 py-4 w-1/2">Chủng loại vật tư</th>
                                                    <th className="px-6 py-4 text-center w-24">ĐVT</th>
                                                    <th className="px-6 py-4 text-right">Tổng Nhập</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 font-medium">
                                                {getStatistics().map((cat, catIdx) => (
                                                    <React.Fragment key={catIdx}>
                                                        <tr className="bg-indigo-50/50">
                                                            <td colSpan="4" className="px-6 py-3 font-black text-indigo-900 border-b border-slate-200">
                                                                {cat.name}
                                                            </td>
                                                        </tr>
                                                        {cat.items.map((it, itIdx) => (
                                                            <tr key={itIdx} className="hover:bg-slate-50 transition">
                                                                <td className="px-6 py-3 text-center text-slate-400 font-bold">{itIdx + 1}</td>
                                                                <td className="px-6 py-3 text-slate-800 font-bold">{it.name}</td>
                                                                <td className="px-6 py-3 text-center font-bold">{it.unit}</td>
                                                                <td className="px-6 py-3 text-right font-black font-mono text-indigo-700 text-base">{it.totalQty}</td>
                                                            </tr>
                                                        ))}
                                                    </React.Fragment>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : selectedProjectFilter ? (
                                <div className="p-16 text-center text-slate-400">
                                    <PieChart className="mx-auto mb-4 text-slate-300" size={48} />
                                    <p className="font-bold text-slate-500 text-lg">Chưa có dữ liệu thống kê.</p>
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                            {isLoading ? (
                                <div className="p-16 text-center text-slate-400">
                                    <RefreshCw className="mx-auto mb-4 animate-spin text-slate-300" size={36} />
                                    <p className="font-bold">Đang tải danh sách đơn đặt hàng...</p>
                                </div>
                            ) : filteredOrders.length === 0 ? (
                                <div className="p-16 text-center text-slate-400">
                                    <ClipboardList className="mx-auto mb-4 text-slate-300" size={48} />
                                    <p className="font-bold text-slate-500 text-lg">Không tìm thấy đơn đặt hàng nào</p>
                                    <p className="text-slate-400 text-sm mt-1">Hãy thử đổi bộ lọc hoặc thêm đơn hàng mới.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full text-left border-collapse min-w-max md:min-w-full">
                                        <thead>
                                            <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-black uppercase text-slate-400 tracking-wider whitespace-nowrap">
                                                <th className="px-6 py-4 hidden md:table-cell">Ngày đặt</th>
                                                <th className="px-6 py-4">Công trình</th>
                                                <th className="px-6 py-4">Đợt đặt hàng</th>
                                                <th className="px-6 py-4 hidden lg:table-cell">Người nhận</th>
                                                <th className="px-6 py-4 hidden xl:table-cell">Người đặt</th>
                                                <th className="px-6 py-4 text-center hidden sm:table-cell">Số vật tư</th>
                                                <th className="px-6 py-4">Trạng thái</th>
                                                <th className="px-6 py-4">Số hóa đơn</th>
                                                <th className="px-6 py-4">Ngày hóa đơn</th>
                                                <th className="px-6 py-4 text-center">Hóa đơn PDF</th>
                                                <th className="px-6 py-4 text-right">Hạch toán thực tế</th>
                                                <th className="px-6 py-4 text-center">Thao tác</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-sm text-slate-600 font-medium">
                                            {filteredOrders.map(order => {
                                                const req = getMatchedRequest(order);
                                                const status = req ? req.status : 'Draft';
                                                
                                                const proj = projects.find(p => p.name === order.project_name);
                                                const isMuaHo = proj && proj.project_type === 'TỔNG THẦU MUA HỘ';
                                                
                                                const { totalOrdered, totalReceivedQty, isFullyReceived: baseFullyReceived } = getDeliveryProgress(order);
                                                const isFullyReceived = baseFullyReceived || ((status === 'Accounted' || status === 'Approved' || status === 'Hoàn tất hạch toán') && totalOrdered === 0);
                                                
                                                let statusConfig = STATUS_LABELS[status] || { label: 'Nháp', color: 'bg-slate-50 text-slate-500 border-slate-100', icon: Info };
                                                let StatusIcon = statusConfig.icon;
                                                
                                                if (isMuaHo) {
                                                    if (isFullyReceived) {
                                                        statusConfig = { label: 'Đã nhận đủ hàng', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: CheckCircle };
                                                        StatusIcon = CheckCircle;
                                                    } else if (totalReceivedQty > 0) {
                                                        statusConfig = { label: 'Đang nhận hàng', color: 'bg-sky-50 text-sky-700 border-sky-100', icon: Truck };
                                                        StatusIcon = Truck;
                                                    } else {
                                                        statusConfig = { label: 'Chờ nhận hàng', color: 'bg-amber-50 text-amber-700 border-amber-100', icon: Clock };
                                                        StatusIcon = Clock;
                                                    }
                                                } else {
                                                    // For regular orders, combine receive status with accounting status
                                                    let deliveryLabel = '';
                                                    if (totalOrdered === 0) deliveryLabel = '';
                                                    else if (isFullyReceived) deliveryLabel = 'Đã đủ hàng';
                                                    else if (totalReceivedQty > 0) deliveryLabel = 'Đang giao';
                                                    else deliveryLabel = 'Chưa giao';
                                                    
                                                    if (deliveryLabel) {
                                                        statusConfig = { ...statusConfig, label: `${statusConfig.label} (${deliveryLabel})` };
                                                        if (isFullyReceived && (status === 'Accounted' || status === 'Approved')) {
                                                            statusConfig.color = 'bg-teal-50 text-teal-700 border-teal-100 hover:bg-teal-100';
                                                        } else if (!isFullyReceived && totalOrdered > 0 && (status === 'Accounted' || status === 'Approved')) {
                                                            statusConfig.color = 'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100';
                                                        }
                                                    }
                                                }
                                                
                                                const itemCount = Array.isArray(order.items) 
                                                    ? order.items.reduce((sum, cat) => sum + (cat.items?.length || 0), 0)
                                                    : 0;
     
                                                return (
                                                    <React.Fragment key={order.id}>
                                                        <tr 
                                                            id={"row-" + order.id}
                                                            className={`transition ${(status === 'Approved' || (req && req.total_amount > 0)) ? 'cursor-pointer hover:bg-green-50' : 'cursor-pointer hover:bg-slate-100'}`}
                                                            onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                                                            onDoubleClick={(e) => {
                                                                e.stopPropagation();
                                                                if ((status === 'Accounted' || status === 'Paid' || (req && (req.status === 'ĐÃ XONG' || req.status?.toUpperCase() === 'ACCOUNTED'))) && onNavigateToHistoryWithId && req) {
                                                                    onNavigateToHistoryWithId(req.id);
                                                                } else if (onNavigateToProject) {
                                                                    onNavigateToProject(order.project_name);
                                                                }
                                                            }}
                                                        >
                                                            <td className="px-6 py-4 whitespace-nowrap text-xs font-mono font-bold text-slate-400 hidden md:table-cell">
                                                                {formatDateVN(order.order_date)}
                                                            </td>
                                                            <td className="px-6 py-4 font-bold text-slate-800">
                                                                {order.project_name}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold font-mono whitespace-nowrap inline-block">
                                                                    {order.order_phase}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 truncate max-w-[150px] hidden lg:table-cell">
                                                                {order.recipient.split('(')[0]}
                                                            </td>
                                                            <td className="px-6 py-4 truncate max-w-[120px] text-slate-500 italic hidden xl:table-cell">
                                                                {order.created_by || '-'}
                                                            </td>
                                                            <td className="px-6 py-4 text-center font-bold hidden sm:table-cell">
                                                                {itemCount}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold transition ${statusConfig.color}`}>
                                                                    <StatusIcon size={12} />
                                                                    {statusConfig.label}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => {
                                                                e.stopPropagation();
                                                                openInvoiceModal(order);
                                                            }}>
                                                                {(() => {
                                                                    let invList = Array.isArray(order.invoices) ? order.invoices : [];
                                                                    if (invList.length === 0 && (order.invoice_number || order.invoice_date || order.invoice_pdf_url)) {
                                                                        invList = [{ number: order.invoice_number || '' }];
                                                                    }
                                                                    const numbers = invList.map(inv => inv.number).filter(Boolean).join(', ');
                                                                    return numbers ? (
                                                                        <span className="font-bold text-slate-700 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 px-2.5 py-1 rounded-lg border border-slate-200/40 transition cursor-pointer inline-block max-w-[120px] truncate" title={numbers}>
                                                                            {numbers}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-xs text-indigo-500 hover:text-indigo-600 hover:underline cursor-pointer font-bold flex items-center gap-1">
                                                                            <Plus size={12} /> Nhập số HD
                                                                        </span>
                                                                    );
                                                                })()}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => {
                                                                e.stopPropagation();
                                                                openInvoiceModal(order);
                                                            }}>
                                                                {(() => {
                                                                    let invList = Array.isArray(order.invoices) ? order.invoices : [];
                                                                    if (invList.length === 0 && (order.invoice_number || order.invoice_date || order.invoice_pdf_url)) {
                                                                        invList = [{ date: order.invoice_date || '' }];
                                                                    }
                                                                    const dates = invList.map(inv => inv.date ? formatDateVN(inv.date) : '').filter(Boolean).join(', ');
                                                                    return dates ? (
                                                                        <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 px-2.5 py-1 rounded-lg border border-slate-200/40 transition cursor-pointer inline-block max-w-[150px] truncate" title={dates}>
                                                                            {dates}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-xs text-indigo-500 hover:text-indigo-600 hover:underline cursor-pointer font-bold flex items-center gap-1">
                                                                            <Plus size={12} /> Nhập ngày HD
                                                                        </span>
                                                                    );
                                                                })()}
                                                            </td>
                                                            <td className="px-6 py-4 text-center whitespace-nowrap" onClick={(e) => {
                                                                e.stopPropagation();
                                                                openInvoiceModal(order);
                                                            }}>
                                                                {(() => {
                                                                    let invList = Array.isArray(order.invoices) ? order.invoices : [];
                                                                    if (invList.length === 0 && (order.invoice_number || order.invoice_date || order.invoice_pdf_url)) {
                                                                        invList = [{ number: order.invoice_number || '', pdf_url: order.invoice_pdf_url || '' }];
                                                                    }
                                                                    const pdfs = invList.filter(inv => inv.pdf_url);
                                                                    if (pdfs.length === 0) {
                                                                        return (
                                                                            <span className="text-xs text-slate-400 hover:text-indigo-600 hover:underline cursor-pointer font-bold flex items-center justify-center gap-1">
                                                                                <Upload size={12} /> Tải PDF
                                                                            </span>
                                                                        );
                                                                    }
                                                                    return (
                                                                        <div className="flex items-center justify-center gap-1.5 flex-wrap max-w-[150px]">
                                                                            {pdfs.map((inv, idx) => (
                                                                                <a 
                                                                                    key={idx}
                                                                                    href={inv.pdf_url} 
                                                                                    target="_blank" 
                                                                                    rel="noopener noreferrer" 
                                                                                    className="p-1 px-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-md text-[11px] transition-all duration-200 flex items-center gap-0.5 font-bold border border-blue-100" 
                                                                                    title={'Xem hóa đơn ' + (inv.number || (idx + 1))}
                                                                                    onClick={(e) => e.stopPropagation()}
                                                                                >
                                                                                    <Eye size={11} /> {inv.number ? (inv.number.length > 5 ? inv.number.substring(0,5)+'..' : inv.number) : ('HĐ ' + (idx + 1))}
                                                                                </a>
                                                                            ))}
                                                                            <button 
                                                                                onClick={(e) => { e.stopPropagation(); openInvoiceModal(order); }}
                                                                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition"
                                                                                title="Thêm/Xóa/Sửa hóa đơn"
                                                                            >
                                                                                <Edit3 size={12} />
                                                                            </button>
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </td>
                                                            <td className="px-6 py-4 text-right whitespace-nowrap font-mono font-bold hidden md:table-cell">
                                                                {status === 'Approved' || (req && req.total_amount > 0) ? (
                                                                     <span className="text-green-600">{formatCurrency(req.total_amount)}</span>
                                                                ) : (
                                                                    status === 'Draft' || status === 'Rejected' || status === 'Deleted' ? (
                                                                        <span className="text-slate-400 italic font-normal text-xs">-</span>
                                                                    ) : (
                                                                        <span className="text-slate-400 italic font-normal text-xs">Chờ hạch toán</span>
                                                                    )
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4 text-center whitespace-nowrap">
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <button 
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setExpandedOrderId(expandedOrderId === order.id ? null : order.id);
                                                                        }}
                                                                        className="bg-sky-50 text-sky-600 hover:bg-sky-100 p-1.5 rounded-xl transition"
                                                                        title="Quản lý hàng về"
                                                                    >
                                                                        {expandedOrderId === order.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleSelectOrder(order)}
                                                                        className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5"
                                                                    >
                                                                        <Eye size={14} /> Chi tiết
                                                                    </button>
                                                                    <button 
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleExportExcel(order);
                                                                        }}
                                                                        className="bg-green-50 text-green-600 hover:bg-green-100 p-1.5 rounded-xl transition"
                                                                        title="Xuất Excel"
                                                                    >
                                                                        <Download size={15} />
                                                                    </button>
                                                                    {(status !== 'Draft' && status !== 'Waiting QS' && currentUser?.role?.toUpperCase() === 'ADMIN' && req) && (
                                                                        <button 
                                                                            onClick={(e) => handleRevertOrderStatus(req.id, e)}
                                                                            className="bg-amber-50 text-amber-600 hover:bg-amber-100 p-1.5 rounded-xl transition"
                                                                            title="Hoàn tác trạng thái"
                                                                        >
                                                                            <RotateCcw size={15} />
                                                                        </button>
                                                                    )}
                                                                    {(() => {
                                                                        const isPendingDelete = deleteRequests.some(r => r.original_table === 'material_orders' && r.record_id === order.id);
                                                                        if (isPendingDelete) {
                                                                            return (
                                                                                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded whitespace-nowrap self-center">
                                                                                    Chờ xóa
                                                                                </span>
                                                                            );
                                                                        }
                                                                        const isAuthorizer = currentUser?.role?.toUpperCase() === 'ADMIN' || currentUser?.role?.toUpperCase() === 'QS TRƯỞNG';
                                                                        const canDelete = status === 'Draft' || status === 'Rejected' || isAuthorizer;
                                                                        if (!canDelete) return null;
                                                                        return (
                                                                            <button 
                                                                                onClick={(e) => handleDeleteOrder(order.id, e, req?.id)}
                                                                                className="bg-red-50 text-red-500 hover:bg-red-100 p-1.5 rounded-xl transition"
                                                                                title={isAuthorizer ? "Xóa Đơn Đặt Hàng" : "Đề nghị xóa Đơn Hàng"}
                                                                            >
                                                                                <Trash2 size={15} />
                                                                            </button>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        {expandedOrderId === order.id && (
                                                            <tr className="bg-slate-50/50">
                                                                <td colSpan="11" className="p-0 border-y border-slate-200">
                                                                    <div className="p-6">
                                                                        <div className="mb-4 flex items-center gap-2">
                                                                            <div className="bg-sky-100 text-sky-600 p-1.5 rounded-lg">
                                                                                <Truck size={16} />
                                                                            </div>
                                                                            <h4 className="font-bold text-slate-800 text-sm">Theo dõi lượng hàng về (Đơn: {order.order_phase})</h4>
                                                                        </div>
                                                                        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
                                                                            <table className="w-full text-left min-w-[500px] md:min-w-[800px]">
                                                                                <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-black border-b border-slate-200">
                                                                                    <tr>
                                                                                        <th className="px-4 py-3">Vật tư</th>
                                                                                        <th className="px-4 py-3 hidden md:table-cell">ĐVT</th>
                                                                                        <th className="px-4 py-3 text-center hidden md:table-cell">SL Đặt</th>
                                                                                        <th className="px-4 py-3 text-center hidden md:table-cell">Đã Về</th>
                                                                                        <th className="px-4 py-3 text-center hidden md:table-cell">Còn Thiếu</th>
                                                                                        <th className="px-3 py-3 text-center md:hidden">SL (Tổng/Về/Thiếu)</th>
                                                                                        <th className="px-4 py-3 bg-blue-50/50 w-32">Ngày Về</th>
                                                                                        <th className="px-4 py-3 bg-blue-50/50 text-center w-24">SL Nhập</th>
                                                                                        <th className="px-4 py-3 bg-blue-50/50 hidden sm:table-cell">Ghi chú</th>
                                                                                        <th className="px-4 py-3 bg-blue-50/50 w-12"></th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-slate-100">
                                                                                    {(Array.isArray(order.items) ? order.items : []).map((cat, catIdx) => (
                                                                                        <React.Fragment key={catIdx}>
                                                                                            {cat.items && cat.items.map((item, itemIdx) => {
                                                                                                const orderQty = parseFloat(item.quantity) || 0;
                                                                if (orderQty <= 0) return null;
                                                                const receivedHistory = item.received_history || [];
                                                                const totalReceived = receivedHistory.reduce((sum, h) => sum + parseFloat(h.qty), 0);
                                                                const remaining = orderQty - totalReceived;
                                                                const statusColor = remaining <= 0 ? 'text-green-600' : 'text-amber-600';
                                                                const inputKey = `${order.id}_${catIdx}_${itemIdx}`;
                                                                const itemInputData = receiveData[inputKey] || { date: '', qty: '', note: '' };
                                                                
                                                                return (
                                                                    <React.Fragment key={itemIdx}>
                                                                        <tr className="hover:bg-slate-50/50 transition border-b border-slate-100 last:border-0">
                                                                            <td 
                                                                                className={`px-4 py-3 text-sm font-bold text-slate-700 transition ${receivedHistory.length > 0 ? 'cursor-pointer hover:text-indigo-600' : ''}`}
                                                                                onClick={() => receivedHistory.length > 0 && toggleItemExpansion(`${order.id}_${catIdx}_${itemIdx}`)}
                                                                                title={receivedHistory.length > 0 ? "Nhấn để xem các đợt nhận hàng" : ""}
                                                                            >
                                                                                <div className="flex flex-col gap-1">
                                                                                    <div>
                                                                                        {item.name} <span className="text-slate-400 font-normal">{item.colorCode || item.color_code ? `(${item.colorCode || item.color_code})` : ''}</span>
                                                                                    </div>
                                                                                    <div className="text-slate-500 text-xs uppercase md:hidden">{item.unit}</div>
                                                                                    {receivedHistory.length > 0 && (
                                                                                        <div className="mt-1 inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded w-max">
                                                                                            {expandedItems[`${order.id}_${catIdx}_${itemIdx}`] ? 'Ẩn chi tiết nhận' : `Xem ${receivedHistory.length} lần nhận`}
                                                                                            {expandedItems[`${order.id}_${catIdx}_${itemIdx}`] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-4 py-3 text-slate-600 text-xs font-mono hidden md:table-cell">{item.unit}</td>
                                                                            <td className="px-4 py-3 text-center font-bold text-slate-700 hidden md:table-cell">{orderQty}</td>
                                                                            <td className="px-4 py-3 text-center font-bold text-sky-600 hidden md:table-cell">{totalReceived}</td>
                                                                            <td className={`px-4 py-3 text-center font-bold hidden md:table-cell ${statusColor}`}>{remaining > 0 ? remaining : 0}</td>
                                                                            
                                                                            <td className="px-3 py-3 text-center text-xs leading-relaxed md:hidden">
                                                                                <div className="text-slate-500">Đặt: <strong className="text-slate-900">{orderQty}</strong></div>
                                                                                <div className="text-slate-500">Về: <strong className="text-sky-600">{totalReceived}</strong></div>
                                                                                <div className="text-slate-500">Thiếu: <strong className={statusColor}>{remaining > 0 ? remaining : 0}</strong></div>
                                                                            </td>
                                                                            
                                                                            <td className="px-4 py-2 bg-blue-50/20">
                                                                                {remaining > 0 ? (
                                                                                    <input 
                                                                                        type={itemInputData.date ? 'date' : 'text'}
                                                                                        placeholder="dd/mm/yyyy"
                                                                                        onFocus={(e) => e.target.type = 'date'}
                                                                                        onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }}
                                                                                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 outline-none focus:border-blue-500 font-mono text-xs sm:text-sm"
                                                                                        value={itemInputData.date || ''}
                                                                                        onChange={(e) => setReceiveData(prev => ({...prev, [inputKey]: { ...prev[inputKey], date: e.target.value }}))}
                                                                                    />
                                                                                ) : (
                                                                                    <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-1 rounded">Đã giao đủ</span>
                                                                                )}
                                                                            </td>
                                                                            <td className="px-4 py-2 bg-blue-50/20 text-center">
                                                                                {remaining > 0 && (
                                                                                    <input 
                                                                                        type="number"
                                                                                        min="0"
                                                                                        max={remaining}
                                                                                        step="any"
                                                                                        placeholder="Số lượng"
                                                                                        className="w-20 md:w-24 bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-center outline-none focus:border-blue-500 font-bold text-slate-700 text-xs sm:text-sm"
                                                                                        value={itemInputData.qty || ''}
                                                                                        onChange={(e) => setReceiveData(prev => ({...prev, [inputKey]: { ...prev[inputKey], qty: e.target.value }}))}
                                                                                    />
                                                                                )}
                                                                            </td>
                                                                            <td className="px-4 py-2 bg-blue-50/20 hidden sm:table-cell">
                                                                                {remaining > 0 && (
                                                                                    <input 
                                                                                        type="text"
                                                                                        placeholder="Ghi chú..."
                                                                                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 outline-none focus:border-blue-500 text-xs sm:text-sm"
                                                                                        value={itemInputData.note || ''}
                                                                                        onChange={(e) => setReceiveData(prev => ({...prev, [inputKey]: { ...prev[inputKey], note: e.target.value }}))}
                                                                                    />
                                                                                )}
                                                                            </td>
                                                                            <td className="px-4 py-3 text-center">
                                                                                {remaining > 0 ? (
                                                                                    <button
                                                                                        onClick={() => handleSaveReceive(order, catIdx, itemIdx)}
                                                                                        disabled={isSavingReceive || !itemInputData.date || !itemInputData.qty}
                                                                                        className={`p-2 rounded-xl transition-all shadow-sm ${
                                                                                            !itemInputData.date || !itemInputData.qty 
                                                                                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200' 
                                                                                                : 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-105 hover:shadow-md border border-blue-700'
                                                                                        }`}
                                                                                        title="Lưu số lượng hàng về"
                                                                                    >
                                                                                        <Save size={16} />
                                                                                    </button>
                                                                                ) : (
                                                                                    <span className="text-slate-300">-</span>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                        {expandedItems[`${order.id}_${catIdx}_${itemIdx}`] && receivedHistory.length > 0 && (
                                                                            <tr className="bg-slate-50/50">
                                                                                <td colSpan="6" className="p-2 md:p-3 md:pl-8">
                                                                                    <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-x-auto inline-block max-w-full">
                                                                                        <table className="w-max text-sm text-left">
                                                                                            <thead className="bg-indigo-50/50 text-indigo-800 border-b border-slate-200">
                                                                                                <tr>
                                                                                                    <th className="px-3 py-2 font-bold text-center">Lần nhận hàng</th>
                                                                                                    <th className="px-3 py-2 font-bold">Ngày nhận</th>
                                                                                                    <th className="px-3 py-2 font-bold text-right">Số lượng</th>
                                                                                                    <th className="px-3 py-2 font-bold">Ghi chú</th>
                                                                                                    <th className="px-3 py-2 font-bold text-center">Phiếu nhận hàng</th>
                                                                                                    <th className="px-3 py-2 font-bold text-center">Thao tác</th>
                                                                                                </tr>
                                                                                            </thead>
                                                                                            <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                                                                                                {receivedHistory.map((h, i) => (
                                                                                                    <tr key={i} className="hover:bg-slate-50 transition">
                                                                                                        <td className="px-3 py-2 text-center">{i + 1}</td>
                                                                                                        <td className="px-3 py-2 font-mono">{formatDateVN(h.date)}</td>
                                                                                                        <td className="px-3 py-2 text-right font-black text-indigo-600">{h.qty}</td>
                                                                                                        <td className="px-3 py-2">{h.note || '-'}</td>
                                                                                                        <td className="px-3 py-2 text-center">
                                                                                                            {(() => {
                                                                                                                const urls = h.receipt_urls || (h.receipt_url ? [h.receipt_url] : []);
                                                                                                                return (
                                                                                                                    <div className="flex flex-col items-center gap-2">
                                                                                                                        {urls.length > 0 && (
                                                                                                                            <div className="flex flex-wrap justify-center gap-2">
                                                                                                                                {urls.map((url, uIdx) => (
                                                                                                                                    <div key={uIdx} className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200 shadow-sm">
                                                                                                                                        <a href={url} target="_blank" rel="noopener noreferrer" className="p-1 text-blue-600 hover:text-blue-800 transition-colors" title={`Xem ảnh ${uIdx + 1}`}>
                                                                                                                                            <Eye size={14} />
                                                                                                                                        </a>
                                                                                                                                        <button 
                                                                                                                                            onClick={() => handleDeleteReceiptOnly(order, catIdx, itemIdx, i, url)}
                                                                                                                                            className="p-1 text-rose-500 hover:text-rose-700 transition-colors"
                                                                                                                                            title="Xóa ảnh này"
                                                                                                                                        >
                                                                                                                                            <XCircle size={14} />
                                                                                                                                        </button>
                                                                                                                                    </div>
                                                                                                                                ))}
                                                                                                                            </div>
                                                                                                                        )}
                                                                                                                        
                                                                                                                        <div className="flex items-center justify-center gap-1.5">
                                                                                                                            {/* Camera Upload */}
                                                                                                                            <div className="relative group/camera">
                                                                                                                                <input 
                                                                                                                                    type="file" 
                                                                                                                                    accept="image/*"
                                                                                                                                    capture="environment"
                                                                                                                                    multiple
                                                                                                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                                                                                                    onChange={(e) => handleUploadReceipt(e, order, catIdx, itemIdx, i, h)}
                                                                                                                                    disabled={uploadingId === `${order.id}_${catIdx}_${itemIdx}_${i}`}
                                                                                                                                    title="Chụp thêm ảnh"
                                                                                                                                />
                                                                                                                                <button className={`p-1.5 ${uploadingId === `${order.id}_${catIdx}_${itemIdx}_${i}` ? 'bg-slate-100 text-slate-400' : 'bg-slate-50 text-slate-600 border border-slate-200/60 group-hover/camera:bg-indigo-600 group-hover/camera:text-white group-hover/camera:border-indigo-600 group-hover/camera:scale-105'} rounded-lg transition-all duration-200`} title="Chụp thêm ảnh">
                                                                                                                                    <Camera size={15} className={uploadingId === `${order.id}_${catIdx}_${itemIdx}_${i}` ? 'animate-bounce' : ''} />
                                                                                                                                </button>
                                                                                                                            </div>
                                                                                                                            {/* Normal Upload */}
                                                                                                                            <div className="relative group/upload">
                                                                                                                                <input 
                                                                                                                                    type="file" 
                                                                                                                                    accept=".pdf,image/*"
                                                                                                                                    multiple
                                                                                                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                                                                                                    onChange={(e) => handleUploadReceipt(e, order, catIdx, itemIdx, i, h)}
                                                                                                                                    disabled={uploadingId === `${order.id}_${catIdx}_${itemIdx}_${i}`}
                                                                                                                                    title="Tải thêm phiếu (PDF/Ảnh)"
                                                                                                                                />
                                                                                                                                <button className={`p-1.5 ${uploadingId === `${order.id}_${catIdx}_${itemIdx}_${i}` ? 'bg-slate-100 text-slate-400' : 'bg-slate-50 text-slate-600 border border-slate-200/60 group-hover/upload:bg-emerald-600 group-hover/upload:text-white group-hover/upload:border-emerald-600 group-hover/upload:scale-105'} rounded-lg transition-all duration-200`} title="Tải thêm phiếu">
                                                                                                                                    <Upload size={15} className={uploadingId === `${order.id}_${catIdx}_${itemIdx}_${i}` ? 'animate-bounce' : ''} />
                                                                                                                                </button>
                                                                                                                            </div>
                                                                                                                        </div>
                                                                                                                    </div>
                                                                                                                );
                                                                                                            })()}
                                                                                                        </td>
                                                                                                        <td className="px-3 py-2 text-center">
                                                                                                            <div className="flex items-center justify-center gap-1.5">
                                                                                                                <button 
                                                                                                                    onClick={() => {
                                                                                                                        setEditReceiveModal({
                                                                                                                            isOpen: true,
                                                                                                                            order: order,
                                                                                                                            catIdx: catIdx,
                                                                                                                            itemIdx: itemIdx,
                                                                                                                            historyIdx: i,
                                                                                                                            oldItem: h,
                                                                                                                            data: { qty: h.qty, date: h.date, note: h.note || '' }
                                                                                                                        });
                                                                                                                    }}
                                                                                                                    className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-all duration-200"
                                                                                                                    title="Sửa đợt này"
                                                                                                                >
                                                                                                                    <Edit3 size={14} />
                                                                                                                </button>
                                                                                                                <button 
                                                                                                                    onClick={() => handleDeleteReceiveHistory(order, catIdx, itemIdx, i, h)}
                                                                                                                    className="p-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-all duration-200"
                                                                                                                    title="Xóa đợt này"
                                                                                                                >
                                                                                                                    <Trash2 size={14} />
                                                                                                                </button>
                                                                                                            </div>
                                                                                                        </td>
                                                                                                    </tr>
                                                                                                ))}
                                                                                            </tbody>
                                                                                        </table>
                                                                                    </div>
                                                                                </td>
                                                                            </tr>
                                                                        )}
                                                                    </React.Fragment>
                                                                );
                                                            })}
                                                        </React.Fragment>
                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </>

            {/* DETAIL VIEW MODAL OVERLAY */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-50 rounded-3xl shadow-2xl w-full max-w-5xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                        {/* Sticky Modal Header */}
                        <header className="px-6 py-4 bg-white border-b border-slate-200 flex justify-between items-center sticky top-0 z-10">
                            <div>
                                <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                                    <ClipboardList className="text-indigo-600" size={20} />
                                    <span>{isMuaHoManager ? 'Chi tiết đơn mua hộ' : 'Chi tiết đơn vật tư'}</span>
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Công trình: <span className="font-semibold text-slate-700">{selectedOrder.project_name}</span> | Đợt: <span className="font-semibold text-slate-700">{selectedOrder.order_phase}</span>
                                </p>
                            </div>
                            <button 
                                onClick={() => { setSelectedOrder(null); setMatchedRequest(null); }}
                                className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </header>

                        {/* Modal Body / Scrollable Content */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            {/* DETAIL VIEW (WITH PRINT & COST ALLOCATION) */}
                            <div className="space-y-6">
                                {/* ACTION BUTTONS */}
                                <div className="flex justify-end gap-3 no-print">
                                    <button 
                                        onClick={handlePrint}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 shadow-lg shadow-indigo-600/15 cursor-pointer"
                                    >
                                        <Printer size={16} /> IN PHIẾU A4
                                    </button>
                                    <button 
                                        onClick={() => handleExportExcel(selectedOrder)}
                                        className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 shadow-lg shadow-green-600/15 cursor-pointer"
                                    >
                                        <Download size={16} /> XUẤT EXCEL
                                    </button>
                                </div>

                    {/* TRACKING STATUS BANNER */}
                    {matchedRequest && (
                        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4 no-print">
                            <div className="flex items-center gap-3">
                                <div className={`p-3 rounded-2xl border ${STATUS_LABELS[matchedRequest.status]?.color || 'bg-slate-50 text-slate-500'}`}>
                                    {matchedRequest.status === 'Accounted' ? <CheckCircle size={20} /> : <Clock size={20} />}
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 text-sm uppercase">Tình trạng dòng tiền</h4>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Trạng thái duyệt hạch toán: <strong className="text-indigo-600">{STATUS_LABELS[matchedRequest.status]?.label || 'Đang xử lý'}</strong>
                                    </p>
                                </div>
                            </div>
                            
                            <div className="text-right">
                                <span className="text-xs text-slate-400 block font-bold uppercase tracking-wider">Tổng giá trị hạch toán</span>
                                <span className="text-xl font-black text-slate-900 mt-1 block">
                                    {matchedRequest.status === 'Accounted' || matchedRequest.total_amount > 0 ? (
                                        <span className="text-green-600 font-mono">{formatCurrency(matchedRequest.total_amount)}</span>
                                    ) : (
                                        <span className="text-slate-400 italic font-normal text-sm">Chờ kế toán hạch toán đơn giá</span>
                                    )}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* A4 PRINT LAYOUT CONTAINER */}
                    <div className="print-area bg-white p-4 sm:p-8 lg:p-12 rounded-3xl border border-slate-200 shadow-sm space-y-8 max-w-4xl mx-auto overflow-x-auto custom-scrollbar">
                        
                        {/* Company & Document Header */}
                        <div className="flex flex-col items-center text-center space-y-2 border-b-2 border-double border-slate-900 pb-4">
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">ĐƠN ĐẶT HÀNG SƠN NƯỚC</h1>
                            <p className="text-xs text-slate-500 font-extrabold uppercase tracking-wide">{selectedOrder.company}</p>
                            <div className="w-16 h-0.5 bg-slate-900 mt-1"></div>
                        </div>

                        {/* General Info Sheet */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-3 text-sm text-slate-700">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                <div className="flex items-center gap-2 shrink-0">
                                    <Briefcase size={16} className="text-slate-400 no-print" />
                                    <span className="font-bold min-w-[120px]">Công trình:</span>
                                </div>
                                <span className="text-slate-950 font-black">{selectedOrder.project_name}</span>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                <div className="flex items-center gap-2 shrink-0">
                                    <Calendar size={16} className="text-slate-400 no-print" />
                                    <span className="font-bold min-w-[120px]">Ngày đặt:</span>
                                </div>
                                <span className="text-slate-950 font-mono font-bold">{formatDateVN(selectedOrder.order_date)}</span>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                <div className="flex items-center gap-2 shrink-0">
                                    <MapPin size={16} className="text-slate-400 no-print" />
                                    <span className="font-bold min-w-[120px]">Địa chỉ:</span>
                                </div>
                                <span className="text-slate-950">{selectedOrder.address}</span>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                <div className="flex items-center gap-2 shrink-0">
                                    <Tag size={16} className="text-slate-400 no-print" />
                                    <span className="font-bold min-w-[120px]">Đợt đặt hàng:</span>
                                </div>
                                <span className="text-slate-950 font-black font-mono">{selectedOrder.order_phase}</span>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 lg:col-span-2">
                                <div className="flex items-center gap-2 shrink-0">
                                    <User size={16} className="text-slate-400 no-print" />
                                    <span className="font-bold min-w-[120px]">Người nhận hàng:</span>
                                </div>
                                <span className="text-slate-950 font-extrabold">{selectedOrder.recipient}</span>
                            </div>
                        </div>

                        {/* Main Materials Items Table */}
                        <div className="overflow-x-auto print:overflow-visible">
                            <table className="w-full border-collapse border border-black text-left text-sm text-black min-w-[700px] print:min-w-0">
                                <thead>
                                    <tr className="font-bold border-b border-black">
                                        <th className="px-3 py-3 border-r border-black text-center w-10">STT</th>
                                        <th className="px-3 py-3 border-r border-black w-[28%]">Chủng loại vật tư sơn nước</th>
                                        <th className="px-3 py-3 border-r border-black text-center w-20">Mã màu</th>
                                        <th className="px-3 py-3 border-r border-black text-center w-16">DVT</th>
                                        <th className="px-3 py-3 border-r border-black text-center w-16">Số lượng</th>
                                        <th className="px-3 py-3 border-r border-black text-right w-24">Đơn giá</th>
                                        <th className="px-3 py-3 border-r border-black text-right w-28">Thành tiền</th>
                                        <th className="px-3 py-3 w-[16%]">Ghi chú</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-900 font-medium">
                                    {(() => {
                                        let globalStt = 1;
                                        let itemsList = [];
                                        
                                        if (matchedRequest && (matchedRequest.status === 'Accounted' || matchedRequest.total_amount > 0)) {
                                            try {
                                                const parsed = JSON.parse(matchedRequest.reason);
                                                itemsList = parsed.items || [];
                                            } catch (e) {
                                                itemsList = [];
                                            }
                                        }

                                        const safeOrderItems = Array.isArray(selectedOrder?.items) ? selectedOrder.items : [];
                                        return safeOrderItems.map((cat, catIdx) => {
                                            const currentCatItems = Array.isArray(cat?.items) ? cat.items : [];
                                            const catHasQuantity = currentCatItems.some(it => parseFloat(it.quantity) > 0);
                                            if (!catHasQuantity) return null;

                                            return (
                                                <React.Fragment key={cat.id || cat.name || catIdx}>
                                                    {/* Category Header Row */}
                                                    <tr className="font-bold border-b border-black">
                                                        <td colSpan="8" className="px-4 py-2 border-r border-black">
                                                            {cat.name}
                                                        </td>
                                                    </tr>
                                                    
                                                    {/* Category Items */}
                                                    {currentCatItems.map((it, itemIdx) => {
                                                        const qty = parseFloat(it.quantity);
                                                        if (isNaN(qty) || qty <= 0) return null;

                                                        // Match with live accounting item
                                                        let matchedAllocated = null;
                                                        if (itemsList.length > 0) {
                                                            matchedAllocated = itemsList.find(ai => ai?.content?.includes(it?.name || ''));
                                                        }

                                                        const allocatedAmount = matchedAllocated ? matchedAllocated.amount : 0;
                                                        const unitPrice = matchedAllocated ? (allocatedAmount / qty) : (parseFloat(it.price) || 0);
                                                        const finalAllocated = matchedAllocated ? allocatedAmount : (unitPrice * qty);
                                                        const note = matchedAllocated?.note || it.note || '';

                                                        return (
                                                            <tr key={it.stt || itemIdx} className="border-b border-black">
                                                                <td className="px-4 py-2.5 border-r border-black text-center font-bold">{globalStt++}</td>
                                                                <td className="px-4 py-2.5 border-r border-black font-bold">{it.name}</td>
                                                                <td className="px-4 py-2.5 border-r border-black text-center font-medium">{it.colorCode || '-'}</td>
                                                                <td className="px-4 py-2.5 border-r border-black text-center">{it.unit}</td>
                                                                <td className="px-4 py-2.5 border-r border-black text-center font-bold">{qty}</td>
                                                                <td className="px-4 py-2.5 border-r border-black text-right">
                                                                    {formatCurrency(unitPrice)}
                                                                </td>
                                                                <td className="px-4 py-2.5 border-r border-black text-right font-bold text-blue-800">
                                                                    {formatCurrency(finalAllocated)}
                                                                </td>
                                                                <td className="px-4 py-2.5 text-xs text-slate-500">{note}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </React.Fragment>
                                            );
                                        });
                                    })()}

                                    {/* Grand Total Row */}
                                    <tr className="font-bold border-t-2 border-black text-base">
                                        <td colSpan="6" className="px-4 py-3 border-r border-black text-right uppercase">Tổng cộng:</td>
                                        <td className="px-4 py-3 border-r border-black text-right font-bold text-lg text-blue-800">
                                            {formatCurrency(
                                                (Array.isArray(selectedOrder?.items) ? selectedOrder.items : []).reduce((total, cat) => {
                                                    let globalItemsList = [];
                                                    if (matchedRequest && (matchedRequest.status === 'Accounted' || matchedRequest.total_amount > 0)) {
                                                        try {
                                                            globalItemsList = JSON.parse(matchedRequest.reason).items || [];
                                                        } catch (e) { }
                                                    }
                                                    return total + (Array.isArray(cat?.items) ? cat.items : []).reduce((sum, item) => {
                                                        const qty = parseFloat(item.quantity) || 0;
                                                        let matched = null;
                                                        if (globalItemsList.length > 0) {
                                                            matched = globalItemsList.find(ai => ai?.content?.includes(item?.name || ''));
                                                        }
                                                        if (matched) return sum + matched.amount;
                                                        return sum + (parseFloat(item.price) || 0) * qty;
                                                    }, 0);
                                                }, 0)
                                            )}
                                        </td>
                                        <td className="px-4 py-3"></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Signatures section */}
                        {selectedOrder.show_signature && (
                            <div className="pt-8 grid grid-cols-2 text-center text-sm font-bold text-slate-950 gap-8">
                                <div className="space-y-16">
                                    <div>
                                        <p className="uppercase font-bold">Đại diện khách hàng</p>
                                        <p className="text-xs font-normal italic mt-0.5">ký và ghi rõ họ tên</p>
                                    </div>
                                    <div className="h-12"></div>
                                </div>
                                <div className="space-y-6">
                                    <div>
                                        <p className="uppercase font-bold">Người lập đơn</p>
                                        <p className="text-xs font-normal italic mt-0.5">ký và ghi rõ họ tên</p>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        {(() => {
                                            const creatorUsername = selectedOrder.created_by || currentUser?.username;
                                            const signatureUrl = usersList?.find(u => u.username === creatorUsername)?.signature_url;
                                            if (signatureUrl) {
                                                return <img src={signatureUrl} className="h-20 object-contain mix-blend-multiply" style={{ filter: 'grayscale(100%) contrast(300%) brightness(130%)' }} alt="Chữ ký" />;
                                            }
                                            return <p className="print-signature text-2xl font-bold font-serif italic text-black">{getSignatureName(getCommanderName(selectedOrder.recipient))}</p>;
                                        })()}
                                        <p className="mt-2 text-sm font-bold underline tracking-tight uppercase">{getCommanderName(selectedOrder.recipient)}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    </div>
)}

            {/* Custom Confirm Modal */}
            {confirmModal.isOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-7 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-5 shadow-sm border border-red-100">
                            <Trash2 size={32} />
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 text-center mb-2">Xác nhận xóa</h3>
                        <p className="text-slate-500 text-[15px] text-center mb-6 leading-relaxed px-2">
                            {confirmModal.message}
                        </p>
                        
                        {confirmModal.requirePassword && (
                            <div className="mb-6">
                                <label className="block text-xs font-bold text-slate-700 mb-1">Mật khẩu xác nhận:</label>
                                <input 
                                    type="password" 
                                    id="deletePasswordInput"
                                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500" 
                                    placeholder="Nhập mật khẩu..." 
                                    autoFocus
                                />
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button 
                                onClick={() => setConfirmModal({ isOpen: false, requirePassword: false, message: '', onConfirm: null })}
                                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 px-4 rounded-xl transition"
                            >
                                Hủy bỏ
                            </button>
                            <button 
                                onClick={() => {
                                    if (confirmModal.requirePassword) {
                                        const pwd = document.getElementById('deletePasswordInput')?.value;
                                        if (pwd !== adminPassword) {
                                            showToast('Mật khẩu không đúng!', 'error');
                                            return;
                                        }
                                    }
                                    confirmModal.onConfirm();
                                }}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-red-600/20 transition"
                            >
                                Xóa vĩnh viễn
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Receive Modal */}
            {editReceiveModal.isOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
                        <div className="bg-indigo-600 px-5 py-4 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Edit3 size={18} />
                                Chỉnh sửa đợt nhận hàng
                            </h3>
                            <button 
                                onClick={() => setEditReceiveModal({ isOpen: false, data: null, order: null, catIdx: null, itemIdx: null, historyIdx: null, oldItem: null })}
                                className="text-white/70 hover:text-white transition"
                            >
                                <XCircle size={24} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Ngày nhận <span className="text-red-500">*</span></label>
                                <input 
                                    type="date" 
                                    value={editReceiveModal.data.date}
                                    onChange={(e) => setEditReceiveModal(prev => ({...prev, data: {...prev.data, date: e.target.value}}))}
                                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm font-medium"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Số lượng <span className="text-red-500">*</span></label>
                                <input 
                                    type="number" 
                                    value={editReceiveModal.data.qty}
                                    onChange={(e) => setEditReceiveModal(prev => ({...prev, data: {...prev.data, qty: e.target.value}}))}
                                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm font-medium"
                                    placeholder="Nhập số lượng..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Ghi chú</label>
                                <textarea 
                                    value={editReceiveModal.data.note}
                                    onChange={(e) => setEditReceiveModal(prev => ({...prev, data: {...prev.data, note: e.target.value}}))}
                                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm resize-none"
                                    rows="2"
                                    placeholder="Nhập ghi chú nếu có..."
                                />
                            </div>
                        </div>
                        <div className="bg-slate-50 px-5 py-4 border-t border-slate-200 flex justify-end gap-3">
                            <button 
                                onClick={() => setEditReceiveModal({ isOpen: false, data: null, order: null, catIdx: null, itemIdx: null, historyIdx: null, oldItem: null })}
                                className="px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 transition"
                            >
                                Hủy bỏ
                            </button>
                            <button 
                                onClick={handleSaveEditReceive}
                                disabled={isSavingReceive}
                                className="px-5 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition disabled:opacity-50 flex items-center gap-2"
                            >
                                {isSavingReceive ? (
                                    <>
                                        <RefreshCw size={18} className="animate-spin" />
                                        Đang lưu...
                                    </>
                                ) : (
                                    <>
                                        <Save size={18} />
                                        Lưu thay đổi
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Invoice Info Edit Modal (Popup box with blur) */}
            {invoiceModal.isOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col transform transition-all duration-300 scale-100 max-h-[85vh]">
                        <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2 text-sm md:text-base">
                                <Edit3 size={18} />
                                Cập nhật thông tin hóa đơn
                            </h3>
                            <button 
                                onClick={() => setInvoiceModal({ isOpen: false, order: null, invoices: [] })}
                                className="text-white/70 hover:text-white transition"
                            >
                                <XCircle size={24} />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
                            <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-xl space-y-1">
                                <p className="text-xs text-slate-500 font-medium">Công trình: <span className="font-bold text-slate-800">{invoiceModal.order?.project_name}</span></p>
                                <p className="text-xs text-slate-500 font-medium">Đợt hàng: <span className="font-bold text-slate-800">{invoiceModal.order?.order_phase}</span></p>
                            </div>
                            
                            <div className="space-y-4 divide-y divide-slate-100">
                                {invoiceModal.invoices.map((inv, idx) => (
                                    <div key={idx} className="pt-4 first:pt-0 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                                        <div className="md:col-span-1 flex items-center justify-center mb-2 md:mb-0">
                                            <span className="bg-indigo-50 text-indigo-600 text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border border-indigo-100">
                                                {idx + 1}
                                            </span>
                                        </div>
                                        <div className="md:col-span-4">
                                            <label className="block text-slate-700 font-bold mb-1 uppercase tracking-wider text-[10px]">
                                                Số hóa đơn
                                            </label>
                                            <input 
                                                type="text" 
                                                value={inv.number}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setInvoiceModal(prev => {
                                                        const list = [...prev.invoices];
                                                        list[idx] = { ...list[idx], number: val };
                                                        return { ...prev, invoices: list };
                                                    });
                                                }}
                                                className="w-full border border-slate-200 bg-slate-50/30 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 focus:bg-white text-xs font-medium"
                                                placeholder="Nhập số HĐ..."
                                            />
                                        </div>
                                        <div className="md:col-span-3">
                                            <label className="block text-slate-700 font-bold mb-1 uppercase tracking-wider text-[10px]">
                                                Ngày hóa đơn
                                            </label>
                                            <input 
                                                type="date" 
                                                value={inv.date || ''}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setInvoiceModal(prev => {
                                                        const list = [...prev.invoices];
                                                        list[idx] = { ...list[idx], date: val };
                                                        return { ...prev, invoices: list };
                                                    });
                                                }}
                                                className="w-full border border-slate-200 bg-slate-50/30 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 focus:bg-white text-xs font-medium"
                                            />
                                        </div>
                                        <div className="md:col-span-3">
                                            <label className="block text-slate-700 font-bold mb-1 uppercase tracking-wider text-[10px]">
                                                File Hóa đơn PDF
                                            </label>
                                            {inv.pdf_url ? (
                                                <div className="flex items-center gap-1.5 h-[34px]">
                                                    <a 
                                                        href={inv.pdf_url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer" 
                                                        className="px-2.5 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                                                        title="Xem PDF"
                                                    >
                                                        <Eye size={12} /> Xem
                                                    </a>
                                                    <button 
                                                        onClick={() => handleDeleteInvoicePdfForIdx(idx)}
                                                        className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition"
                                                        title="Gỡ PDF"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="relative group/upload flex items-center h-[34px]">
                                                    <input
                                                        type="file"
                                                        accept=".pdf"
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                        onChange={(e) => handleUploadInvoicePdfForIdx(e, invoiceModal.order, idx)}
                                                        disabled={uploadingId === 'invoice_pdf_' + idx}
                                                    />
                                                    <button 
                                                        className="px-3 py-1.5 text-[11px] font-bold rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-600 flex items-center gap-1 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 w-full transition"
                                                    >
                                                        {uploadingId === 'invoice_pdf_' + idx ? (
                                                            <>
                                                                <RefreshCw size={12} className="animate-spin" />
                                                                Đang tải...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Upload size={12} /> Tải PDF
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="md:col-span-1 flex items-center justify-center h-[34px] mb-2 md:mb-0">
                                            {invoiceModal.invoices.length > 1 && (
                                                <button 
                                                    onClick={() => {
                                                        setInvoiceModal(prev => ({
                                                            ...prev,
                                                            invoices: prev.invoices.filter((_, i) => i !== idx)
                                                        }));
                                                    }}
                                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                                    title="Xóa hóa đơn này"
                                                >
                                                    <X size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            <button
                                onClick={() => {
                                    setInvoiceModal(prev => ({
                                        ...prev,
                                        invoices: [...prev.invoices, { number: '', date: '', pdf_url: '' }]
                                    }));
                                }}
                                className="w-full mt-2 py-2 border border-dashed border-indigo-300 hover:border-indigo-500 rounded-xl text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/40 transition flex items-center justify-center gap-1.5"
                            >
                                <Plus size={14} /> Thêm hóa đơn khác (HĐ 2, 3...)
                            </button>
                        </div>
                        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
                            <button 
                                onClick={() => setInvoiceModal({ isOpen: false, order: null, invoices: [] })}
                                className="px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition text-xs"
                            >
                                Hủy bỏ
                            </button>
                            <button 
                                onClick={() => handleSaveInvoiceInfo(invoiceModal.order, invoiceModal.invoices)}
                                className="px-5 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition flex items-center gap-2 text-xs"
                            >
                                <Save size={16} />
                                Lưu thông tin
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}