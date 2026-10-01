const fs = require('fs');
const file = 'd:/0. WORKING/CODE WEB/01. INTERNATIONAL PK/internationalpk/components/MaterialCatalog.jsx';
let content = fs.readFileSync(file, 'utf8');

// Fix dropdown mapping
content = content.replace(
  '{projects.map(p => (',
  '{projects.filter(p => allTemplates[p.name]).map(p => ('
);

const oldSelect = `                            <select
                                value={configProjectName}
                                onChange={(e) => handleProjectChange(e.target.value)}
                                className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-bold outline-none focus:border-blue-500 transition"
                            >
                                {projects.filter(p => allTemplates[p.name]).map(p => (
                                    <option key={p.name} value={p.name}>{p.name}</option>
                                ))}
                            </select>`;
const newSelect = `                            <div className="flex items-center gap-2">
                                <select
                                    value={configProjectName}
                                    onChange={(e) => handleProjectChange(e.target.value)}
                                    className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-bold outline-none focus:border-blue-500 transition"
                                >
                                    {projects.filter(p => allTemplates[p.name]).map(p => (
                                        <option key={p.name} value={p.name}>{p.name}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => { setShowCreateModal(true); setNewProjectName(''); }}
                                    className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold whitespace-nowrap transition shadow-sm h-[52px]"
                                >
                                    + Tạo mới
                                </button>
                            </div>`;
                            
content = content.replace(oldSelect, newSelect);

// Remove the "Đơn giá" header column
const oldHeader = `<div className="w-32 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Đơn giá</div>`;
content = content.replace(oldHeader, '');

// Remove the input for Đơn giá
const oldInput = `<input 
                                                                type="text"
                                                                value={item.price ? Number(item.price).toLocaleString('vi-VN') : ''}
                                                                readOnly={!isEditing}
                                                                onChange={(e) => {
                                                                    const val = e.target.value.replace(/\\D/g, '');
                                                                    const updated = [...editingCategories];
                                                                    updated[catIdx].items[itemIdx].price = val;
                                                                    setEditingCategories(updated);
                                                                }}
                                                                placeholder="Đơn giá"
                                                                className={\`w-32 p-2 bg-slate-50 border rounded-lg text-sm text-right font-medium outline-none \${!isEditing ? 'border-transparent text-slate-600 bg-transparent' : 'border-slate-200 focus:border-blue-500 bg-white'}\`}
                                                            />`;
                                                            
// But wait, what if the formatting is different?
// Let's use a regex to remove the input block.
const rx = /<input[^>]+placeholder="Đơn giá"[^>]*\/>/g;
content = content.replace(rx, '');

fs.writeFileSync(file, content);
console.log('done modifying');
