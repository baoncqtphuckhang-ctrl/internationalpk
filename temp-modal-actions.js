const fs = require('fs');
const file = 'components/MaterialProcessing.jsx';
let content = fs.readFileSync(file, 'utf8');

const target = `{/* Actions */}
                        <div className="bg-slate-50 border-t border-slate-200 p-6 flex justify-end gap-3 sticky bottom-0 z-10">
                            <button onClick={() => setPreviewOrder(null)} className="px-6 py-2.5 rounded-xl font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition">Đóng</button>
                        </div>`;

const replacement = `{/* Actions */}
                        <div className="bg-slate-50 border-t border-slate-200 p-6 flex justify-end gap-3 sticky bottom-0 z-10">
                            {getNextActions(getStatus(previewOrder), previewOrder).map(action => (
                                <button
                                    key={action.label}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (action.isEdit && onNavigateToEdit) {
                                            onNavigateToEdit(previewOrder);
                                            setPreviewOrder(null);
                                        } else {
                                            updateStatus(previewOrder.id, action.value);
                                            setPreviewOrder(null);
                                        }
                                    }}
                                    className={\`px-6 py-2.5 rounded-xl font-bold text-white transition shadow-sm \${action.color}\`}
                                >
                                    {action.label} {action.value === 'Chờ xử lý' && '→'}
                                </button>
                            ))}
                            <button onClick={() => setPreviewOrder(null)} className="px-6 py-2.5 rounded-xl font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition">Đóng</button>
                        </div>`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Updated actions in MaterialProcessing.jsx");
} else {
    console.log("Target not found!");
}
