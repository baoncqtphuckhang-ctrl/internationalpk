const fs = require('fs');
let c = fs.readFileSync('components/MaterialOrderManager.jsx', 'utf8');

const target1 = `                                                                        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
                                                                            <table className="w-full text-xs text-left min-w-[500px] md:min-w-[700px]">
                                                                                <thead className="bg-slate-50 text-slate-500 uppercase font-black border-b border-slate-200">
                                                                                    <tr>
                                                                                        <th className="px-3 py-3">Vật tư & ĐVT</th>
                                                                                        <th className="px-3 py-3 text-center">SL (Tổng/Về/Thiếu)</th>
                                                                                        <th className="px-3 py-3 bg-blue-50/50 w-28">Ngày Về</th>
                                                                                        <th className="px-3 py-3 bg-blue-50/50 text-center w-20">SL Nhập</th>
                                                                                        <th className="px-3 py-3 bg-blue-50/50">Ghi chú</th>
                                                                                        <th className="px-3 py-3 bg-blue-50/50 w-12"></th>
                                                                                    </tr>
                                                                                </thead>`;

const replace1 = `                                                                        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
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
                                                                                </thead>`;

const target2 = `                                                                    <React.Fragment key={itemIdx}>
                                                                        <tr className="hover:bg-slate-50/50 transition">
                                                                            <td 
                                                                                className={\`px-3 py-3 font-bold text-slate-700 transition \${receivedHistory.length > 0 ? 'cursor-pointer hover:text-indigo-600' : ''}\`}
                                                                                onClick={() => receivedHistory.length > 0 && toggleItemExpansion(\`\${order.id}_\${catIdx}_\${itemIdx}\`)}
                                                                                title={receivedHistory.length > 0 ? "Nhấn để xem các đợt nhận hàng" : ""}
                                                                            >
                                                                                <div className="flex flex-col gap-1">
                                                                                    <div>
                                                                                        {item.name} <span className="text-slate-400 font-normal">{item.colorCode || item.color_code ? \`(\${item.colorCode || item.color_code})\` : ''}</span>
                                                                                    </div>
                                                                                    <div className="text-slate-500 text-[10px] uppercase">{item.unit}</div>
                                                                                    {receivedHistory.length > 0 && (
                                                                                        <div className="mt-1 inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded w-max">
                                                                                            {expandedItems[\`\${order.id}_\${catIdx}_\${itemIdx}\`] ? 'Ẩn đợt nhận' : \`Xem \${receivedHistory.length} đợt\`}
                                                                                            {expandedItems[\`\${order.id}_\${catIdx}_\${itemIdx}\`] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-3 py-3 text-center text-[10px] leading-relaxed">
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
                                                                                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-500 font-mono text-xs"
                                                                                        value={itemInputData.date || ''}
                                                                                        onChange={(e) => setReceiveData(prev => ({...prev, [inputKey]: { ...prev[inputKey], date: e.target.value }}))}
                                                                                    />
                                                                                ) : (
                                                                                    <span className="text-[10px] text-green-600 font-bold bg-green-50 px-2 py-1 rounded">Đã giao đủ</span>
                                                                                )}
                                                                            </td>
                                                                            <td className="px-3 py-2 bg-blue-50/20 text-center">
                                                                                {remaining > 0 && (
                                                                                    <input 
                                                                                        type="number"
                                                                                        min="0"
                                                                                        max={remaining}
                                                                                        step="any"
                                                                                        placeholder="Số lượng"
                                                                                        className="w-16 md:w-24 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-center outline-none focus:border-blue-500 font-bold text-slate-700 text-xs"
                                                                                        value={itemInputData.qty || ''}
                                                                                        onChange={(e) => setReceiveData(prev => ({...prev, [inputKey]: { ...prev[inputKey], qty: e.target.value }}))}
                                                                                    />
                                                                                )}
                                                                            </td>
                                                                            <td className="px-3 py-2 bg-blue-50/20">
                                                                                {remaining > 0 && (
                                                                                    <input 
                                                                                        type="text"
                                                                                        placeholder="Ghi chú (tùy chọn)..."
                                                                                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-500 text-xs"
                                                                                        value={itemInputData.note || ''}
                                                                                        onChange={(e) => setReceiveData(prev => ({...prev, [inputKey]: { ...prev[inputKey], note: e.target.value }}))}
                                                                                    />
                                                                                )}
                                                                            </td>
                                                                            <td className="px-3 py-2 bg-blue-50/20 text-center">
                                                                                {remaining > 0 && (
                                                                                    <button 
                                                                                        onClick={() => handleReceiveItem(order.id, catIdx, itemIdx, remaining)}
                                                                                        disabled={!itemInputData.date || !itemInputData.qty || parseFloat(itemInputData.qty) <= 0 || parseFloat(itemInputData.qty) > remaining}
                                                                                        className="bg-blue-600 text-white p-1.5 rounded-lg hover:bg-blue-700 disabled:bg-slate-300 transition shadow-sm"
                                                                                        title="Lưu đợt nhập hàng"
                                                                                    >
                                                                                        <Save size={14} />
                                                                                    </button>
                                                                                )}
                                                                            </td>
                                                                        </tr>`;

const replace2 = `                                                                    <React.Fragment key={itemIdx}>
                                                                        <tr className="hover:bg-slate-50/50 transition border-b border-slate-100 last:border-0">
                                                                            <td 
                                                                                className={\`px-4 py-3 text-sm font-bold text-slate-700 transition \${receivedHistory.length > 0 ? 'cursor-pointer hover:text-indigo-600' : ''}\`}
                                                                                onClick={() => receivedHistory.length > 0 && toggleItemExpansion(\`\${order.id}_\${catIdx}_\${itemIdx}\`)}
                                                                                title={receivedHistory.length > 0 ? "Nhấn để xem các đợt nhận hàng" : ""}
                                                                            >
                                                                                <div className="flex flex-col gap-1">
                                                                                    <div>
                                                                                        {item.name} <span className="text-slate-400 font-normal">{item.colorCode || item.color_code ? \`(\${item.colorCode || item.color_code})\` : ''}</span>
                                                                                    </div>
                                                                                    <div className="text-slate-500 text-xs uppercase md:hidden">{item.unit}</div>
                                                                                    {receivedHistory.length > 0 && (
                                                                                        <div className="mt-1 inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded w-max">
                                                                                            {expandedItems[\`\${order.id}_\${catIdx}_\${itemIdx}\`] ? 'Ẩn đợt nhận' : \`Xem \${receivedHistory.length} đợt\`}
                                                                                            {expandedItems[\`\${order.id}_\${catIdx}_\${itemIdx}\`] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-4 py-3 text-slate-600 text-xs font-mono hidden md:table-cell">{item.unit}</td>
                                                                            <td className="px-4 py-3 text-center font-bold text-slate-700 hidden md:table-cell">{orderQty}</td>
                                                                            <td className="px-4 py-3 text-center font-bold text-sky-600 hidden md:table-cell">{totalReceived}</td>
                                                                            <td className={\`px-4 py-3 text-center font-bold hidden md:table-cell \${statusColor}\`}>{remaining > 0 ? remaining : 0}</td>
                                                                            
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
                                                                            <td className="px-4 py-2 bg-blue-50/20 text-center">
                                                                                {remaining > 0 && (
                                                                                    <button 
                                                                                        onClick={() => handleReceiveItem(order.id, catIdx, itemIdx, remaining)}
                                                                                        disabled={!itemInputData.date || !itemInputData.qty || parseFloat(itemInputData.qty) <= 0 || parseFloat(itemInputData.qty) > remaining}
                                                                                        className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:bg-slate-300 transition shadow-sm"
                                                                                        title="Lưu đợt nhập hàng"
                                                                                    >
                                                                                        <Save size={16} />
                                                                                    </button>
                                                                                )}
                                                                            </td>
                                                                        </tr>`;

c = c.replace(target1, replace1);
c = c.replace(target2, replace2);

// Fix admin delete button
c = c.replace(`{(status === 'Draft' || status === 'Rejected') && (
                                                                        <button 
                                                                            onClick={(e) => handleDeleteOrder(order.id, e, req?.id)}`,
`{(status === 'Draft' || status === 'Rejected' || currentUser?.role === 'ADMIN') && (
                                                                        <button 
                                                                            onClick={(e) => handleDeleteOrder(order.id, e, req?.id)}`);

// Fix CHT double click
c = c.replace(`                                                            onDoubleClick={(e) => {
                                                                e.stopPropagation();
                                                                if (onNavigateToProject) {
                                                                    onNavigateToProject(order.project_name);
                                                                }
                                                            }}`,
`                                                            onDoubleClick={(e) => {
                                                                e.stopPropagation();
                                                                if (currentUser?.role === 'CHT' || currentUser?.role === 'CHỈ HUY TRƯỞNG') return;
                                                                if (onNavigateToProject) {
                                                                    onNavigateToProject(order.project_name);
                                                                }
                                                            }}`);

fs.writeFileSync('components/MaterialOrderManager.jsx', c);
console.log("Done updating MaterialOrderManager.jsx");
