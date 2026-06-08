import React, { useState, useEffect, useMemo } from 'react';
import { FileSpreadsheet, Plus, X, Edit2, Trash2, CheckCircle2, Search } from 'lucide-react';
import { formatCurrency, parseVietnameseNumber } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import ConfirmModal from '@/components/ConfirmModal';
export default function ExpectedInvoices({ projects, projectDetails, currentUser, incomes = [], transactions = [] }) {
    const [invoices, setInvoices] = useState([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [isDeleteAllConfirmOpen, setIsDeleteAllConfirmOpen] = useState(false);
    const [activeSubTab, setActiveSubTab] = useState('invoice');
    const [formData, setFormData] = useState({
        projectName: '',
        preTaxValue: '',
        vatAmount: '',
        postTaxValue: '',
        teamValue: '',
        accumulatedAdvance: '',
        teamName: '',
        phase: '',
        note: ''
    });

    const [filterProject, setFilterProject] = useState('');
    const [filterPhase, setFilterPhase] = useState('');
    const [isCustomPhase, setIsCustomPhase] = useState(false);
    const [isCustomTeamName, setIsCustomTeamName] = useState(false);

    const availableTeamNames = useMemo(() => {
        if (!formData.projectName || !transactions || transactions.length === 0) return [];
        const recipients = transactions
            .filter(t => t.project_name === formData.projectName && t.recipient)
            .map(t => t.recipient);
        return [...new Set(recipients)].sort();
    }, [formData.projectName, transactions]);

    const availableFormPhases = useMemo(() => {
        if (!formData.projectName || !incomes || incomes.length === 0) return [];
        const phases = incomes
            .filter(i => i.project_name === formData.projectName && i.phase)
            .map(i => i.phase);
        return [...new Set(phases)].sort();
    }, [formData.projectName, incomes]);

    // Load data from Supabase or localStorage
    useEffect(() => {
        fetchInvoices();
    }, []);

    const fetchInvoices = async () => {
        try {
            const { data, error } = await supabase
                .from('expected_invoices')
                .select('*')
                .order('created_at', { ascending: true });
            
            if (error) throw error;
            if (data && data.length > 0) {
                setInvoices(data);
            } else {
                loadFromLocal();
            }
        } catch (error) {
            console.warn('Supabase fetch failed. Falling back to localStorage.', error);
            loadFromLocal();
        } finally {
            setIsLoaded(true);
        }
    };

    const loadFromLocal = () => {
        const saved = localStorage.getItem('expected_invoices');
        if (saved) {
            try {
                setInvoices(JSON.parse(saved));
            } catch (e) {
                console.error('Error parsing expected invoices', e);
            }
        }
    };

    // Save to localStorage as a fallback backup
    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem('expected_invoices', JSON.stringify(invoices));
        }
    }, [invoices, isLoaded]);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleNumberChange = (e) => {
        const { name, value } = e.target;
        const val = parseVietnameseNumber(value);
        setFormData(prev => {
            const next = { ...prev, [name]: val };
            if (name === 'preTaxValue' || name === 'vatAmount') {
                const preTax = parseFloat(next.preTaxValue) || 0;
                const vat = parseFloat(next.vatAmount) || 0;
                if (preTax > 0 || vat > 0) {
                    next.postTaxValue = preTax + vat;
                }
            }
            return next;
        });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        
        const preTax = parseFloat(formData.preTaxValue) || 0;
        const vat = parseFloat(formData.vatAmount) || 0;
        const postTax = parseFloat(formData.postTaxValue) || 0;
        const teamVal = parseFloat(parseVietnameseNumber(formData.teamValue)) || 0;
        const accAdv = parseFloat(parseVietnameseNumber(formData.accumulatedAdvance)) || 0;

        try {
            if (editingId) {
                const { data, error } = await supabase
                    .from('expected_invoices')
                    .update({
                        projectName: formData.projectName,
                        preTaxValue: preTax,
                        vatAmount: vat,
                        postTaxValue: postTax,
                        teamValue: teamVal,
                        accumulatedAdvance: accAdv,
                        teamName: formData.teamName || '',
                        phase: formData.phase,
                        note: formData.note
                    })
                    .eq('id', editingId)
                    .select();

                if (error) {
                    console.warn('Supabase update failed, updating locally', error);
                }

                setInvoices(prev => prev.map(inv => 
                    inv.id === editingId ? { 
                        ...inv, 
                        projectName: formData.projectName,
                        preTaxValue: preTax,
                        vatAmount: vat,
                        postTaxValue: postTax,
                        teamValue: teamVal,
                        accumulatedAdvance: accAdv,
                        teamName: formData.teamName || '',
                        phase: formData.phase,
                        note: formData.note
                    } : inv
                ));
            } else {
                const newRecord = {
                    projectName: formData.projectName,
                    preTaxValue: preTax,
                    vatAmount: vat,
                    postTaxValue: postTax,
                    teamValue: teamVal,
                    accumulatedAdvance: accAdv,
                    teamName: formData.teamName || '',
                    phase: formData.phase,
                    note: formData.note
                };

                const { data, error } = await supabase
                    .from('expected_invoices')
                    .insert([newRecord])
                    .select();

                if (error) {
                    console.warn('Supabase insert failed, inserting locally', error);
                    setInvoices(prev => [...prev, { id: Date.now().toString(), ...newRecord }]);
                } else if (data && data.length > 0) {
                    setInvoices(prev => [...prev, data[0]]);
                }
            }
            resetForm();
        } catch (error) {
            console.error('Error in handleSave:', error);
            alert('Có lỗi xảy ra khi lưu dữ liệu!');
        }
    };

    const resetForm = () => {
        setIsFormOpen(false);
        setEditingId(null);
        setIsCustomPhase(false);
        setIsCustomTeamName(false);
        setFormData({ projectName: '', preTaxValue: '', vatAmount: '', postTaxValue: '', teamValue: '', accumulatedAdvance: '', teamName: '', phase: '', note: '' });
    };

    const handleEdit = (inv) => {
        setIsCustomPhase(false);
        setIsCustomTeamName(!inv.teamName ? false : true);

        setFormData({
            projectName: inv.projectName,
            preTaxValue: inv.preTaxValue || '',
            vatAmount: inv.vatAmount || '',
            postTaxValue: inv.postTaxValue || '',
            teamValue: inv.teamValue ? inv.teamValue.toLocaleString('en-US') : '',
            accumulatedAdvance: inv.accumulatedAdvance ? inv.accumulatedAdvance.toLocaleString('en-US') : '',
            teamName: inv.teamName || '',
            phase: inv.phase || '',
            note: inv.note || ''
        });
        setEditingId(inv.id);
        setIsFormOpen(true);
    };

    const handleDelete = async (id) => {
        setConfirmDeleteId(id);
    };

    const confirmDelete = async () => {
        if (!confirmDeleteId) return;
        try {
            const { error } = await supabase
                .from('expected_invoices')
                .delete()
                .eq('id', confirmDeleteId);
            
            if (error) {
                console.warn('Supabase delete failed, deleting locally', error);
            }
            setInvoices(prev => prev.filter(inv => inv.id !== confirmDeleteId));
        } catch (error) {
            console.error('Error in handleDelete:', error);
        }
        setConfirmDeleteId(null);
    };

    const handleDeleteAll = () => {
        setIsDeleteAllConfirmOpen(true);
    };

    const confirmDeleteAll = async () => {
        if (filteredInvoices.length === 0) {
            setIsDeleteAllConfirmOpen(false);
            return;
        }
        
        try {
            const idsToDelete = filteredInvoices.map(inv => inv.id);
            const { error } = await supabase
                .from('expected_invoices')
                .delete()
                .in('id', idsToDelete);
            
            if (error) {
                console.warn('Supabase delete all failed, deleting locally', error);
            }
            setInvoices(prev => prev.filter(inv => !idsToDelete.includes(inv.id)));
        } catch (error) {
            console.error('Error in confirmDeleteAll:', error);
        }
        setIsDeleteAllConfirmOpen(false);
    };

    const filteredInvoices = invoices.filter(inv => {
        if (activeSubTab === 'invoice') {
            if (!inv.postTaxValue && !inv.expectedValue && !inv.preTaxValue && !inv.vatAmount) return false;
        } else if (activeSubTab === 'team') {
            if (!inv.teamValue && !inv.teamName) return false;
        }

        const term = searchTerm.toLowerCase();
        if (filterProject && inv.projectName !== filterProject) return false;
        if (filterPhase && inv.phase !== filterPhase) return false;

        return (
            (inv.projectName || '').toLowerCase().includes(term) ||
            (inv.phase || '').toLowerCase().includes(term) ||
            (inv.note || '').toLowerCase().includes(term) ||
            (projectDetails?.[inv.projectName]?.contractNo || '').toLowerCase().includes(term)
        );
    });

    const availablePhases = [...new Set(invoices.filter(i => !filterProject || i.projectName === filterProject).map(i => i.phase).filter(Boolean))].sort();

    return (
        <div className="max-w-6xl mx-auto animate-in fade-in duration-500 font-sans text-slate-800">
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-emerald-100 p-2 rounded-xl">
                            <FileSpreadsheet className="text-emerald-600" size={28} />
                        </div>
                        <h2 className="text-3xl font-black tracking-tight uppercase">Hóa Đơn - Tổ Đội Dự Kiến</h2>
                    </div>
                    <p className="text-slate-500 text-sm mt-1">Quản lý và theo dõi các hóa đơn, tổ đội dự kiến của công trình</p>
                </div>
                
                <div className="flex gap-3">
                    {currentUser?.role?.toUpperCase() === 'ADMIN' && (
                        <button 
                            onClick={handleDeleteAll}
                            disabled={filteredInvoices.length === 0}
                            className={`px-6 py-2.5 rounded-xl font-bold transition flex items-center gap-2 ${filteredInvoices.length === 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-red-50 hover:bg-red-100 text-red-600'}`}
                        >
                            <Trash2 size={20} />
                            Xóa tất cả
                        </button>
                    )}
                    <button 
                        onClick={() => { resetForm(); setIsFormOpen(true); }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                    >
                        <Plus size={20} />
                        Thêm mới
                    </button>
                </div>
            </header>

            <div className="flex gap-6 border-b border-slate-200 mb-6">
                <button 
                    onClick={() => setActiveSubTab('invoice')}
                    className={`pb-3 font-black text-sm px-2 border-b-[3px] transition-colors ${activeSubTab === 'invoice' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}`}
                >
                    GIÁ TRỊ HÓA ĐƠN
                </button>
                <button 
                    onClick={() => setActiveSubTab('team')}
                    className={`pb-3 font-black text-sm px-2 border-b-[3px] transition-colors ${activeSubTab === 'team' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}`}
                >
                    GIÁ TRỊ TỔ ĐỘI
                </button>
            </div>

            <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
                    <input 
                        type="text"
                        placeholder="Tìm kiếm..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold outline-none focus:border-emerald-500 focus:bg-white transition"
                    />
                </div>
                <div className="w-full md:w-64">
                    <select
                        value={filterProject}
                        onChange={(e) => {
                            setFilterProject(e.target.value);
                            setFilterPhase('');
                        }}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 focus:bg-white transition"
                    >
                        <option value="">Tất cả công trình</option>
                        {projects.map(p => (
                            <option key={p.id} value={p.name}>{p.name}</option>
                        ))}
                    </select>
                </div>
                <div className="w-full md:w-48">
                    <select
                        value={filterPhase}
                        onChange={(e) => setFilterPhase(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 focus:bg-white transition"
                    >
                        <option value="">Tất cả các đợt</option>
                        {availablePhases.map(ph => (
                            <option key={ph} value={ph}>{ph}</option>
                        ))}
                    </select>
                </div>
            </div>

            {isFormOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="bg-slate-900 px-6 py-4 flex justify-between items-center">
                        <h3 className="text-white font-bold text-lg">{editingId ? 'Cập nhật' : 'Thêm mới'} {activeSubTab === 'invoice' ? 'hóa đơn' : 'tổ đội'} dự kiến</h3>
                        <button onClick={resetForm} className="text-slate-400 hover:text-white transition"><X /></button>
                    </div>
                    <form onSubmit={handleSave} className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">Tên công trình *</label>
                                <select 
                                    name="projectName" 
                                    value={formData.projectName}
                                    onChange={handleFormChange}
                                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition"
                                    required
                                >
                                    <option value="">-- Chọn công trình --</option>
                                    {projects.map(p => (
                                        <option key={p.id} value={p.name}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            {activeSubTab === 'invoice' ? (
                                <div>
                                    <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">Đợt</label>
                                    <select 
                                        name="phase_select" 
                                        value={isCustomPhase ? 'Khác' : formData.phase}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === 'Khác') {
                                                setIsCustomPhase(true);
                                                setFormData(prev => ({ ...prev, phase: '' }));
                                            } else {
                                                setIsCustomPhase(false);
                                                const matchedIncome = incomes?.find(i => i.project_name === formData.projectName && i.phase === val);
                                                setFormData(prev => ({ 
                                                    ...prev, 
                                                    phase: val,
                                                    ...(matchedIncome ? {
                                                        preTaxValue: matchedIncome.amount ? matchedIncome.amount.toLocaleString('en-US') : '',
                                                        vatAmount: matchedIncome.vat_amount ? matchedIncome.vat_amount.toLocaleString('en-US') : '',
                                                        postTaxValue: matchedIncome.post_tax_amount ? matchedIncome.post_tax_amount.toLocaleString('en-US') : ''
                                                    } : {})
                                                }));
                                            }
                                        }}
                                        className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition"
                                    >
                                        <option value="">-- Chọn đợt --</option>
                                        {availableFormPhases.map(ph => (
                                            <option key={ph} value={ph}>{ph}</option>
                                        ))}
                                        <option value="Khác">Khác...</option>
                                    </select>
                                    {isCustomPhase && (
                                        <input 
                                            type="text" 
                                            name="phase" 
                                            value={formData.phase}
                                            onChange={handleFormChange}
                                            className="w-full mt-2 bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition"
                                            placeholder="Nhập đợt khác..."
                                        />
                                    )}
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">Đợt</label>
                                    <input 
                                        type="text" 
                                        name="phase" 
                                        value={formData.phase}
                                        onChange={handleFormChange}
                                        className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white transition"
                                        placeholder="Ví dụ: Đợt 1"
                                    />
                                </div>
                            )}
                            {activeSubTab === 'invoice' ? (
                                <>
                                    <div>
                                        <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">Giá trị trước thuế</label>
                                        <input 
                                            type="text" 
                                            name="preTaxValue" 
                                            value={formData.preTaxValue ? formatCurrency(formData.preTaxValue) : ''}
                                            onChange={handleNumberChange}
                                            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition"
                                            placeholder="Ví dụ: 150,000,000"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">Thuế VAT</label>
                                        <input 
                                            type="text" 
                                            name="vatAmount" 
                                            value={formData.vatAmount ? formatCurrency(formData.vatAmount) : ''}
                                            onChange={handleNumberChange}
                                            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition"
                                            placeholder="Ví dụ: 15,000,000"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">Giá trị sau thuế *</label>
                                        <input 
                                            type="text" 
                                            name="postTaxValue" 
                                            value={formData.postTaxValue ? formatCurrency(formData.postTaxValue) : ''}
                                            onChange={handleNumberChange}
                                            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition"
                                            placeholder="Ví dụ: 165,000,000"
                                            required
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">Tên tổ đội *</label>
                                        <select 
                                            value={isCustomTeamName ? 'Khác' : (availableTeamNames.includes(formData.teamName) ? formData.teamName : (formData.teamName ? 'Khác' : ''))}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === 'Khác') {
                                                    setIsCustomTeamName(true);
                                                    setFormData(prev => ({ ...prev, teamName: '' }));
                                                } else {
                                                    setIsCustomTeamName(false);
                                                    setFormData(prev => ({ ...prev, teamName: val }));
                                                }
                                            }}
                                            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white transition"
                                        >
                                            <option value="">-- Chọn tổ đội --</option>
                                            {availableTeamNames.map(name => (
                                                <option key={name} value={name}>{name}</option>
                                            ))}
                                            <option value="Khác">Khác...</option>
                                        </select>
                                        {(isCustomTeamName || (!availableTeamNames.includes(formData.teamName) && formData.teamName)) && (
                                            <input 
                                                type="text" 
                                                name="teamName" 
                                                value={formData.teamName || ''}
                                                onChange={handleFormChange}
                                                className="w-full mt-2 bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white transition"
                                                placeholder="Nhập tên tổ đội..."
                                            />
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">Lũy kế tạm ứng</label>
                                            <input 
                                                type="text" 
                                                name="accumulatedAdvance" 
                                                value={formData.accumulatedAdvance || ''}
                                                onChange={(e) => {
                                                    const value = e.target.value.replace(/\D/g, '');
                                                    setFormData(prev => ({ ...prev, accumulatedAdvance: value ? parseInt(value).toLocaleString('en-US') : '' }));
                                                }}
                                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-black text-blue-600 outline-none focus:border-indigo-500 focus:bg-white transition"
                                                placeholder="Ví dụ: 50,000,000"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">Giá trị kỳ này *</label>
                                            <input 
                                                type="text" 
                                                name="teamValue" 
                                                value={formData.teamValue || ''}
                                                onChange={(e) => {
                                                    const value = e.target.value.replace(/\D/g, '');
                                                    setFormData(prev => ({ ...prev, teamValue: value ? parseInt(value).toLocaleString('en-US') : '' }));
                                                }}
                                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-black text-emerald-600 outline-none focus:border-indigo-500 focus:bg-white transition"
                                                placeholder="Ví dụ: 50,000,000"
                                                required
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                            <div>
                                <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">Ghi chú</label>
                                <input 
                                    type="text" 
                                    name="note" 
                                    value={formData.note}
                                    onChange={handleFormChange}
                                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition"
                                    placeholder="Nhập ghi chú..."
                                />
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button type="button" onClick={resetForm} className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition">Hủy</button>
                            <button type="submit" className="px-6 py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition">
                                <CheckCircle2 size={18} /> Lưu dữ liệu
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            )}

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1100px]">
                        <thead>
                            <tr className="bg-slate-900 text-white border-b border-slate-200">
                                <th className="p-4 font-black uppercase text-xs tracking-wider w-16 text-center">STT</th>
                                <th className="p-4 font-black uppercase text-xs tracking-wider">Tên công trình</th>
                                {activeSubTab === 'invoice' ? (
                                    <>
                                        <th className="p-4 font-black text-slate-100 uppercase tracking-wider text-right w-36">Giá trị trước thuế</th>
                                        <th className="p-4 font-black text-slate-100 uppercase tracking-wider text-right w-32">Thuế VAT</th>
                                        <th className="p-4 font-black text-slate-100 uppercase tracking-wider text-right w-40">Giá trị sau thuế</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="p-4 font-black uppercase text-xs tracking-wider">Tên tổ đội</th>
                                        <th className="p-4 font-black text-slate-100 uppercase tracking-wider text-right w-36">Lũy kế tạm ứng</th>
                                        <th className="p-4 font-black text-slate-100 uppercase tracking-wider text-right w-36">Giá trị kỳ này</th>
                                        <th className="p-4 font-black text-slate-100 uppercase tracking-wider text-right w-40">Tổng cộng</th>
                                    </>
                                )}
                                <th className="p-4 font-black uppercase text-xs tracking-wider">Đợt</th>
                                <th className="p-4 font-black uppercase text-xs tracking-wider">Ghi chú</th>
                                <th className="p-4 font-black uppercase text-xs tracking-wider w-24 text-center">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredInvoices.length === 0 ? (
                                <tr>
                                    <td colSpan={activeSubTab === 'invoice' ? 8 : 9} className="p-8 text-center text-slate-500">Chưa có dữ liệu phù hợp.</td>
                                </tr>
                            ) : (
                                filteredInvoices.map((inv, idx) => (
                                    <tr key={inv.id} className="hover:bg-slate-50 transition group">
                                        <td className="p-4 text-sm text-center text-slate-500 font-medium">{idx + 1}</td>
                                        <td className="p-4 text-sm font-bold text-slate-800">{inv.projectName}</td>
                                        {activeSubTab === 'invoice' ? (
                                            <>
                                                <td className="p-4 text-sm font-black text-slate-700 text-right">{formatCurrency(inv.preTaxValue || 0)}</td>
                                                <td className="p-4 text-sm font-black text-red-500 text-right">{formatCurrency(inv.vatAmount || 0)}</td>
                                                <td className="p-4 text-sm font-black text-emerald-600 text-right">{formatCurrency(inv.postTaxValue || 0)} VNĐ</td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="p-4 text-sm font-bold text-slate-800">{inv.teamName || '-'}</td>
                                                <td className="p-4 text-sm text-right font-medium text-blue-600">{formatCurrency(inv.accumulatedAdvance || 0)}</td>
                                                <td className="p-4 text-sm text-right font-bold text-emerald-600">{formatCurrency(inv.teamValue || 0)}</td>
                                                <td className="p-4 text-sm text-right font-black text-indigo-600">{formatCurrency((inv.accumulatedAdvance || 0) + (inv.teamValue || 0))} VNĐ</td>
                                            </>
                                        )}
                                        <td className="p-4 text-sm text-slate-600 font-medium">{inv.phase}</td>
                                        <td className="p-4 text-sm text-slate-500">{inv.note}</td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={() => handleEdit(inv)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition" title="Sửa"><Edit2 size={16} /></button>
                                                {currentUser?.role?.toUpperCase() === 'ADMIN' && (
                                                    <button onClick={() => handleDelete(inv.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition" title="Xóa"><Trash2 size={16} /></button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                            {filteredInvoices.length > 0 && (
                                <tr className="bg-slate-100 border-t-2 border-slate-300">
                                    <td colSpan={activeSubTab === 'invoice' ? 2 : 3} className="p-4 text-sm font-black text-slate-800 text-right uppercase">Tổng cộng:</td>
                                    {activeSubTab === 'invoice' ? (
                                        <>
                                            <td className="p-4 text-sm font-black text-slate-700 text-right">{formatCurrency(filteredInvoices.reduce((sum, inv) => sum + (parseFloat(inv.preTaxValue) || 0), 0))}</td>
                                            <td className="p-4 text-sm font-black text-red-600 text-right">{formatCurrency(filteredInvoices.reduce((sum, inv) => sum + (parseFloat(inv.vatAmount) || 0), 0))}</td>
                                            <td className="p-4 text-sm font-black text-emerald-700 text-right">{formatCurrency(filteredInvoices.reduce((sum, inv) => sum + (parseFloat(inv.postTaxValue) || 0), 0))} VNĐ</td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="p-4 text-sm font-black text-blue-700 text-right">{formatCurrency(filteredInvoices.reduce((sum, inv) => sum + (parseFloat(inv.accumulatedAdvance) || 0), 0))}</td>
                                            <td className="p-4 text-sm font-black text-emerald-700 text-right">{formatCurrency(filteredInvoices.reduce((sum, inv) => sum + (parseFloat(inv.teamValue) || 0), 0))}</td>
                                            <td className="p-4 text-sm font-black text-indigo-700 text-right">{formatCurrency(filteredInvoices.reduce((sum, inv) => sum + ((parseFloat(inv.accumulatedAdvance) || 0) + (parseFloat(inv.teamValue) || 0)), 0))} VNĐ</td>
                                        </>
                                    )}
                                    <td colSpan="3" className="p-4"></td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <ConfirmModal
                isOpen={!!confirmDeleteId}
                title="Xóa Hóa đơn dự kiến"
                message="Bạn có chắc chắn muốn xóa mục này? Thao tác này không thể hoàn tác."
                onConfirm={confirmDelete}
                onCancel={() => setConfirmDeleteId(null)}
            />

            <ConfirmModal
                isOpen={isDeleteAllConfirmOpen}
                title={`Xóa tất cả ${activeSubTab === 'invoice' ? 'hóa đơn' : 'tổ đội'} dự kiến`}
                message={`Bạn có chắc chắn muốn xóa tất cả ${filteredInvoices.length} mục đang hiển thị? Thao tác này không thể hoàn tác.`}
                onConfirm={confirmDeleteAll}
                onCancel={() => setIsDeleteAllConfirmOpen(false)}
            />
        </div>
    );
}
