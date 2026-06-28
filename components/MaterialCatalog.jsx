'use client';

import React, { useState, useEffect } from 'react';
import { 
    Edit3, X, Download, Copy, Trash2, Plus, Save, Edit2
} from 'lucide-react';
import { formatDateVN } from '@/lib/utils';
import CurrencyInput from './CurrencyInput';
import { DEFAULT_CATEGORIES, getProjectMaterialTemplateData } from './MaterialOrder';

export default function MaterialCatalog({ projects, showToast }) {
    const [configProjectName, setConfigProjectName] = useState(projects[0]?.name || '');
    const [configVersions, setConfigVersions] = useState([]);
    const [configActiveVersionId, setConfigActiveVersionId] = useState(null);
    
    // Edit state
    const [editingVersionId, setEditingVersionId] = useState(null);
    const [editingCategories, setEditingCategories] = useState([]);
    const [editingDate, setEditingDate] = useState('');

    const [copyModal, setCopyModal] = useState({ isOpen: false, targetVersionId: null });
    const [copyFromProject, setCopyFromProject] = useState('');
    const [copyFromVersion, setCopyFromVersion] = useState('');
    const [copyAvailableVersions, setCopyAvailableVersions] = useState([]);

    // Initialize with first project
    useEffect(() => {
        if (projects && projects.length > 0 && !configProjectName) {
            handleProjectChange(projects[0].name);
        } else if (configProjectName) {
            handleProjectChange(configProjectName);
        }
    }, [projects]);

    const handleProjectChange = (proj) => {
        setConfigProjectName(proj);
        const data = getProjectMaterialTemplateData(proj);
        if (data.versions && data.versions.length > 0) {
            setConfigVersions(data.versions);
            const activeId = data.activeVersionId || data.versions[data.versions.length - 1].id;
            setConfigActiveVersionId(activeId);
        } else {
            const today = new Date().toISOString().split('T')[0];
            const newId = Date.now().toString();
            const defaultCats = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
            const newVers = [{ id: newId, date: today, categories: defaultCats, name: 'Đơn giá lần 1' }];
            setConfigVersions(newVers);
            setConfigActiveVersionId(newId);
        }
        setEditingVersionId(null);
    };

    const handleGlobalSave = (updatedVersions, newActiveId) => {
        if (!configProjectName) return;
        try {
            const projectTemplates = JSON.parse(localStorage.getItem('misa_project_material_templates') || '{}');
            projectTemplates[configProjectName] = {
                versions: updatedVersions,
                activeVersionId: newActiveId
            };
            localStorage.setItem('misa_project_material_templates', JSON.stringify(projectTemplates));
            setConfigVersions(updatedVersions);
            setConfigActiveVersionId(newActiveId);
        } catch (err) {
            console.error("Error saving project material template:", err);
            showToast('Lỗi khi lưu cấu hình!', 'error');
        }
    };

    const handleAddVersion = () => {
        if (editingVersionId) {
            showToast('Vui lòng lưu đợt giá đang sửa trước khi thêm mới!', 'error');
            return;
        }
        const newId = Date.now().toString();
        const today = new Date().toISOString().split('T')[0];
        const defaultCats = configVersions.length > 0 
            ? JSON.parse(JSON.stringify(configVersions[configVersions.length - 1].categories))
            : JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
        
        const newName = `Đơn giá lần ${configVersions.length + 1}`;
        const newVer = { id: newId, date: today, categories: defaultCats, name: newName };
        
        const updated = [...configVersions, newVer];
        handleGlobalSave(updated, configActiveVersionId);
        
        // Auto start editing the new one
        startEditing(newVer);
    };

    const handleDeleteVersion = (id) => {
        if (configVersions.length <= 1) {
            showToast('Không thể xóa đợt giá duy nhất!', 'error');
            return;
        }
        if (!window.confirm('Bạn có chắc chắn muốn xóa đợt giá này?')) return;
        const updated = configVersions.filter(v => v.id !== id);
        
        // Re-number names
        updated.forEach((v, idx) => {
            v.name = `Đơn giá lần ${idx + 1}`;
        });
        
        let newActive = configActiveVersionId;
        if (configActiveVersionId === id) {
            newActive = updated[updated.length - 1].id;
        }
        handleGlobalSave(updated, newActive);
        if (editingVersionId === id) setEditingVersionId(null);
    };

    const startEditing = (version) => {
        setEditingVersionId(version.id);
        setEditingCategories(JSON.parse(JSON.stringify(version.categories)));
        setEditingDate(version.date);
    };

    const saveEditing = () => {
        const updated = configVersions.map(v => 
            v.id === editingVersionId ? { ...v, date: editingDate, categories: editingCategories } : v
        );
        handleGlobalSave(updated, configActiveVersionId);
        setEditingVersionId(null);
        showToast('Đã lưu thông tin đợt giá!');
    };

    const cancelEditing = () => {
        setEditingVersionId(null);
    };
    
    const handleActiveVersionChange = (e) => {
        const newId = e.target.value;
        handleGlobalSave(configVersions, newId);
        showToast('Đã cập nhật đợt giá mặc định cho order!');
    };

    return (
        <div className="max-w-6xl mx-auto animate-in fade-in duration-500 pb-16">
            <header className="mb-8 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <div className="bg-blue-600 p-2.5 rounded-2xl text-white shadow-lg shadow-blue-600/25">
                            <Edit3 size={22} />
                        </div>
                        <span>Danh Mục Vật Tư</span>
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Định nghĩa danh mục và đơn giá vật tư chuẩn theo từng đợt cho từng công trình.</p>
                </div>
            </header>

            <div className="bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden mt-6">
                <div className="p-6 bg-slate-50 border-b border-slate-200">
                    <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex-1">
                            <label className="block text-sm font-bold text-slate-700 mb-2">Công trình đang cấu hình:</label>
                            <select
                                value={configProjectName}
                                onChange={(e) => handleProjectChange(e.target.value)}
                                className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-bold outline-none focus:border-blue-500 transition"
                            >
                                {projects.map(p => (
                                    <option key={p.name} value={p.name}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-bold text-slate-700 mb-2">Đơn giá mặc định khi lập Order mới:</label>
                            <select 
                                value={configActiveVersionId || ''}
                                onChange={handleActiveVersionChange}
                                className="w-full p-3 bg-indigo-50 border-2 border-indigo-200 rounded-xl font-bold text-indigo-700 outline-none focus:border-indigo-500 transition"
                            >
                                {configVersions.map(v => (
                                    <option key={v.id} value={v.id}>{v.name} (Áp dụng từ {formatDateVN(v.date)})</option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-500 mt-2">Đơn giá này sẽ được tự động chọn khi bạn tạo một Đơn đặt vật tư mới.</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-10 bg-slate-100/50">
                    {configVersions.map((version, vIdx) => {
                        const isEditing = editingVersionId === version.id;
                        const categories = isEditing ? editingCategories : version.categories;
                        const date = isEditing ? editingDate : version.date;

                        return (
                            <div key={version.id} className={`bg-white rounded-2xl shadow-sm border ${isEditing ? 'border-blue-400 shadow-blue-500/10' : 'border-slate-200'} overflow-hidden transition-all duration-300`}>
                                <div className={`p-4 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 ${isEditing ? 'bg-blue-50/50 border-blue-100' : 'bg-slate-50 border-slate-200'}`}>
                                    <div className="flex items-center gap-4 flex-wrap">
                                        <h3 className="text-lg font-black text-slate-800">{version.name || `Đơn giá lần ${vIdx + 1}`}</h3>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-slate-500">Ngày áp dụng:</span>
                                            <input 
                                                type="date" 
                                                disabled={!isEditing}
                                                value={date || ''}
                                                onChange={(e) => setEditingDate(e.target.value)}
                                                className={`p-2 rounded-lg font-bold outline-none transition ${isEditing ? 'bg-white border-2 border-blue-200 focus:border-blue-500' : 'bg-transparent border-transparent text-slate-700'}`}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {isEditing ? (
                                            <>
                                                <button onClick={saveEditing} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition flex items-center gap-2 shadow-lg shadow-blue-600/20">
                                                    <Save size={16} /> Lưu đợt giá
                                                </button>
                                                <button onClick={cancelEditing} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition flex items-center gap-2">
                                                    <X size={16} /> Hủy sửa
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button 
                                                    disabled={editingVersionId !== null} 
                                                    onClick={() => startEditing(version)} 
                                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <Edit2 size={16} /> Chỉnh sửa
                                                </button>
                                                <button 
                                                    disabled={editingVersionId !== null} 
                                                    onClick={() => setCopyModal({ isOpen: true, targetVersionId: version.id })}
                                                    className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold transition flex items-center gap-2 border border-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <Copy size={16} /> Chép từ nơi khác
                                                </button>
                                                <button 
                                                    disabled={editingVersionId !== null} 
                                                    onClick={() => handleDeleteVersion(version.id)}
                                                    className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl font-bold transition flex items-center gap-2 border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <Trash2 size={16} /> Xóa
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                
                                <div className={`p-4 space-y-4 transition-all duration-300 ${!isEditing ? 'opacity-70' : ''}`}>
                                    {categories.map((cat, catIdx) => (
                                        <div key={catIdx} className="border-2 border-slate-200 rounded-2xl overflow-hidden group">
                                            <div className="bg-slate-100 p-3 border-b-2 border-slate-200 flex items-center justify-between">
                                                <input
                                                    type="text"
                                                    disabled={!isEditing}
                                                    value={cat.name}
                                                    onChange={(e) => {
                                                        const updated = [...categories];
                                                        updated[catIdx].name = e.target.value;
                                                        setEditingCategories(updated);
                                                    }}
                                                    className={`font-bold text-blue-900 bg-transparent outline-none w-1/2 rounded px-2 ${!isEditing ? 'border-none' : 'border-b border-blue-300 focus:ring-2 focus:ring-blue-500 bg-white'}`}
                                                    placeholder="Tên hạng mục..."
                                                />
                                                {isEditing && (
                                                    <button 
                                                        type="button" 
                                                        onClick={() => {
                                                            if (categories.length <= 1) return;
                                                            const updated = [...categories];
                                                            updated.splice(catIdx, 1);
                                                            setEditingCategories(updated);
                                                        }}
                                                        className="text-red-500 hover:bg-red-200 p-1.5 rounded transition"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="p-4 bg-white">
                                                <div className="space-y-2 mb-3">
                                                    {cat.items.map((item, itemIdx) => (
                                                        <div key={itemIdx} className="flex gap-2 items-center">
                                                            <span className="w-8 text-center text-xs font-bold text-slate-400">{itemIdx + 1}</span>
                                                            <input 
                                                                type="text" 
                                                                disabled={!isEditing}
                                                                value={item.name}
                                                                onChange={(e) => {
                                                                    const updated = [...categories];
                                                                    updated[catIdx].items[itemIdx].name = e.target.value;
                                                                    setEditingCategories(updated);
                                                                }}
                                                                placeholder="Tên vật tư / chủng loại"
                                                                className={`flex-1 p-2 bg-slate-50 border rounded-lg text-sm font-medium outline-none ${!isEditing ? 'border-transparent text-slate-600 bg-transparent' : 'border-slate-200 focus:border-blue-500 bg-white'}`}
                                                            />
                                                            <input 
                                                                type="text" 
                                                                disabled={!isEditing}
                                                                value={item.colorCode || ''}
                                                                onChange={(e) => {
                                                                    const updated = [...categories];
                                                                    updated[catIdx].items[itemIdx].colorCode = e.target.value;
                                                                    setEditingCategories(updated);
                                                                }}
                                                                placeholder="Mã màu"
                                                                className={`w-24 p-2 bg-slate-50 border rounded-lg text-sm text-center font-medium outline-none ${!isEditing ? 'border-transparent text-slate-600 bg-transparent' : 'border-slate-200 focus:border-blue-500 bg-white'}`}
                                                            />
                                                            <input 
                                                                type="text" 
                                                                disabled={!isEditing}
                                                                value={item.unit}
                                                                onChange={(e) => {
                                                                    const updated = [...categories];
                                                                    updated[catIdx].items[itemIdx].unit = e.target.value;
                                                                    setEditingCategories(updated);
                                                                }}
                                                                placeholder="ĐVT"
                                                                className={`w-24 p-2 bg-slate-50 border rounded-lg text-sm text-center font-medium outline-none ${!isEditing ? 'border-transparent text-slate-600 bg-transparent' : 'border-slate-200 focus:border-blue-500 bg-white'}`}
                                                            />
                                                            <CurrencyInput 
                                                                disabled={!isEditing}
                                                                value={item.price || 0}
                                                                onChange={(val) => {
                                                                    const updated = [...categories];
                                                                    updated[catIdx].items[itemIdx].price = val;
                                                                    setEditingCategories(updated);
                                                                }}
                                                                placeholder="Đơn giá"
                                                                className={`w-32 p-2 bg-slate-50 border rounded-lg text-sm text-right font-medium outline-none ${!isEditing ? 'border-transparent text-slate-600 bg-transparent' : 'border-slate-200 focus:border-blue-500 bg-white'}`}
                                                            />
                                                            {isEditing && (
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => {
                                                                        const updated = [...categories];
                                                                        updated[catIdx].items.splice(itemIdx, 1);
                                                                        updated[catIdx].items.forEach((it, idx) => it.stt = idx + 1);
                                                                        setEditingCategories(updated);
                                                                    }}
                                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                                {isEditing && (
                                                    <button 
                                                        type="button" 
                                                        onClick={() => {
                                                            const updated = [...categories];
                                                            updated[catIdx].items.push({ stt: updated[catIdx].items.length + 1, name: '', unit: '', quantity: '', price: '', colorCode: '' });
                                                            setEditingCategories(updated);
                                                        }}
                                                        className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                                    >
                                                        <Plus size={14} /> Thêm vật tư
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    
                                    {isEditing && (
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                const updated = [...categories];
                                                updated.push({ name: 'Hạng mục mới', items: [{ stt: 1, name: '', unit: '', quantity: '', price: '', colorCode: '' }] });
                                                setEditingCategories(updated);
                                            }}
                                            className="mt-6 text-sm font-bold text-slate-600 hover:text-slate-800 border-2 border-dashed border-slate-300 w-full py-3 rounded-xl hover:border-slate-400 transition flex items-center justify-center gap-2 bg-slate-50"
                                        >
                                            <Plus size={16} /> Thêm Hạng Mục Mới
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    <button 
                        disabled={editingVersionId !== null}
                        onClick={handleAddVersion}
                        className="w-full py-6 border-2 border-dashed border-blue-300 rounded-3xl text-blue-600 font-bold hover:bg-blue-50 transition flex flex-col items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    >
                        <div className="bg-blue-100 p-3 rounded-full"><Plus size={24} /></div>
                        Tạo đơn giá mới
                    </button>
                </div>
            </div>

            {copyModal.isOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
                        <div className="bg-indigo-600 p-5 flex justify-between items-center text-white">
                            <h3 className="font-bold text-lg flex items-center gap-2"><Download size={20} /> Chép từ nơi khác</h3>
                            <button onClick={() => setCopyModal({ isOpen: false, targetVersionId: null })} className="p-1 hover:bg-white/20 rounded-full transition"><X size={20} /></button>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-slate-600 mb-4">Chọn công trình để sao chép danh mục vật tư:</p>
                            <select 
                                value={copyFromProject}
                                onChange={(e) => {
                                    const proj = e.target.value;
                                    setCopyFromProject(proj);
                                    if (proj) {
                                        const data = getProjectMaterialTemplateData(proj);
                                        setCopyAvailableVersions(data.versions || []);
                                        if (data.versions && data.versions.length > 0) {
                                            setCopyFromVersion(data.versions[data.versions.length - 1].id);
                                        }
                                    } else {
                                        setCopyAvailableVersions([]);
                                        setCopyFromVersion('');
                                    }
                                }}
                                className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-medium mb-4"
                            >
                                <option value="">-- Chọn công trình --</option>
                                {projects.map(p => (
                                    <option key={p.name} value={p.name}>{p.name}</option>
                                ))}
                            </select>

                            {copyAvailableVersions.length > 0 && (
                                <>
                                    <p className="text-sm text-slate-600 mb-2">Chọn đợt giá cụ thể:</p>
                                    <select 
                                        value={copyFromVersion}
                                        onChange={(e) => setCopyFromVersion(e.target.value)}
                                        className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-medium mb-6"
                                    >
                                        {copyAvailableVersions.map(v => (
                                            <option key={v.id} value={v.id}>{v.name || 'Đợt giá'} (Áp dụng từ {formatDateVN(v.date)})</option>
                                        ))}
                                    </select>
                                </>
                            )}
                            
                            <div className="flex justify-end gap-3 mt-4">
                                <button onClick={() => setCopyModal({ isOpen: false, targetVersionId: null })} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition">Hủy</button>
                                <button 
                                    onClick={() => {
                                        if (!copyFromProject || !copyFromVersion) return;
                                        const verToCopy = copyAvailableVersions.find(v => v.id === copyFromVersion);
                                        if (verToCopy) {
                                            const updated = configVersions.map(v => 
                                                v.id === copyModal.targetVersionId ? { ...v, categories: JSON.parse(JSON.stringify(verToCopy.categories)) } : v
                                            );
                                            handleGlobalSave(updated, configActiveVersionId);
                                            setCopyModal({ isOpen: false, targetVersionId: null });
                                            showToast(`Đã chép danh mục từ ${copyFromProject}!`);
                                        }
                                    }}
                                    disabled={!copyFromProject || !copyFromVersion}
                                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >Xác nhận chép</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
