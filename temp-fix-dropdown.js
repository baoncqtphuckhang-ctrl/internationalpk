const fs = require('fs');
const file = 'd:/0. WORKING/CODE WEB/01. INTERNATIONAL PK/internationalpk/components/MaterialCatalog.jsx';
let content = fs.readFileSync(file, 'utf8');

const oldCode = `                            <select
                                value={configProjectName}
                                onChange={(e) => handleProjectChange(e.target.value)}
                                className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-bold outline-none focus:border-blue-500 transition"
                            >
                                {projects.map(p => (
                                    <option key={p.name} value={p.name}>{p.name}</option>
                                ))}
                            </select>`;

const newCode = `                            <div className="flex items-center gap-2">
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

content = content.replace(oldCode, newCode);
fs.writeFileSync(file, content);
console.log('done fixing dropdown');
