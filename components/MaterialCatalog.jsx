'use client';

import React, { useState, useEffect } from 'react';
import { 
    Edit3, Trash2, Plus, Save
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DEFAULT_CATEGORIES } from './MaterialOrder';

export default function MaterialCatalog({ projects, showToast }) {
    const [configProjectName, setConfigProjectName] = useState(projects[0]?.name || '');
    const [allTemplates, setAllTemplates] = useState({});
    
    // Always edit state
    const [categories, setCategories] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadTemplatesFromDb = async () => {
        setIsLoading(true);
        try {
            let data = [];
            try {
                const res = await supabase.from('material_templates').select('project_name, data');
                if (res.error) throw res.error;
                data = res.data || [];
            } catch (err) {
                console.warn("Could not load material_templates", err);
            }
            const templatesMap = {};
            if (data) {
                data.forEach(row => {
                    templatesMap[row.project_name] = row.data;
                });
            }
            setAllTemplates(templatesMap);
            
            if (projects && projects.length > 0) {
                const projName = configProjectName || projects[0]?.name || '';
                handleProjectChange(projName, templatesMap);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadTemplatesFromDb();
    }, [projects]);

    const handleProjectChange = (proj, tMap = allTemplates) => {
        setConfigProjectName(proj);
        const data = tMap[proj] || {};
        if (data.versions && data.versions.length > 0) {
            // Pick the latest version's categories to edit
            const activeVer = data.versions[data.versions.length - 1];
            setCategories(JSON.parse(JSON.stringify(activeVer.categories)));
        } else {
            setCategories(JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)));
        }
    };

    const handleSave = async () => {
        if (!configProjectName) return;
        
        // Save as single version to not break MaterialOrder and other backward compatibility
        const today = new Date().toISOString().split('T')[0];
        const newData = {
            activeVersionId: 'default',
            versions: [
                {
                    id: 'default',
                    name: 'Đơn giá mặc định',
                    date: today,
                    categories: categories
                }
            ]
        };

        try {
            const { error } = await supabase
                .from('material_templates')
                .upsert({ project_name: configProjectName, data: newData }, { onConflict: 'project_name' });

            if (error) throw error;
            
            setAllTemplates(prev => ({ ...prev, [configProjectName]: newData }));
            showToast('Đã lưu cấu hình vật tư thành công!');
        } catch (err) {
            console.error(err);
            showToast('Lỗi khi lưu: ' + err.message, 'error');
        }
    };

    if (isLoading) {
        return <div className="p-8 text-center text-slate-500">Đang tải...</div>;
    }

    return (
        <div className="w-full animate-in fade-in duration-500 pb-16">
            <header className="mb-8 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <div className="bg-blue-600 p-2.5 rounded-2xl text-white shadow-lg shadow-blue-600/25">
                            <Edit3 size={22} />
                        </div>
                        <span>Vật tư order</span>
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Định nghĩa danh mục mã vật tư chuẩn cho từng công trình.</p>
                </div>
            </header>

            <div className="bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden mt-6">
                <div className="p-6 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex-1 w-full">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Công trình đang cấu hình:</label>
                        <select
                            value={configProjectName}
                            onChange={(e) => handleProjectChange(e.target.value)}
                            className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-bold outline-none focus:border-blue-500 transition cursor-pointer"
                        >
                            {projects.map(p => (
                                <option key={p.name} value={p.name}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-end mt-2 md:mt-0">
                        <button onClick={handleSave} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition flex items-center gap-2 shadow-lg shadow-blue-600/20 whitespace-nowrap h-[52px]">
                            <Save size={20} /> Lưu cấu hình
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-6 bg-white">
                    {categories.map((cat, catIdx) => (
                        <div key={catIdx} className="border-2 border-slate-200 rounded-2xl overflow-hidden group">
                            <div className="bg-slate-100 p-3 border-b-2 border-slate-200 flex items-center justify-between">
                                <input
                                    type="text"
                                    value={cat.name || ''}
                                    onChange={(e) => {
                                        const updated = [...categories];
                                        updated[catIdx].name = e.target.value;
                                        setCategories(updated);
                                    }}
                                    className="font-bold text-blue-900 outline-none w-1/2 rounded px-2 py-1 border-b border-blue-300 focus:ring-2 focus:ring-blue-500 bg-white"
                                    placeholder="Tên hạng mục..."
                                />
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        if (categories.length <= 1) {
                                            showToast('Cần ít nhất một hạng mục!', 'error');
                                            return;
                                        }
                                        const updated = [...categories];
                                        updated.splice(catIdx, 1);
                                        setCategories(updated);
                                    }}
                                    className="text-red-500 hover:bg-red-200 p-1.5 rounded transition"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                            
                            <div className="p-0 overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-3 font-bold w-12 text-center">STT</th>
                                            <th className="px-4 py-3 font-bold w-1/3">Tên vật tư</th>
                                            <th className="px-4 py-3 font-bold w-32">Mã màu</th>
                                            <th className="px-4 py-3 font-bold w-24 text-center">ĐVT</th>
                                            <th className="px-4 py-3 font-bold w-32 text-center">Định mức</th>
                                            <th className="px-4 py-3 font-bold w-16 text-center">Xóa</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {cat.items && cat.items.map((item, itemIdx) => (
                                            <tr key={itemIdx} className="hover:bg-blue-50/30 transition">
                                                <td className="px-4 py-2 text-center text-slate-400 font-medium">
                                                    {itemIdx + 1}
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input 
                                                        type="text" 
                                                        value={item.name || ''}
                                                        onChange={(e) => {
                                                            const updated = [...categories];
                                                            updated[catIdx].items[itemIdx].name = e.target.value;
                                                            setCategories(updated);
                                                        }}
                                                        placeholder="Nhập tên vật tư..."
                                                        className="w-full p-2 bg-transparent border-b border-slate-200 focus:border-blue-500 outline-none font-medium text-slate-700"
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input 
                                                        type="text" 
                                                        value={item.colorCode || ''}
                                                        onChange={(e) => {
                                                            const updated = [...categories];
                                                            updated[catIdx].items[itemIdx].colorCode = e.target.value;
                                                            setCategories(updated);
                                                        }}
                                                        placeholder="VD: TRẮNG"
                                                        className="w-full p-2 bg-transparent border-b border-slate-200 focus:border-blue-500 outline-none text-slate-600"
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <select
                                                        value={item.unit || ''}
                                                        onChange={(e) => {
                                                            const updated = [...categories];
                                                            updated[catIdx].items[itemIdx].unit = e.target.value;
                                                            setCategories(updated);
                                                        }}
                                                        className="w-full p-2 bg-transparent border-b border-slate-200 focus:border-blue-500 outline-none text-center text-slate-600 font-bold cursor-pointer hover:bg-slate-50 transition"
                                                    >
                                                        <option value="">Trống</option>
                                                        <option value="Bao/40kg">Bao/40kg</option>
                                                        <option value="Thùng/18l">Thùng/18l</option>
                                                        <option value="Thùng/25kg">Thùng/25kg</option>
                                                        <option value="Bao/20kg">Bao/20kg</option>
                                                        <option value="Thùng/5l">Thùng/5l</option>
                                                        <option value="Thùng/5kg">Thùng/5kg</option>
                                                        <option value="kg">kg</option>
                                                        <option value="lít">lít</option>
                                                        <option value="cái">cái</option>
                                                        <option value="cuộn">cuộn</option>
                                                        <option value="m2">m2</option>
                                                        <option value="bộ">bộ</option>
                                                    </select>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input 
                                                        type="text" 
                                                        value={item.quantity || ''}
                                                        onChange={(e) => {
                                                            const updated = [...categories];
                                                            updated[catIdx].items[itemIdx].quantity = e.target.value;
                                                            setCategories(updated);
                                                        }}
                                                        placeholder="Định mức"
                                                        className="w-full p-2 bg-transparent border-b border-slate-200 focus:border-blue-500 outline-none text-center font-bold text-blue-600"
                                                    />
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    <button 
                                                        type="button"
                                                        onClick={() => {
                                                            const updated = [...categories];
                                                            updated[catIdx].items.splice(itemIdx, 1);
                                                            setCategories(updated);
                                                        }}
                                                        className="text-slate-300 hover:text-red-500 p-1.5 rounded transition"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="p-3 bg-slate-50 border-t border-slate-200">
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            const updated = [...categories];
                                            if (!updated[catIdx].items) updated[catIdx].items = [];
                                            updated[catIdx].items.push({ stt: updated[catIdx].items.length + 1, name: '', unit: '', quantity: '', colorCode: '' });
                                            setCategories(updated);
                                        }}
                                        className="text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition"
                                    >
                                        <Plus size={16} /> Thêm vật tư
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    
                    <button 
                        type="button" 
                        onClick={() => {
                            const updated = [...categories];
                            updated.push({ name: 'Hạng mục mới', items: [{ stt: 1, name: '', unit: '', quantity: '', colorCode: '' }] });
                            setCategories(updated);
                        }}
                        className="mt-6 text-sm font-bold text-slate-600 hover:text-slate-800 border-2 border-dashed border-slate-300 w-full py-4 rounded-xl hover:border-slate-400 hover:bg-slate-50 transition flex items-center justify-center gap-2"
                    >
                        <Plus size={20} /> Thêm Hạng Mục Mới
                    </button>
                </div>
            </div>
        </div>
    );
}
