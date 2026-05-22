'use client';
/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

import React, { useState, useEffect } from 'react';
import { 
    Search, ClipboardList, Printer, Download, Eye, 
    Calendar, User, Briefcase, MapPin, CheckCircle, 
    Clock, AlertTriangle, XCircle, ArrowLeft, RefreshCw,
    DollarSign, Tag, Info, PieChart
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const STATUS_LABELS = {
    'Waiting QS': { label: 'Chờ QS duyệt', color: 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100', icon: Clock },
    'Waiting Accounting': { label: 'Chờ hạch toán', color: 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100', icon: Clock },
    'Paid': { label: 'Chờ hạch toán', color: 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100', icon: Clock },
    'Accounted': { label: 'Đã hoàn tất', color: 'bg-green-50 text-green-700 border-green-100 hover:bg-green-100', icon: CheckCircle },
    'Rejected': { label: 'Bị từ chối', color: 'bg-red-50 text-red-700 border-red-100 hover:bg-red-100', icon: XCircle }
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

export default function MaterialOrderManager({ currentUser, projects, dnttList, showToast }) {
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isDbStorage, setIsDbStorage] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProjectFilter, setSelectedProjectFilter] = useState('');
    const [selectedStatusFilter, setSelectedStatusFilter] = useState('');
    
    // View state
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [matchedRequest, setMatchedRequest] = useState(null);
    const [isStatsView, setIsStatsView] = useState(false);
    
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
                       d.recipient === order.recipient && 
                       parsed.date === order.order_date &&
                       parsed.items?.length > 0;
            } catch (e) {
                return false;
            }
        }) || null;
    };

    // Filters logic
    const filteredOrders = orders.filter(order => {
        const matchesSearch = 
            order.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.order_phase.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.recipient.toLowerCase().includes(searchTerm.toLowerCase());
            
        const matchesProject = selectedProjectFilter === '' || order.project_name === selectedProjectFilter;
        
        const req = getMatchedRequest(order);
        const status = req ? req.status : 'Draft';
        const matchesStatus = selectedStatusFilter === '' || status === selectedStatusFilter;
        
        return matchesSearch && matchesProject && matchesStatus;
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
            const catHasQuantity = cat.items.some(it => parseFloat(it.quantity) > 0);
            if (!catHasQuantity) return;

            rowsHtml += `
                <tr>
                    <td colspan="4" style="border: 1px solid #000; font-weight: bold; text-align: center; background-color: #f2f2f2; font-family: 'Times New Roman'; font-size: 13pt; height: 28px;">${cat.name}</td>
                </tr>
            `;
            cat.items.forEach(it => {
                const qty = parseFloat(it.quantity);
                if (isNaN(qty) || qty <= 0) return;

                rowsHtml += `
                    <tr style="height: 24px;">
                        <td style="border: 1px solid #000; text-align: center; font-family: 'Times New Roman'; font-size: 12pt;">${it.stt}</td>
                        <td style="border: 1px solid #000; font-family: 'Times New Roman'; font-size: 12pt; padding-left: 5px;">${it.name}</td>
                        <td style="border: 1px solid #000; text-align: center; font-family: 'Times New Roman'; font-size: 12pt;">${it.unit}</td>
                        <td style="border: 1px solid #000; text-align: right; font-weight: bold; font-family: 'Times New Roman'; font-size: 12pt; padding-right: 5px;">${qty}</td>
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
                        <col width="380" style="width: 380pt;" />
                        <col width="120" style="width: 120pt;" />
                        <col width="120" style="width: 120pt;" />
                    </colgroup>
                    
                    <!-- TITLE -->
                    <tr>
                        <td colspan="4" style="text-align: center; font-weight: bold; font-size: 16pt; font-family: 'Times New Roman'; height: 45px;">
                            ĐƠN ĐẶT HÀNG VẬT TƯ SƠN NƯỚC ${orderData.order_phase.toUpperCase()}
                        </td>
                    </tr>
                    
                    <!-- METADATA (MERGED AND SPACED FOR ABSOLUTE VISUAL BEAUTY, NO CUTS) -->
                    <tr style="height: 26px;">
                        <td colspan="4" style="font-family: 'Times New Roman'; font-size: 12pt;">
                            <b>DỰ ÁN :</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${orderData.project_name.toUpperCase()}
                        </td>
                    </tr>
                    <tr style="height: 26px;">
                        <td colspan="4" style="font-family: 'Times New Roman'; font-size: 12pt;">
                            <b>ĐỊA CHỈ :</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${(orderData.address || '').toUpperCase()}
                        </td>
                    </tr>
                    <tr style="height: 26px;">
                        <td colspan="4" style="font-weight: bold; font-family: 'Times New Roman'; font-size: 12pt; background-color: #ffff00;">
                            HẠNG MỤC : &nbsp;&nbsp;&nbsp;${(orderData.category || '').toUpperCase()}
                        </td>
                    </tr>
                    <tr style="height: 26px;">
                        <td colspan="4" style="font-family: 'Times New Roman'; font-size: 12pt;">
                            ${(orderData.company || '').toUpperCase()}
                        </td>
                    </tr>
                    <tr style="height: 26px;">
                        <td colspan="4" style="font-weight: bold; font-family: 'Times New Roman'; font-size: 12pt;">
                            NGƯỜI NHẬN HÀNG : ${(orderData.recipient || '').toUpperCase()}
                        </td>
                    </tr>
                    <tr style="height: 15px;"><td colspan="4"></td></tr>
                    
                    <!-- TABLE HEADERS -->
                    <tr style="background-color: #e6e6e6; height: 32px;">
                        <th width="60" style="border: 1px solid #000; font-weight: bold; text-align: center; font-size: 13pt; font-family: 'Times New Roman';">STT</th>
                        <th width="380" style="border: 1px solid #000; font-weight: bold; text-align: center; font-size: 13pt; font-family: 'Times New Roman';">Chủng loại vật tư</th>
                        <th width="120" style="border: 1px solid #000; font-weight: bold; text-align: center; font-size: 13pt; font-family: 'Times New Roman';">DVT</th>
                        <th width="120" style="border: 1px solid #000; font-weight: bold; text-align: center; font-size: 13pt; font-family: 'Times New Roman';">Số lượng</th>
                    </tr>
                    
                    ${rowsHtml}
                    
                    <tr style="height: 30px;"><td colspan="4"></td></tr>
                    
                    <!-- SIGNATURE BLOCK -->
                    <tr>
                        <td colspan="2"></td>
                        <td colspan="2" style="text-align: center; font-style: italic; font-family: 'Times New Roman'; font-size: 12pt;">
                            NGÀY ${dateComp.day} THÁNG ${dateComp.month} NĂM ${dateComp.year}
                        </td>
                    </tr>
                    <tr>
                        <td colspan="2"></td>
                        <td colspan="2" style="text-align: center; font-weight: bold; font-family: 'Times New Roman'; font-size: 12pt;">
                            NGƯỜI LẬP
                        </td>
                    </tr>
                    <tr style="height: 60px;">
                        <td colspan="2"></td>
                        <td colspan="2" style="text-align: center; vertical-align: middle;">
                            ${orderData.show_signature ? `
                            <span style="font-family: 'Brush Script MT', cursive, sans-serif; font-size: 24pt; color: #1e3a8a;">
                                ${getSignatureName(getCommanderName(orderData.recipient))}
                            </span>` : ''}
                        </td>
                    </tr>
                    <tr>
                        <td colspan="2"></td>
                        <td colspan="2" style="text-align: center; font-weight: bold; font-family: 'Times New Roman'; font-size: 12pt;">
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

            {!selectedOrder ? (
                <>
                    {/* HEADER */}
                    <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                                <div className="bg-indigo-600 p-2.5 rounded-2xl text-white shadow-lg shadow-indigo-600/25">
                                    <ClipboardList size={22} />
                                </div>
                                <span>Quản Lý Đơn Vật Tư</span>
                            </h2>
                            <p className="text-slate-500 text-sm mt-1">
                                Danh sách và tình trạng phê duyệt, phân bổ chi phí của các đơn đặt hàng vật tư sơn nước.
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
                                <option value="Draft">Nháp / Chưa gửi</option>
                                <option value="Waiting QS">Chờ QS duyệt</option>
                                <option value="Paid">Chờ hạch toán</option>
                                <option value="Accounted">Đã hoàn tất</option>
                                <option value="Rejected">Bị từ chối</option>
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
                                    <table className="w-full text-left border-collapse" style={{ minWidth: '1100px' }}>
                                        <thead>
                                            <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-black uppercase text-slate-400 tracking-wider whitespace-nowrap">
                                                <th className="px-6 py-4">Ngày đặt</th>
                                                <th className="px-6 py-4">Công trình</th>
                                                <th className="px-6 py-4">Đợt đặt hàng</th>
                                                <th className="px-6 py-4">Người nhận</th>
                                                <th className="px-6 py-4">Người đặt</th>
                                                <th className="px-6 py-4 text-center">Số vật tư</th>
                                                <th className="px-6 py-4">Trạng thái</th>
                                                <th className="px-6 py-4 text-right">Hạch toán thực tế</th>
                                                <th className="px-6 py-4 text-center">Thao tác</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-sm text-slate-600 font-medium">
                                            {filteredOrders.map(order => {
                                                const req = getMatchedRequest(order);
                                                const status = req ? req.status : 'Draft';
                                                const statusConfig = STATUS_LABELS[status] || { label: 'Nháp', color: 'bg-slate-50 text-slate-500 border-slate-100', icon: Info };
                                                const StatusIcon = statusConfig.icon;
                                                const itemCount = Array.isArray(order.items) 
                                                    ? order.items.reduce((sum, cat) => sum + (cat.items?.length || 0), 0)
                                                    : 0;
     
                                                return (
                                                    <tr key={order.id} className="hover:bg-slate-50/50 transition">
                                                        <td className="px-6 py-4 whitespace-nowrap text-xs font-mono font-bold text-slate-400">
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
                                                        <td className="px-6 py-4 truncate max-w-[150px]">
                                                            {order.recipient.split('(')[0]}
                                                        </td>
                                                        <td className="px-6 py-4 truncate max-w-[120px] text-slate-500 italic">
                                                            {order.created_by || '-'}
                                                        </td>
                                                        <td className="px-6 py-4 text-center font-bold">
                                                            {itemCount}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold transition ${statusConfig.color}`}>
                                                                <StatusIcon size={12} />
                                                                {statusConfig.label}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right whitespace-nowrap font-mono font-bold">
                                                            {status === 'Accounted' || (req && req.total_amount > 0) ? (
                                                                 <span className="text-green-600">{formatCurrency(req.total_amount)}</span>
                                                            ) : (
                                                                <span className="text-slate-400 italic font-normal text-xs">Chờ hạch toán</span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-center whitespace-nowrap">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <button 
                                                                    onClick={() => handleSelectOrder(order)}
                                                                    className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5"
                                                                >
                                                                    <Eye size={14} /> Chi tiết
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleExportExcel(order)}
                                                                    className="bg-green-50 text-green-600 hover:bg-green-100 p-1.5 rounded-xl transition"
                                                                    title="Xuất Excel"
                                                                >
                                                                    <Download size={15} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </>
            ) : (
                /* DETAIL VIEW (WITH PRINT & COST ALLOCATION) */
                <div className="space-y-6">
                    {/* BACK BAR */}
                    <div className="flex justify-between items-center no-print">
                        <button 
                            onClick={() => { setSelectedOrder(null); setMatchedRequest(null); }}
                            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-2xl text-xs font-black transition flex items-center gap-2"
                        >
                            <ArrowLeft size={16} /> QUAY LẠI DANH SÁCH
                        </button>
                        
                        <div className="flex gap-3">
                            <button 
                                onClick={handlePrint}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-2xl text-xs font-black transition flex items-center gap-2 shadow-lg shadow-indigo-600/15"
                            >
                                <Printer size={16} /> IN PHIẾU A4
                            </button>
                            <button 
                                onClick={() => handleExportExcel(selectedOrder)}
                                className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-2xl text-xs font-black transition flex items-center gap-2 shadow-lg shadow-green-600/15"
                            >
                                <Download size={16} /> XUẤT EXCEL
                            </button>
                        </div>
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
                                        <th className="px-4 py-3 border-r border-black text-center w-12">STT</th>
                                        <th className="px-4 py-3 border-r border-black w-2/5">Chủng loại vật tư sơn nước</th>
                                        <th className="px-4 py-3 border-r border-black text-center w-16">DVT</th>
                                        <th className="px-4 py-3 border-r border-black text-center w-24">Số lượng đặt</th>
                                        {matchedRequest && (matchedRequest.status === 'Accounted' || matchedRequest.total_amount > 0) && (
                                            <>
                                                <th className="px-4 py-3 border-r border-black text-right w-32">Đơn giá hạch toán</th>
                                                <th className="px-4 py-3 border-r border-black text-right w-32">Thành tiền</th>
                                            </>
                                        )}
                                        <th className="px-4 py-3">Ghi chú</th>
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

                                        return selectedOrder.items.map((cat, catIdx) => {
                                            const catHasQuantity = cat.items.some(it => parseFloat(it.quantity) > 0);
                                            if (!catHasQuantity) return null;

                                            return (
                                                <React.Fragment key={cat.id || cat.name || catIdx}>
                                                    {/* Category Header Row */}
                                                    <tr className="font-bold border-b border-black">
                                                        <td colSpan={matchedRequest && (matchedRequest.status === 'Accounted' || matchedRequest.total_amount > 0) ? "7" : "5"} className="px-4 py-2 border-r border-black">
                                                            {cat.name}
                                                        </td>
                                                    </tr>
                                                    
                                                    {/* Category Items */}
                                                    {cat.items.map((it, itemIdx) => {
                                                        const qty = parseFloat(it.quantity);
                                                        if (isNaN(qty) || qty <= 0) return null;

                                                        // Match with live accounting item
                                                        let matchedAllocated = null;
                                                        if (itemsList.length > 0) {
                                                            matchedAllocated = itemsList.find(ai => ai.content.includes(it.name));
                                                        }

                                                        const allocatedAmount = matchedAllocated ? matchedAllocated.amount : 0;
                                                        const unitPrice = qty > 0 ? (allocatedAmount / qty) : 0;
                                                        const note = matchedAllocated?.note || it.note || '';

                                                        return (
                                                            <tr key={it.stt || itemIdx} className="border-b border-black">
                                                                <td className="px-4 py-2.5 border-r border-black text-center font-bold">{globalStt++}</td>
                                                                <td className="px-4 py-2.5 border-r border-black font-bold">{it.name}</td>
                                                                <td className="px-4 py-2.5 border-r border-black text-center">{it.unit}</td>
                                                                <td className="px-4 py-2.5 border-r border-black text-center font-bold">{qty}</td>
                                                                {matchedRequest && (matchedRequest.status === 'Accounted' || matchedRequest.total_amount > 0) && (
                                                                    <>
                                                                        <td className="px-4 py-2.5 border-r border-black text-right">
                                                                            {formatCurrency(unitPrice)}
                                                                        </td>
                                                                        <td className="px-4 py-2.5 border-r border-black text-right font-bold">
                                                                            {formatCurrency(allocatedAmount)}
                                                                        </td>
                                                                    </>
                                                                )}
                                                                <td className="px-4 py-2.5 text-xs italic">{note}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </React.Fragment>
                                            );
                                        });
                                    })()}

                                    {/* Grand Total Row (Only if Accounted) */}
                                    {matchedRequest && (matchedRequest.status === 'Accounted' || matchedRequest.total_amount > 0) && (
                                        <tr className="font-bold border-t-2 border-black text-base">
                                            <td colSpan="5" className="px-4 py-3 border-r border-black text-right uppercase">Tổng cộng hạch toán thực tế:</td>
                                            <td className="px-4 py-3 border-r border-black text-right font-bold text-lg">
                                                {formatCurrency(matchedRequest.total_amount)}
                                            </td>
                                            <td className="px-4 py-3"></td>
                                        </tr>
                                    )}
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
                                        <p className="print-signature text-2xl font-bold font-serif italic text-black">{getSignatureName(getCommanderName(selectedOrder.recipient))}</p>
                                        <p className="mt-2 text-sm font-bold underline tracking-tight uppercase">{getCommanderName(selectedOrder.recipient)}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
