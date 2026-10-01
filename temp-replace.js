const fs = require('fs');
const file = 'd:/0. WORKING/CODE WEB/01. INTERNATIONAL PK/internationalpk/components/MaterialCatalog.jsx';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  'const [copyModal, setCopyModal] = useState({ isOpen: false, targetVersionId: null });',
  'const [copyModal, setCopyModal] = useState({ isOpen: false, targetVersionId: null });\n    const [showCreateModal, setShowCreateModal] = useState(false);\n    const [newProjectName, setNewProjectName] = useState(\'\');'
);

c = c.replace(
  'const projName = configProjectName || projects[0].name;',
  'const configuredProjects = projects.filter(p => templatesMap[p.name]);\n                const projName = configProjectName || (configuredProjects[0]?.name) || \'\';'
);

c = c.replace(
  'const handleGlobalSave = async (updatedVersions, newActiveId) => {',
  'const handleGlobalSave = async (updatedVersions, newActiveId, projectOverride = null) => {\n        const targetProject = projectOverride || configProjectName;\n        if (!targetProject) return;'
);

c = c.replace(
  /if \(\!configProjectName\) return;/g,
  ''
);

c = c.replace(
  /if \(allTemplates\[configProjectName\]\) \{/g,
  'if (allTemplates[targetProject]) {'
);
c = c.replace(
  /\.eq\('project_name', configProjectName\);/g,
  '.eq(\'project_name\', targetProject);'
);
c = c.replace(
  /\.insert\(\{ project_name: configProjectName, data: newData \}\);/g,
  '.insert({ project_name: targetProject, data: newData });'
);
c = c.replace(
  /setAllTemplates\(prev => \(\{ \.\.\.prev, \[configProjectName\]: newData \}\)\);/g,
  'setAllTemplates(prev => ({ ...prev, [targetProject]: newData }));'
);
c = c.replace(
  /updateOrdersAndDNTTOnPriceChange\(configProjectName, newData\);/g,
  'updateOrdersAndDNTTOnPriceChange(targetProject, newData);'
);
c = c.replace(
  /projectTemplates\[configProjectName\] = newData;/g,
  'projectTemplates[targetProject] = newData;'
);
c = c.replace(
  'onChange={(e) => handleProjectChange(e.target.value)}',
  'onChange={(e) => handleProjectChange(e.target.value)}'
);

c = c.replace(
  `                            <label className="block text-sm font-bold text-slate-700 mb-2">Công trình đang cấu hình:</label>
                            <select
                                value={configProjectName}
                                onChange={(e) => handleProjectChange(e.target.value)}
                                className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-bold outline-none focus:border-blue-500 transition"
                            >
                                {projects.map(p => (
                                    <option key={p.name} value={p.name}>{p.name}</option>
                                ))}
                            </select>`,
  `                            <label className="block text-sm font-bold text-slate-700 mb-2">Công trình đang cấu hình:</label>
                            <div className="flex items-center gap-2">
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
                                    className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold whitespace-nowrap transition shadow-sm"
                                >
                                    + Tạo mới
                                </button>
                            </div>`
);

c = c.replace(
  `                </div>
            )}
            <ConfirmModal`,
  `                </div>
            )}

            {showCreateModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
                        <div className="bg-blue-600 p-5 flex justify-between items-center text-white">
                            <h3 className="font-bold text-lg flex items-center gap-2">Tạo danh mục vật tư mới</h3>
                            <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-white/20 rounded-full transition"><X size={20} /></button>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-slate-600 mb-4">Chọn công trình chưa có danh mục vật tư:</p>
                            <select 
                                value={newProjectName}
                                onChange={(e) => setNewProjectName(e.target.value)}
                                className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-blue-500 font-medium mb-6"
                            >
                                <option value="">-- Chọn công trình --</option>
                                {projects.filter(p => !allTemplates[p.name]).map(p => (
                                    <option key={p.name} value={p.name}>{p.name}</option>
                                ))}
                            </select>
                            
                            <div className="flex justify-end gap-3 mt-4">
                                <button onClick={() => setShowCreateModal(false)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition">Hủy</button>
                                <button 
                                    onClick={() => {
                                        if (!newProjectName) {
                                            showToast('Vui lòng chọn công trình!', 'error');
                                            return;
                                        }
                                        const newId = Date.now().toString();
                                        const today = new Date().toISOString().split('T')[0];
                                        const defaultCats = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
                                        const newVer = { id: newId, date: today, categories: defaultCats, name: 'Đơn giá lần 1' };
                                        
                                        handleGlobalSave([newVer], newId, newProjectName);
                                        setShowCreateModal(false);
                                        showToast('Đã tạo danh mục vật tư mới thành công!', 'success');
                                    }}
                                    disabled={!newProjectName}
                                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >Xác nhận tạo</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <ConfirmModal`
);

fs.writeFileSync(file, c);
console.log('done replacing logic');
