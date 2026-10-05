import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { CheckCircle, XCircle, Clock, Search, ShoppingCart, Loader2, ArrowRight } from 'lucide-react';
import MaterialOrder from '@/components/MaterialOrder';

export default function MaterialProcessing({ currentUser, projects, showToast, onNavigateToEdit, onNavigateToDetail }) {
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Chờ xử lý'); // 'Chờ xử lý', 'Phê duyệt', 'Đã đặt', 'Từ chối'
    const [previewOrder, setPreviewOrder] = useState(null);
    const [editOrder, setEditOrder] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchOrders = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('material_orders')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            setOrders(data || []);
        } catch (error) {
            showToast('Lỗi tải danh sách: ' + error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    const updateStatus = async (orderId, newStatus) => {
        const order = orders.find(o => o.id === orderId);
        if (!order) return;

        try {
            const updatedItems = [...(order.items || [])];
            if (updatedItems.length > 0) {
                updatedItems[0] = { ...updatedItems[0], _status: newStatus };
            }

            const { error } = await supabase
                .from('material_orders')
                .update({ items: updatedItems })
                .eq('id', orderId);

            if (error) throw error;
            
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, items: updatedItems } : o));
            showToast(`Đã chuyển trạng thái sang: ${newStatus}`);
        } catch (error) {
            showToast('Lỗi cập nhật: ' + error.message, 'error');
        }
    };

    const getStatus = (order) => {
        return order.items?.[0]?._status || 'Chờ xử lý';
    };

    const filteredOrders = orders.filter(o => {
        if (o.is_deleted) return false;
        const status = getStatus(o);
        if (status !== activeTab) return false;
        
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            return (
                o.project_name?.toLowerCase().includes(search) ||
                o.order_phase?.toLowerCase().includes(search) ||
                o.recipient?.toLowerCase().includes(search)
            );
        }
        return true;
    });

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Chờ xử lý': return <Clock className="w-4 h-4 text-amber-500" />;
            case 'Phê duyệt': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
            case 'Đã đặt': return <ShoppingCart className="w-4 h-4 text-blue-500" />;
            case 'Từ chối': return <XCircle className="w-4 h-4 text-red-500" />;
            default: return null;
        }
    };

    const getNextActions = (status) => {
        switch (status) {
            case 'Chờ xử lý':
                return [
                    { label: 'Phê duyệt', value: 'Phê duyệt', color: 'bg-emerald-500 hover:bg-emerald-600' },
                    { label: 'Từ chối', value: 'Từ chối', color: 'bg-red-500 hover:bg-red-600' },
                    { label: 'Sửa phiếu', value: 'Chờ xử lý', color: 'bg-blue-500 hover:bg-blue-600', isEdit: true }
                ];
            case 'Phê duyệt':
                return [
                    { label: 'Đã đặt', value: 'Đã đặt', color: 'bg-blue-500 hover:bg-blue-600' },
                    { label: 'Từ chối', value: 'Từ chối', color: 'bg-red-500 hover:bg-red-600' }
                ];
            case 'Từ chối':
                return [
                    { label: 'Sửa & Gửi lại', value: 'Chờ xử lý', color: 'bg-amber-500 hover:bg-amber-600', isEdit: true }
                ];
            case 'Đã đặt':
                return [
                    { label: 'Hủy đặt (Về Phê duyệt)', value: 'Phê duyệt', color: 'bg-slate-500 hover:bg-slate-600' }
                ];
            default:
                return [];
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
                        {['Chờ xử lý', 'Phê duyệt', 'Đã đặt', 'Từ chối'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition whitespace-nowrap ${
                                    activeTab === tab 
                                        ? 'bg-white text-blue-600 shadow-sm' 
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {getStatusIcon(tab)}
                                {tab}
                                <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full">
                                    {orders.filter(o => getStatus(o) === tab).length}
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full md:w-72">
                        <input
                            type="text"
                            placeholder="Tìm kiếm công trình..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 outline-none focus:border-blue-500 text-sm"
                        />
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center p-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-slate-500">
                    Không có đơn hàng nào trong trạng thái này.
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredOrders.map(order => (
                        <div 
                            key={order.id} 
                            className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition overflow-hidden flex flex-col cursor-pointer"
                            onClick={() => setPreviewOrder(order)}
                        >
                            <div className="p-6 border-b border-slate-100">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <span className="inline-block px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-black mb-2">
                                            {order.order_phase}
                                        </span>
                                        <h3 className="font-black text-lg text-slate-800 leading-tight">
                                            {order.project_name}
                                        </h3>
                                    </div>
                                    <span className="text-xs font-bold text-slate-400">
                                        {new Date(order.created_at).toLocaleDateString('vi-VN')}
                                    </span>
                                </div>
                                
                                <div className="space-y-2 text-sm text-slate-600 mb-4">
                                    <p><strong>Người nhận:</strong> {order.recipient}</p>
                                    <p><strong>Ngày đặt:</strong> {new Date(order.order_date).toLocaleDateString('vi-VN')}</p>
                                    <p><strong>Công ty:</strong> {order.order_company || 'N/A'}</p>
                                </div>
                            </div>
                            
                            <div className="p-4 bg-slate-50 flex-1 flex flex-col justify-end">
                                <div className="flex flex-wrap gap-2">
                                    {getNextActions(activeTab).map(action => (
                                        <button
                                            key={action.label}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (action.isEdit) { setEditOrder(order); } else {
                                                    updateStatus(order.id, action.value);
                                                }
                                            }}
                                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-white font-bold text-sm transition ${action.color}`}
                                        >
                                            {action.label}
                                            <ArrowRight className="w-4 h-4" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        
            {/* PREVIEW MODAL */}
            {previewOrder && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center justify-start overflow-y-auto bg-black/60 backdrop-blur-sm p-4 sm:p-8" onClick={() => setPreviewOrder(null)}>
                    <div className="w-full max-w-[800px] bg-white rounded-3xl overflow-hidden relative shadow-2xl mt-4 sm:mt-10 mb-10 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="bg-slate-50 border-b border-slate-200 p-6 flex justify-between items-center sticky top-0 z-10">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <ShoppingCart className="text-blue-600" /> Chi Tiết Đơn Đặt Hàng
                                </h3>
                                <p className="text-sm text-slate-500 mt-1 font-semibold">{previewOrder.project_name} - {previewOrder.order_phase}</p>
                            </div>
                            <button onClick={() => setPreviewOrder(null)} className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-full transition">
                                <XCircle size={20} />
                            </button>
                        </div>
                        
                        {/* Content */}
                        <div className="p-6 sm:p-8 bg-white font-['Times_New_Roman',_serif] text-[16px] text-black w-full mx-auto">
                            <div className="text-center mb-8">
                                <h1 className="font-bold text-2xl uppercase tracking-wider leading-normal">
                                    ĐƠN ĐẶT HÀNG VẬT TƯ
                                </h1>
                            </div>
                            
                            <div className="mb-8 space-y-3 pl-0 sm:pl-10 pr-0 sm:pr-10">
                                <div className="flex gap-2">
                                    <span className="uppercase w-40 shrink-0 font-bold">DỰ ÁN:</span>
                                    <span className="uppercase break-words">{previewOrder.project_name}</span>
                                </div>
                                <div className="flex gap-2">
                                    <span className="uppercase w-40 shrink-0 font-bold">ĐỊA CHỈ:</span>
                                    <span className="uppercase break-words">{previewOrder.address || '-'}</span>
                                </div>
                                <div className="flex gap-2">
                                    <span className="uppercase w-40 shrink-0 font-bold">HẠNG MỤC:</span>
                                    <span className="uppercase break-words">{previewOrder.order_phase}</span>
                                </div>
                                <div className="flex gap-2">
                                    <span className="uppercase w-40 shrink-0 font-bold">CÔNG TY:</span>
                                    <span className="uppercase break-words">{previewOrder.company || '-'}</span>
                                </div>
                                <div className="flex gap-2">
                                    <span className="uppercase w-40 shrink-0 font-bold">NGƯỜI NHẬN:</span>
                                    <span className="uppercase break-words">{previewOrder.recipient || '-'}</span>
                                </div>
                            </div>
                            
                            {/* Categories & Items */}
                            {previewOrder.items && previewOrder.items.map((cat, idx) => {
                                const validItems = cat.items?.filter(item => (parseFloat(item.quantity) || 0) > 0) || [];
                                if (validItems.length === 0) return null;
                                
                                return (
                                    <div key={idx} className="mb-8">
                                        <h3 className="font-bold uppercase text-[16px] mb-2 pl-0 sm:pl-10">- {cat.name}</h3>
                                        <table className="w-full border-collapse border border-black text-[15px] sm:w-[calc(100%-5rem)] mx-auto">
                                            <thead>
                                                <tr>
                                                    <th className="border border-black p-2 bg-slate-100">STT</th>
                                                    <th className="border border-black p-2 bg-slate-100">Tên vật tư</th>
                                                    <th className="border border-black p-2 bg-slate-100">Mã màu</th>
                                                    <th className="border border-black p-2 bg-slate-100 w-24">ĐVT</th>
                                                    <th className="border border-black p-2 bg-slate-100 w-24">Số lượng</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {validItems.map((item, i) => (
                                                    <tr key={i}>
                                                        <td className="border border-black p-2 text-center">{i + 1}</td>
                                                        <td className="border border-black p-2">{item.name}</td>
                                                        <td className="border border-black p-2 text-center">{item.colorCode || '-'}</td>
                                                        <td className="border border-black p-2 text-center">{item.unit || '-'}</td>
                                                        <td className="border border-black p-2 text-center font-bold text-blue-700">{item.quantity}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })}
                            
                            {/* Footer/Signatures */}
                            <div className="mt-12 flex justify-end">
                                <div className="text-center w-64 space-y-1">
                                    <p className="text-xs uppercase font-extrabold tracking-widest text-slate-400">
                                        NGÀY {new Date(previewOrder.order_date).getDate().toString().padStart(2, '0')} THÁNG {(new Date(previewOrder.order_date).getMonth() + 1).toString().padStart(2, '0')} NĂM {new Date(previewOrder.order_date).getFullYear()}
                                    </p>
                                    <p className="font-bold text-sm text-slate-800">NGƯỜI LẬP</p>
                                    <p className="font-bold text-[16px] text-black uppercase mt-12 pt-4">
                                        {previewOrder.created_by || 'ADMIN'}
                                    </p>
                                </div>
                            </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="bg-slate-50 border-t border-slate-200 p-6 flex justify-end gap-3 sticky bottom-0 z-10">
                            {getNextActions(getStatus(previewOrder), previewOrder).map(action => (
                                <button
                                    key={action.label}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (action.isEdit) { setEditOrder(previewOrder); setPreviewOrder(null); } else {
                                            updateStatus(previewOrder.id, action.value);
                                            setPreviewOrder(null);
                                        }
                                    }}
                                    className={`px-6 py-2.5 rounded-xl font-bold text-white transition shadow-sm ${action.color}`}
                                >
                                    {action.label} {action.value === 'Chờ xử lý' && '→'}
                                </button>
                            ))}
                            <button onClick={() => setPreviewOrder(null)} className="px-6 py-2.5 rounded-xl font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition">Đóng</button>
                        </div>
                    </div>
                </div>
            )}
        
            {/* EDIT MODAL */}
            {editOrder && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center justify-start overflow-y-auto bg-black/60 backdrop-blur-sm p-4 sm:p-8" onClick={() => setEditOrder(null)}>
                    <div className="w-full max-w-[1200px] bg-white rounded-3xl overflow-hidden relative shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-4 sm:p-8">
                            <h2 className="text-xl font-bold mb-4 flex items-center justify-between">
                                Sửa Phiếu: {editOrder.project_name}
                                <button onClick={() => setEditOrder(null)} className="p-2 bg-red-50 text-red-500 rounded-full hover:bg-red-100 transition"><XCircle size={20} /></button>
                            </h2>
                            <MaterialOrder 
                                currentUser={currentUser}
                                projects={projects}
                                actionOrder={{ order: editOrder, action: 'edit' }}
                                asModal={true}
                                onCloseModal={() => setEditOrder(null)}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
