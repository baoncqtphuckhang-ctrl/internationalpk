const fs = require('fs');

const whFile = 'components/MaterialWarehouse.jsx';
let whContent = fs.readFileSync(whFile, 'utf8');

// Modify handleDeleteRow in MaterialWarehouse.jsx
const whOldStr = `
                if (String(rowId).startsWith('order_')) {
                    const currentSavedRows = matrixData[selectedProject] || [];
                    let updatedRows = [...currentSavedRows];
                    const existingIdx = updatedRows.findIndex(r => r.id === rowId);
                    if (existingIdx >= 0) {
                        updatedRows[existingIdx] = { ...updatedRows[existingIdx], isDeleted: true };
                    } else {
                        updatedRows.push({ id: rowId, isDeleted: true });
                    }
                    saveData({ ...matrixData, [selectedProject]: updatedRows });
                }
`;

const whNewStr = `
                if (String(rowId).startsWith('order_')) {
                    const currentSavedRows = matrixData[selectedProject] || [];
                    let updatedRows = [...currentSavedRows];
                    const existingIdx = updatedRows.findIndex(r => r.id === rowId);
                    if (existingIdx >= 0) {
                        updatedRows[existingIdx] = { ...updatedRows[existingIdx], isDeleted: true };
                    } else {
                        updatedRows.push({ id: rowId, isDeleted: true });
                    }
                    saveData({ ...matrixData, [selectedProject]: updatedRows });
                    
                    // Xóa/Xử lý đơn bên order (Soft delete)
                    const orderId = String(rowId).replace('order_', '');
                    supabase.from('material_orders').update({ is_deleted: true }).eq('id', orderId).then(() => {
                        console.log('Soft deleted order', orderId);
                    });
                }
`;
if (whContent.includes(whOldStr.trim())) {
    whContent = whContent.replace(whOldStr.trim(), whNewStr.trim());
    fs.writeFileSync(whFile, whContent, 'utf8');
} else {
    console.log("Could not find the target string in MaterialWarehouse.jsx");
}

const procFile = 'components/MaterialProcessing.jsx';
let procContent = fs.readFileSync(procFile, 'utf8');

// 1. Accept new props
procContent = procContent.replace(
    'export default function MaterialProcessing({ currentUser, projects, showToast }) {',
    'export default function MaterialProcessing({ currentUser, projects, showToast, onNavigateToEdit, onNavigateToDetail }) {'
);

// 2. Add Edit to nextActions
const getNextActionsOld = `
    const getNextActions = (status) => {
        switch (status) {
            case 'Chờ xử lý':
                return [
                    { label: 'Phê duyệt', value: 'Phê duyệt', color: 'bg-emerald-500 hover:bg-emerald-600' },
                    { label: 'Từ chối', value: 'Từ chối', color: 'bg-red-500 hover:bg-red-600' }
                ];
            case 'Phê duyệt':
                return [
                    { label: 'Đã đặt', value: 'Đã đặt', color: 'bg-blue-500 hover:bg-blue-600' },
                    { label: 'Từ chối', value: 'Từ chối', color: 'bg-red-500 hover:bg-red-600' }
                ];
            case 'Từ chối':
                return [
                    { label: 'Chờ xử lý lại', value: 'Chờ xử lý', color: 'bg-amber-500 hover:bg-amber-600' }
                ];
            default:
                return [];
        }
    };
`;

const getNextActionsNew = `
    const getNextActions = (status, order) => {
        const canEdit = currentUser?.role?.toUpperCase() === 'QS' || currentUser?.role?.toUpperCase() === 'KẾ TOÁN' || currentUser?.role?.toUpperCase() === 'ADMIN' || currentUser?.role?.toUpperCase() === 'CHT';
        switch (status) {
            case 'Chờ xử lý':
                return [
                    { label: 'Phê duyệt', value: 'Phê duyệt', color: 'bg-emerald-500 hover:bg-emerald-600' },
                    { label: 'Từ chối', value: 'Từ chối', color: 'bg-red-500 hover:bg-red-600' },
                    ...(canEdit ? [{ label: 'Sửa', isEdit: true, color: 'bg-blue-500 hover:bg-blue-600' }] : [])
                ];
            case 'Phê duyệt':
                return [
                    { label: 'Đã đặt', value: 'Đã đặt', color: 'bg-blue-500 hover:bg-blue-600' },
                    { label: 'Từ chối', value: 'Từ chối', color: 'bg-red-500 hover:bg-red-600' }
                ];
            case 'Từ chối':
                return [
                    { label: 'Sửa & Gửi lại', isEdit: true, color: 'bg-blue-500 hover:bg-blue-600' },
                    { label: 'Chờ xử lý lại', value: 'Chờ xử lý', color: 'bg-amber-500 hover:bg-amber-600' }
                ];
            default:
                return [];
        }
    };
`;
procContent = procContent.replace(getNextActionsOld.trim(), getNextActionsNew.trim());

// 3. Update the Card rendering to pass `order` to `getNextActions` and handle `isEdit`
const oldButtons = `
                                    <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
                                        {getNextActions(status).map(action => (
                                            <button
                                                key={action.value}
                                                onClick={() => updateStatus(order.id, action.value)}
                                                className={\`flex-1 py-2 rounded-xl text-white font-bold text-sm transition shadow-sm \${action.color}\`}
                                            >
                                                {action.label} {action.value === 'Chờ xử lý' && '→'}
                                            </button>
                                        ))}
                                    </div>
`;
const newButtons = `
                                    <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2" onClick={(e) => e.stopPropagation()}>
                                        {getNextActions(status, order).map(action => (
                                            <button
                                                key={action.label}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (action.isEdit && onNavigateToEdit) {
                                                        onNavigateToEdit(order);
                                                    } else {
                                                        updateStatus(order.id, action.value);
                                                    }
                                                }}
                                                className={\`flex-1 py-2 rounded-xl text-white font-bold text-sm transition shadow-sm \${action.color}\`}
                                            >
                                                {action.label} {action.value === 'Chờ xử lý' && '→'}
                                            </button>
                                        ))}
                                    </div>
`;
procContent = procContent.replace(oldButtons.trim(), newButtons.trim());

// 4. Make card clickable for details
const oldCardTag = `<div key={order.id} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">`;
const newCardTag = `<div key={order.id} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer" onClick={() => onNavigateToDetail && onNavigateToDetail(order)}>`;
procContent = procContent.replace(oldCardTag, newCardTag);

// Hide deleted orders
const filterOld = `
    const filteredOrders = orders.filter(o => {
`;
const filterNew = `
    const filteredOrders = orders.filter(o => {
        if (o.is_deleted) return false;
`;
procContent = procContent.replace(filterOld.trim(), filterNew.trim());

fs.writeFileSync(procFile, procContent, 'utf8');
console.log('Updated MaterialProcessing.jsx and MaterialWarehouse.jsx');
