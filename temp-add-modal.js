const fs = require('fs');
const file = 'components/MaterialProcessing.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add state for previewOrder
if (!content.includes('const [previewOrder, setPreviewOrder] = useState(null);')) {
    content = content.replace(
        "const [activeTab, setActiveTab] = useState('Chờ xử lý'); // 'Chờ xử lý', 'Phê duyệt', 'Đã đặt', 'Từ chối'",
        "const [activeTab, setActiveTab] = useState('Chờ xử lý'); // 'Chờ xử lý', 'Phê duyệt', 'Đã đặt', 'Từ chối'\n    const [previewOrder, setPreviewOrder] = useState(null);"
    );
}

// 2. Change onClick back to setPreviewOrder instead of onNavigateToDetail
const oldClick = "onClick={() => onNavigateToDetail && onNavigateToDetail(order)}";
const newClick = "onClick={() => setPreviewOrder(order)}";
content = content.replace(oldClick, newClick);

// 3. Add modal JSX right before the closing </div> of the component
const modalJSX = `
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
                            <button onClick={() => setPreviewOrder(null)} className="px-6 py-2.5 rounded-xl font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition">Đóng</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
`;

if (!content.includes('PREVIEW MODAL')) {
    content = content.replace(/<\/div>\s*<div className="mt-8">/g, '</div>\n\n<div className="mt-8">');
    // Just find the last </div>\n    );\n}
    content = content.replace(/<\/div>\s*\);\s*}\s*$/g, modalJSX);
}

fs.writeFileSync(file, content, 'utf8');
console.log("Added modal to MaterialProcessing.jsx");
