import React, { useState, useEffect, useMemo } from 'react';
import { FileSpreadsheet, Plus, X, Edit2, Trash2, CheckCircle2, Search, Download, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import { formatCurrency, parseVietnameseNumber } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import ConfirmModal from '@/components/ConfirmModal';
export default function ExpectedInvoices({ projects, projectDetails, currentUser, incomes = [], transactions = [], handleCopyTable, exportTableToExcel }) {
    const [invoices, setInvoices] = useState([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [isDeleteAllConfirmOpen, setIsDeleteAllConfirmOpen] = useState(false);
    const [activeSubTab, setActiveSubTab] = useState('customer_debt');
    const [formData, setFormData] = useState({
        projectName: '',
        preTaxValue: '',
        vatAmount: '',
        postTaxValue: '',
        teamValue: '',
        accumulatedAdvance: '',
        teamName: '',
        phase: '',
        note: '',
        payment_period: '',
        account_name: '',
        account_number: '',
        bank_name: '',
        deductionAmount: ''
    });
    const [confirmPeriodAction, setConfirmPeriodAction] = useState(null);

    const [collapsedPhases, setCollapsedPhases] = useState({});

    const [filterProject, setFilterProject] = useState('');
    const [filterPhase, setFilterPhase] = useState('');
    const [isCustomPhase, setIsCustomPhase] = useState(false);
    const [isCustomTeamName, setIsCustomTeamName] = useState(false);
    const [isCustomPeriod, setIsCustomPeriod] = useState(false);

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

    const allPeriods = useMemo(() => {
        const periods = new Set();
        invoices.forEach(i => {
            if (i.payment_period) periods.add(i.payment_period);
        });
        return Array.from(periods).sort();
    }, [invoices]);

    useEffect(() => {
        if (activeSubTab === 'team' && !editingId && formData.projectName && formData.teamName) {
            const teamInvs = invoices.filter(i => i.projectName === formData.projectName && i.teamName === formData.teamName && !i.is_completed);
            
            if (teamInvs.length > 0) {
                let maxPhaseNum = 0;
                teamInvs.forEach(i => {
                    const p = i.phase || '';
                    const match = p.match(/\d+/);
                    if (match) {
                        const num = parseInt(match[0], 10);
                        if (num > maxPhaseNum) maxPhaseNum = num;
                    }
                });
                if (maxPhaseNum > 0) {
                    setFormData(prev => ({ ...prev, phase: `Đợt ${maxPhaseNum + 1}` }));
                } else {
                    setFormData(prev => ({ ...prev, phase: `Đợt 1` }));
                }
            } else {
                const otherInvs = invoices.filter(i => i.projectName === formData.projectName && !i.is_completed);
                let latestPhaseForProject = '';
                let maxOtherPhaseNum = 0;
                otherInvs.forEach(i => {
                    const p = i.phase || '';
                    const match = p.match(/\d+/);
                    if (match) {
                        const num = parseInt(match[0], 10);
                        if (num > maxOtherPhaseNum) {
                            maxOtherPhaseNum = num;
                            latestPhaseForProject = p;
                        }
                    }
                });
                
                if (latestPhaseForProject) {
                    setFormData(prev => ({ ...prev, phase: latestPhaseForProject }));
                } else {
                    setFormData(prev => ({ ...prev, phase: `Đợt 1` }));
                }
            }
        }
    }, [formData.projectName, formData.teamName, activeSubTab, editingId, invoices]);

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
        setFormData(prev => ({ ...prev, [name]: val }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        
        const preTax = parseFloat(formData.preTaxValue) || 0;
        const vat = parseFloat(formData.vatAmount) || 0;
        const postTax = parseFloat(formData.postTaxValue) || 0;
        const teamVal = parseFloat(parseVietnameseNumber(formData.teamValue)) || 0;
        const accAdv = parseFloat(parseVietnameseNumber(formData.accumulatedAdvance)) || 0;

        if (activeSubTab === 'team') {
            const existingPeriod = invoices.find(i => 
                i.projectName === formData.projectName && 
                i.teamName === formData.teamName && 
                i.phase === formData.phase &&
                !i.is_completed
            );
            if (existingPeriod && !editingId) {
                alert(`Kỳ ${formData.phase} của tổ đội này đã tồn tại! Vui lòng chọn kỳ khác.`);
                return;
            }
        }

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
                        note: formData.note,
                        payment_period: formData.payment_period,
                        account_name: formData.account_name,
                        account_number: formData.account_number,
                        bank_name: formData.bank_name,
                        deductionAmount: formData.deductionAmount ? parseInt(formData.deductionAmount.toString().replace(/\D/g, '')) : 0
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
                        note: formData.note,
                        payment_period: formData.payment_period,
                        account_name: formData.account_name,
                        account_number: formData.account_number,
                        bank_name: formData.bank_name,
                        deductionAmount: formData.deductionAmount ? parseInt(formData.deductionAmount.toString().replace(/\D/g, '')) : 0
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
                    note: formData.note,
                    payment_period: formData.payment_period,
                    account_name: formData.account_name,
                    account_number: formData.account_number,
                    bank_name: formData.bank_name,
                    deductionAmount: formData.deductionAmount ? parseInt(formData.deductionAmount.toString().replace(/\D/g, '')) : 0
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
        setIsCustomPeriod(false);
        setFormData({ projectName: '', preTaxValue: '', vatAmount: '', postTaxValue: '', teamValue: '', accumulatedAdvance: '', teamName: '', phase: '', note: '', payment_period: '', account_name: '', account_number: '', bank_name: '', deductionAmount: '' });
    };

    const handleEdit = (inv) => {
        setIsCustomPhase(false);
        setIsCustomTeamName(!inv.teamName ? false : true);
        setIsCustomPeriod(!allPeriods.includes(inv.payment_period) && inv.payment_period !== '');

        setFormData({
            projectName: inv.projectName,
            preTaxValue: inv.preTaxValue || '',
            vatAmount: inv.vatAmount || '',
            postTaxValue: inv.postTaxValue || '',
            teamValue: inv.teamValue ? inv.teamValue.toLocaleString('en-US') : '',
            accumulatedAdvance: inv.accumulatedAdvance ? inv.accumulatedAdvance.toLocaleString('en-US') : '',
            teamName: inv.teamName || '',
            phase: inv.phase || '',
            note: inv.note || '',
            payment_period: inv.payment_period || '',
            account_name: inv.account_name || '',
            account_number: inv.account_number || '',
            bank_name: inv.bank_name || '',
            deductionAmount: inv.deductionAmount ? inv.deductionAmount.toLocaleString('en-US') : ''
        });
        setEditingId(inv.id);
        setIsFormOpen(true);
    };

    const executePeriodToggle = async (actionData) => {
        const { period, periodInvoices, type } = actionData;
        try {
            let updatePayload = {};
            if (type === 'APPROVE_QS') updatePayload = { qs_approved: true };
            if (type === 'APPROVE_KT') updatePayload = { accountant_approved: true, is_completed: true };
            if (type === 'REVERT_QS') updatePayload = { qs_approved: false };
            if (type === 'REVERT_KT') updatePayload = { accountant_approved: false, is_completed: false };
            
            for (const inv of periodInvoices) {
                await supabase
                    .from('expected_invoices')
                    .update(updatePayload)
                    .eq('id', inv.id);
            }
            
            setInvoices(prev => prev.map(inv => {
                if (periodInvoices.find(p => p.id === inv.id)) {
                    return { ...inv, ...updatePayload };
                }
                return inv;
            }));
            setConfirmPeriodAction(null);
        } catch (error) {
            console.error('Error toggling period:', error);
            alert('Có lỗi xảy ra!');
        }
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

    const handleToggleComplete = async (id, currentStatus) => {
        try {
            const { error } = await supabase
                .from('expected_invoices')
                .update({ is_completed: !currentStatus })
                .eq('id', id);
            
            if (error) {
                console.warn('Supabase update failed, updating locally', error);
            }
            setInvoices(prev => prev.map(inv => 
                inv.id === id ? { ...inv, is_completed: !currentStatus } : inv
            ));
        } catch (error) {
            console.error('Error toggling complete:', error);
            setInvoices(prev => prev.map(inv => 
                inv.id === id ? { ...inv, is_completed: !currentStatus } : inv
            ));
        }
    };

    let filteredInvoices = invoices.filter(inv => {
        if (activeSubTab === 'invoice') {
            if (!inv.postTaxValue && !inv.expectedValue && !inv.preTaxValue && !inv.vatAmount) return false;
        } else if (activeSubTab === 'team') {
            if (!inv.teamValue && !inv.teamName) return false;
            if (inv.accountant_approved) return false;
            if (currentUser?.role?.toUpperCase() === 'ACCOUNTANT' && !inv.qs_approved) return false;
        } else if (activeSubTab === 'history_team') {
            if (!inv.teamValue && !inv.teamName) return false;
            if (!inv.accountant_approved) return false;
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

    if (activeSubTab === 'history_team') {
        filteredInvoices.sort((a, b) => (a.projectName || '').localeCompare(b.projectName || ''));
    }

    const customerDebts = useMemo(() => {
        if (activeSubTab !== 'customer_debt') return [];
        const debts = [];
        
        projects.forEach(p => {
            const name = p.name;
            const details = projectDetails[name] || {};
            const advanceValue = details.advanceValue || 0;
            const projIncomes = incomes.filter(i => i.project_name === name);
            const allPhases = [...new Set(projIncomes.map(i => i.phase).filter(Boolean))].sort();

            allPhases.forEach(phase => {
                const phaseIncs = projIncomes.filter(i => i.phase === phase);
                const invoiceRecords = phaseIncs.filter(i => i.post_tax_amount > 0 || i.amount > 0);
                
                let phaseHstt = undefined;
                let invoice_no = '';
                let invoice_date = '';
                let voucher_nos = [];
                
                const sortedInvoices = [...invoiceRecords].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
                
                if (sortedInvoices.length > 0) {
                    const primaryInv = sortedInvoices[0];
                    invoice_no = primaryInv.invoice_no || '';
                    invoice_date = primaryInv.invoice_date || primaryInv.date || '';
                }

                for (const inv of sortedInvoices) {
                    if (inv.note) {
                        try {
                            const parsed = JSON.parse(inv.note);
                            if (parsed && typeof parsed === 'object' && 'actual_received_amount' in parsed) {
                                phaseHstt = Number(parsed.actual_received_amount) || 0;
                                if (inv.invoice_no) invoice_no = inv.invoice_no;
                                if (inv.invoice_date || inv.date) invoice_date = inv.invoice_date || inv.date;
                                break;
                            }
                        } catch(e) {}
                    }
                }
                
                let pExpected = 0;
                if (phase === 'Tạm ứng' || phase?.toLowerCase() === 'tạm ứng') {
                    pExpected = Number(advanceValue) || 0;
                } else {
                    pExpected = phaseHstt !== undefined 
                        ? phaseHstt 
                        : invoiceRecords.reduce((sum, i) => sum + (i.post_tax_amount || i.amount || 0), 0);
                }

                const pActual = phaseIncs.filter(i => i.post_tax_amount === 0 && i.amount === 0).reduce((sum, i) => {
                    let actual = 0;
                    if (i.voucher_no) voucher_nos.push(i.voucher_no);
                    if (i.note) {
                        try {
                            const parsed = JSON.parse(i.note);
                            if (parsed && typeof parsed === 'object') {
                                const act = Number(parsed.actual_received_amount) || 0;
                                const ded = Number(parsed.deduction_amount) || 0;
                                actual = act + ded;
                            }
                        } catch(e) {}
                    }
                    return sum + actual;
                }, 0);
                
                const uniqueVouchers = [...new Set(voucher_nos.filter(Boolean))].join(', ');

                let due_date_str = '';
                let overdue_days = '';

                if (invoice_date) {
                    const invDateObj = new Date(invoice_date);
                    if (!isNaN(invDateObj.getTime())) {
                        let dueDateObj = new Date(invDateObj.getTime());
                        let added = 0;
                        while (added < 15) {
                            dueDateObj.setDate(dueDateObj.getDate() + 1);
                            if (dueDateObj.getDay() !== 0 && dueDateObj.getDay() !== 6) {
                                added++;
                            }
                        }
                        due_date_str = dueDateObj.toLocaleDateString('vi-VN');
                        
                        const now = new Date();
                        now.setHours(0, 0, 0, 0);
                        const due = new Date(dueDateObj);
                        due.setHours(0, 0, 0, 0);
                        const diffTime = now.getTime() - due.getTime();
                        if (diffTime > 0) {
                            overdue_days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                        } else {
                            overdue_days = 0;
                        }
                    }
                }

                const remaining = pExpected - pActual;
                if (remaining > 0) {
                    debts.push({
                        id: `${name}_${phase}`,
                        projectName: name,
                        contractNo: details.contractNo || '',
                        phase: phase,
                        expected: pExpected,
                        actual: pActual,
                        remaining: remaining,
                        invoice_no: invoice_no,
                        invoice_date: invoice_date ? new Date(invoice_date).toLocaleDateString('vi-VN') : '',
                        due_date: due_date_str,
                        overdue_days: overdue_days,
                        voucher_no: uniqueVouchers
                    });
                }
            });
        });
        return debts;
    }, [activeSubTab, projects, projectDetails, incomes]);

    const filteredCustomerDebts = useMemo(() => {
        return customerDebts.filter(debt => {
            const term = searchTerm.toLowerCase();
            if (filterProject && debt.projectName !== filterProject) return false;
            if (filterPhase && debt.phase !== filterPhase) return false;

            return (
                (debt.projectName || '').toLowerCase().includes(term) ||
                (debt.phase || '').toLowerCase().includes(term)
            );
        });
    }, [customerDebts, searchTerm, filterProject, filterPhase]);

    const availablePhases = useMemo(() => {
        if (activeSubTab === 'customer_debt') {
            return [...new Set(customerDebts.filter(i => !filterProject || i.projectName === filterProject).map(i => i.phase).filter(Boolean))].sort();
        }
        return [...new Set(invoices.filter(i => !filterProject || i.projectName === filterProject).map(i => i.phase).filter(Boolean))].sort();
    }, [activeSubTab, invoices, customerDebts, filterProject]);

    return (
        <div className="w-full mx-auto animate-in fade-in duration-500 font-sans text-slate-800">
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
                    <button 
                        onClick={() => exportTableToExcel('expected-invoices-table', 'Du_Kien')}
                        className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-4 py-2 rounded-xl font-bold transition flex items-center gap-2"
                        title="Xuất Excel"
                    >
                        <Download size={20} />
                        <span className="hidden sm:inline">Xuất Excel</span>
                    </button>
                    {activeSubTab !== 'customer_debt' && currentUser?.role?.toUpperCase() === 'ADMIN' && (
                        <button 
                            onClick={handleDeleteAll}
                            disabled={filteredInvoices.length === 0}
                            className={`px-6 py-2.5 rounded-xl font-bold transition flex items-center gap-2 ${filteredInvoices.length === 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-red-50 hover:bg-red-100 text-red-600'}`}
                        >
                            <Trash2 size={20} />
                            Xóa tất cả
                        </button>
                    )}
                    {activeSubTab !== 'customer_debt' && (
                        <button 
                            onClick={() => { resetForm(); setIsFormOpen(true); }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                        >
                            <Plus size={20} />
                            Thêm mới
                        </button>
                    )}
                </div>
            </header>

            <div className="flex gap-6 border-b border-slate-200 mb-6 overflow-x-auto hide-scrollbar">
                <button 
                    onClick={() => setActiveSubTab('customer_debt')}
                    className={`pb-3 font-black text-sm px-2 border-b-[3px] transition-colors whitespace-nowrap ${activeSubTab === 'customer_debt' ? 'border-rose-600 text-rose-700' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}`}
                >
                    CÔNG NỢ KHÁCH HÀNG
                </button>
                <button 
                    onClick={() => setActiveSubTab('invoice')}
                    className={`pb-3 font-black text-sm px-2 border-b-[3px] transition-colors whitespace-nowrap ${activeSubTab === 'invoice' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}`}
                >
                    GIÁ TRỊ HÓA ĐƠN
                </button>
                <button 
                    onClick={() => setActiveSubTab('team')}
                    className={`pb-3 font-black text-sm px-2 border-b-[3px] transition-colors whitespace-nowrap ${activeSubTab === 'team' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}`}
                >
                    GIÁ TRỊ TỔ ĐỘI
                </button>
                <button 
                    onClick={() => setActiveSubTab('history_team')}
                    className={`pb-3 font-black text-sm px-2 border-b-[3px] transition-colors whitespace-nowrap ${activeSubTab === 'history_team' ? 'border-amber-600 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}`}
                >
                    LỊCH SỬ CHI TỔ ĐỘI
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
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="bg-slate-900 px-6 py-4 flex justify-between items-center">
                        <h3 className="text-white font-bold text-lg">{editingId ? 'Cập nhật' : 'Thêm mới'} {activeSubTab === 'invoice' ? 'hóa đơn' : 'tổ đội'} dự kiến</h3>
                        <button onClick={resetForm} className="text-slate-400 hover:text-white transition"><X /></button>
                    </div>
                    <form onSubmit={handleSave} className="p-6 flex flex-col gap-6">
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
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">Đợt *</label>
                                        <input 
                                            type="text" 
                                            name="phase" 
                                            value={formData.phase || ''}
                                            onChange={handleFormChange}
                                            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white transition"
                                            placeholder="Ví dụ: Đợt 1"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">Kỳ thanh toán *</label>
                                        <select 
                                            value={isCustomPeriod ? 'Khác' : (allPeriods.includes(formData.payment_period) ? formData.payment_period : (formData.payment_period ? 'Khác' : ''))}
                                            onChange={(e) => {
                                                if (e.target.value === 'Khác') {
                                                    setIsCustomPeriod(true);
                                                    setFormData(prev => ({ ...prev, payment_period: '' }));
                                                } else {
                                                    setIsCustomPeriod(false);
                                                    setFormData(prev => ({ ...prev, payment_period: e.target.value }));
                                                }
                                            }}
                                            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white transition"
                                            required
                                        >
                                            <option value="">-- Chọn kỳ thanh toán --</option>
                                            {allPeriods.map(p => <option key={p} value={p}>{p}</option>)}
                                            <option value="Khác">-- Thêm kỳ mới --</option>
                                        </select>
                                        {(isCustomPeriod || (!allPeriods.includes(formData.payment_period) && formData.payment_period)) && (
                                            <input 
                                                type="text" 
                                                name="payment_period" 
                                                value={formData.payment_period || ''}
                                                onChange={handleFormChange}
                                                className="w-full mt-2 bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white transition"
                                                placeholder="Nhập kỳ thanh toán mới..."
                                                required
                                            />
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {activeSubTab === 'invoice' ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">Tên tổ đội *</label>
                                        <select 
                                            value={isCustomTeamName ? 'Khác' : (availableTeamNames.includes(formData.teamName) ? formData.teamName : (formData.teamName ? 'Khác' : ''))}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                let tName = val;
                                                if (val === 'Khác') {
                                                    setIsCustomTeamName(true);
                                                    setFormData(prev => ({ ...prev, teamName: '', accumulatedAdvance: '', account_name: '', account_number: '', bank_name: '' }));
                                                    tName = '';
                                                } else {
                                                    setIsCustomTeamName(false);
                                                    const teamInvoices = invoices.filter(i => i.projectName === formData.projectName && i.teamName === val && !i.is_completed);
                                                    const lastInvoice = teamInvoices.length > 0 ? teamInvoices[teamInvoices.length - 1] : null;
                                                    const lastAdvance = lastInvoice ? ((parseFloat(lastInvoice.accumulatedAdvance) || 0) + (parseFloat(lastInvoice.teamValue) || 0)) : 0;
                                                    
                                                    setFormData(prev => ({ 
                                                        ...prev, 
                                                        teamName: val,
                                                        accumulatedAdvance: lastAdvance > 0 ? lastAdvance.toLocaleString('en-US') : '',
                                                        account_name: lastInvoice?.account_name || prev.account_name || '',
                                                        account_number: lastInvoice?.account_number || prev.account_number || '',
                                                        bank_name: lastInvoice?.bank_name || prev.bank_name || ''
                                                    }));
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
                                            <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">Giá trị KL</label>
                                            <input 
                                                type="text" 
                                                name="preTaxValue" 
                                                value={formData.preTaxValue || ''}
                                                onChange={(e) => {
                                                    const value = e.target.value.replace(/\D/g, '');
                                                    const preTax = value ? parseInt(value) : 0;
                                                    const deduc = formData.deductionAmount ? parseInt(formData.deductionAmount.replace(/\D/g, '')) : 0;
                                                    setFormData(prev => ({ 
                                                        ...prev, 
                                                        preTaxValue: preTax ? preTax.toLocaleString('en-US') : '',
                                                        teamValue: preTax > 0 ? (preTax - deduc).toLocaleString('en-US') : ''
                                                    }));
                                                }}
                                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-black text-amber-600 outline-none focus:border-indigo-500 focus:bg-white transition"
                                                placeholder="Ví dụ: 50,000,000"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">Thu lại đội</label>
                                            <input 
                                                type="text" 
                                                name="deductionAmount" 
                                                value={formData.deductionAmount || ''}
                                                onChange={(e) => {
                                                    const value = e.target.value.replace(/\D/g, '');
                                                    const deduc = value ? parseInt(value) : 0;
                                                    const preTax = formData.preTaxValue ? parseInt(formData.preTaxValue.replace(/\D/g, '')) : 0;
                                                    setFormData(prev => ({ 
                                                        ...prev, 
                                                        deductionAmount: deduc ? deduc.toLocaleString('en-US') : '',
                                                        teamValue: preTax > 0 ? (preTax - deduc).toLocaleString('en-US') : ''
                                                    }));
                                                }}
                                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-black text-red-600 outline-none focus:border-indigo-500 focus:bg-white transition"
                                                placeholder="Ví dụ: 5,000,000"
                                            />
                                        </div>
                                    </div>
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
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
                                    <div>
                                        <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">Tên tài khoản</label>
                                        <input 
                                            type="text" 
                                            name="account_name" 
                                            value={formData.account_name || ''}
                                            onChange={handleFormChange}
                                            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white transition"
                                            placeholder="Tên người nhận..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">Số tài khoản</label>
                                        <input 
                                            type="text" 
                                            name="account_number" 
                                            value={formData.account_number || ''}
                                            onChange={handleFormChange}
                                            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white transition"
                                            placeholder="Ví dụ: 123456789"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">Ngân hàng</label>
                                        <input 
                                            type="text" 
                                            name="bank_name" 
                                            value={formData.bank_name || ''}
                                            onChange={handleFormChange}
                                            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white transition"
                                            placeholder="Ví dụ: Vietcombank"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">Ghi chú</label>
                                        <input 
                                            type="text" 
                                            name="note" 
                                            value={formData.note || ''}
                                            onChange={handleFormChange}
                                            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition"
                                            placeholder="Nhập ghi chú..."
                                        />
                                    </div>
                                </div>
                            </>
                        )}
                        
                        {activeSubTab === 'invoice' && (
                            <div>
                                <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">Ghi chú</label>
                                <input 
                                    type="text" 
                                    name="note" 
                                    value={formData.note || ''}
                                    onChange={handleFormChange}
                                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition"
                                    placeholder="Nhập ghi chú..."
                                />
                            </div>
                        )}
                        <div className="mt-2 flex justify-end gap-3 border-t border-slate-100 pt-6">
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
                <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-250px)]">
                    <table id="expected-invoices-table" className="w-full text-left border-collapse min-w-[1400px]">
                        <thead>
                            <tr className="bg-slate-900 text-white border-b border-slate-200 sticky top-0 z-20">
                                <th className="p-4 font-black uppercase text-xs tracking-wider w-16 text-center">STT</th>
                                <th className="p-4 font-black uppercase text-xs tracking-wider">
                                    {activeSubTab === 'customer_debt' ? 'Tên' : (activeSubTab === 'team' || activeSubTab === 'history_team' ? 'Đợt' : 'Tên công trình')}
                                </th>
                                {activeSubTab === 'invoice' ? (
                                    <>
                                        <th className="p-4 font-black text-slate-100 uppercase tracking-wider text-right w-36">Giá trị trước thuế</th>
                                        <th className="p-4 font-black text-slate-100 uppercase tracking-wider text-right w-32">Thuế VAT</th>
                                        <th className="p-4 font-black text-slate-100 uppercase tracking-wider text-right w-40">Giá trị sau thuế</th>
                                        <th className="p-4 font-black uppercase text-xs tracking-wider">Đợt</th>
                                        <th className="p-4 font-black uppercase text-xs tracking-wider">Ghi chú</th>
                                        <th className="p-4 font-black uppercase text-xs tracking-wider w-24 text-center">Thao tác</th>
                                    </>
                                ) : activeSubTab === 'team' || activeSubTab === 'history_team' ? (
                                    <>
                                        <th className="p-4 font-black uppercase text-xs tracking-wider">Tên tổ đội</th>
                                        <th className="p-4 font-black text-slate-100 uppercase tracking-wider text-right w-32">Giá trị KL</th>
                                        <th className="p-4 font-black text-slate-100 uppercase tracking-wider text-right w-32">Thu lại đội</th>
                                        <th className="p-4 font-black text-slate-100 uppercase tracking-wider text-right w-36">Lũy kế tạm ứng</th>
                                        <th className="p-4 font-black text-slate-100 uppercase tracking-wider text-right w-36">Giá trị kỳ này</th>
                                        <th className="p-4 font-black text-slate-100 uppercase tracking-wider text-right w-40">Tổng cộng</th>
                                        <th className="p-4 font-black uppercase text-xs tracking-wider">Tên TK</th>
                                        <th className="p-4 font-black uppercase text-xs tracking-wider">Số TK</th>
                                        <th className="p-4 font-black uppercase text-xs tracking-wider">Ngân hàng</th>
                                        <th className="p-4 font-black uppercase text-xs tracking-wider">Ghi chú</th>
                                        {activeSubTab === 'history_team' && <th className="p-4 font-black uppercase text-xs tracking-wider text-center w-36">Trạng thái duyệt</th>}
                                        <th className="p-4 font-black uppercase text-xs tracking-wider w-32 text-center">Thao tác</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="p-4 font-black uppercase text-xs tracking-wider">Số hợp đồng</th>
                                        <th className="p-4 font-black uppercase text-xs tracking-wider">Số HĐ</th>
                                        <th className="p-4 font-black uppercase text-xs tracking-wider">Ngày HĐ</th>
                                        <th className="p-4 font-black uppercase text-xs tracking-wider">Ngày tới hạn</th>
                                        <th className="p-4 font-black uppercase text-xs tracking-wider text-center">Quá hạn</th>
                                        <th className="p-4 font-black uppercase text-xs tracking-wider">Số CT</th>
                                        <th className="p-4 font-black uppercase text-xs tracking-wider">Đợt TT</th>
                                        <th className="p-4 font-black text-slate-100 uppercase tracking-wider text-right w-40">Cần thu (HSTT)</th>
                                        <th className="p-4 font-black text-slate-100 uppercase tracking-wider text-right w-40">Đã thu</th>
                                        <th className="p-4 font-black text-slate-100 uppercase tracking-wider text-right w-40">Còn lại</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {activeSubTab === 'customer_debt' ? (
                                filteredCustomerDebts.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="p-8 text-center text-slate-500">Chưa có dữ liệu phù hợp.</td>
                                    </tr>
                                ) : (
                                    filteredCustomerDebts.map((debt, idx) => (
                                        <tr key={debt.id} className="hover:bg-slate-50 transition group">
                                            <td className="p-4 text-sm text-center text-slate-500 font-medium">{idx + 1}</td>
                                            <td className="p-4 text-sm font-bold text-slate-800">{debt.projectName}</td>
                                            <td className="p-4 text-sm font-medium text-slate-700">{debt.contractNo || '-'}</td>
                                            <td className="p-4 text-sm font-medium text-slate-700">{debt.invoice_no || '-'}</td>
                                            <td className="p-4 text-sm font-medium text-slate-700">{debt.invoice_date || '-'}</td>
                                            <td className="p-4 text-sm font-medium text-slate-700">{debt.due_date || '-'}</td>
                                            <td className="p-4 text-sm font-medium text-center">
                                                {debt.overdue_days > 0 ? (
                                                    <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full font-bold text-xs">{debt.overdue_days} ngày</span>
                                                ) : debt.due_date ? (
                                                    <span className="text-emerald-600 font-bold text-xs">Trong hạn</span>
                                                ) : '-'}
                                            </td>
                                            <td className="p-4 text-sm font-medium text-slate-700">{debt.voucher_no || '-'}</td>
                                            <td className="p-4 text-sm font-bold text-slate-800">{debt.phase}</td>
                                            <td className="p-4 text-sm font-black text-slate-700 text-right">{formatCurrency(debt.expected)} VNĐ</td>
                                            <td className="p-4 text-sm font-black text-emerald-600 text-right">{formatCurrency(debt.actual)} VNĐ</td>
                                            <td className="p-4 text-sm font-black text-rose-600 text-right">{formatCurrency(debt.remaining)} VNĐ</td>
                                        </tr>
                                    ))
                                )
                            ) : (
                                filteredInvoices.length === 0 ? (
                                    <tr>
                                        <td colSpan={activeSubTab === 'invoice' ? 8 : 13} className="p-8 text-center text-slate-500">Chưa có dữ liệu phù hợp.</td>
                                    </tr>
                                ) : activeSubTab === 'team' || activeSubTab === 'history_team' ? (
                                    Object.entries(
                                        filteredInvoices.reduce((acc, inv) => {
                                            const period = inv.payment_period || inv.phase || 'Chưa phân kỳ';
                                            if (!acc[period]) acc[period] = {};
                                            const proj = inv.projectName || 'Khác';
                                            if (!acc[period][proj]) acc[period][proj] = [];
                                            acc[period][proj].push(inv);
                                            return acc;
                                        }, {})
                                    ).map(([period, projectGroups]) => {
                                        const periodInvoices = Object.values(projectGroups).flat();
                                        const isQsApproved = periodInvoices[0]?.qs_approved;
                                        const isKtApproved = periodInvoices[0]?.accountant_approved;
                                        const role = currentUser?.role?.toUpperCase();
                                        const canApproveQs = (role === 'QS' || role === 'ADMIN') && !isQsApproved;
                                        const canRevertQs = (role === 'QS' || role === 'ADMIN') && isQsApproved && !isKtApproved;
                                        const canApproveKt = (role === 'ACCOUNTANT' || role === 'ADMIN') && isQsApproved && !isKtApproved;
                                        const canRevertKt = (role === 'ACCOUNTANT' || role === 'ADMIN') && isKtApproved;

                                        return (
                                        <React.Fragment key={period}>
                                            <tr className="bg-slate-900 cursor-pointer hover:bg-slate-800 transition sticky top-[52px] z-10" onClick={() => setCollapsedPhases(prev => ({ ...prev, [period]: !prev[period] }))}>
                                                <td colSpan="14" className="p-4 py-5">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <div className="p-1 bg-slate-800 rounded-md">
                                                                {collapsedPhases[period] ? <ChevronRight size={18} className="text-white" /> : <ChevronDown size={18} className="text-white" />}
                                                            </div>
                                                            <span className="font-black text-white text-sm uppercase tracking-wider">KỲ THANH TOÁN: {period}</span>
                                                            {isKtApproved ? (
                                                                <span className="ml-3 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-md text-xs font-bold flex items-center gap-1"><CheckCircle2 size={12}/> KẾ TOÁN: ĐÃ DUYỆT</span>
                                                            ) : isQsApproved ? (
                                                                <span className="ml-3 bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-md text-xs font-bold flex items-center gap-1"><CheckCircle2 size={12}/> QS: ĐÃ DUYỆT</span>
                                                            ) : null}
                                                        </div>
                                                        <div className="flex gap-2">
                                                            {activeSubTab === 'team' && canApproveQs && (
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); setConfirmPeriodAction({period, periodInvoices, type: 'APPROVE_QS'}); }} 
                                                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-black text-xs flex items-center gap-2 transition shadow-sm"
                                                                >
                                                                    <CheckCircle2 size={16} /> DUYỆT QS KỲ NÀY
                                                                </button>
                                                            )}
                                                            {activeSubTab === 'team' && canRevertQs && (
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); setConfirmPeriodAction({period, periodInvoices, type: 'REVERT_QS'}); }} 
                                                                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-black text-xs flex items-center gap-2 transition shadow-sm"
                                                                >
                                                                    <RotateCcw size={16} /> HOÀN TÁC QS
                                                                </button>
                                                            )}
                                                            {activeSubTab === 'team' && canApproveKt && (
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); setConfirmPeriodAction({period, periodInvoices, type: 'APPROVE_KT'}); }} 
                                                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-black text-xs flex items-center gap-2 transition shadow-sm"
                                                                >
                                                                    <CheckCircle2 size={16} /> DUYỆT KẾ TOÁN
                                                                </button>
                                                            )}
                                                            {activeSubTab === 'history_team' && canRevertKt && (
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); setConfirmPeriodAction({period, periodInvoices, type: 'REVERT_KT'}); }} 
                                                                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-black text-xs flex items-center gap-2 transition shadow-sm"
                                                                >
                                                                    <RotateCcw size={16} /> HOÀN TÁC KẾ TOÁN
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                            {!collapsedPhases[period] && Object.entries(projectGroups).map(([projName, groupInvoices], projIdx) => {
                                                const projectColors = [
                                                    { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200', rowBorder: 'border-l-orange-400' },
                                                    { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200', rowBorder: 'border-l-blue-400' },
                                                    { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', rowBorder: 'border-l-emerald-400' },
                                                    { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200', rowBorder: 'border-l-purple-400' },
                                                    { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200', rowBorder: 'border-l-rose-400' },
                                                    { bg: 'bg-cyan-50', text: 'text-cyan-800', border: 'border-cyan-200', rowBorder: 'border-l-cyan-400' },
                                                ];
                                                const color = projectColors[projIdx % projectColors.length];
                                                const sortedGroupInvoices = [...groupInvoices].sort((a, b) => {
                                                    const aVal = parseFloat(a.teamValue) || 0;
                                                    const bVal = parseFloat(b.teamValue) || 0;
                                                    if (aVal === 0 && bVal !== 0) return 1;
                                                    if (aVal !== 0 && bVal === 0) return -1;
                                                    return 0;
                                                });
                                                return (
                                                <React.Fragment key={projName}>
                                                    <tr className={`${color.bg} border-y ${color.border}`}>
                                                        <td colSpan="3" className={`p-3 font-black ${color.text} text-sm uppercase text-right`}>{projName}:</td>
                                                        <td className="p-3 text-sm text-right font-black text-amber-600">{formatCurrency(groupInvoices.reduce((sum, inv) => sum + (parseFloat(inv.preTaxValue) || 0), 0))}</td>
                                                        <td className="p-3 text-sm text-right font-black text-red-600">{formatCurrency(groupInvoices.reduce((sum, inv) => sum + (parseFloat(inv.deductionAmount) || 0), 0))}</td>
                                                        <td className="p-3 text-sm text-right font-black text-blue-600">{formatCurrency(groupInvoices.reduce((sum, inv) => sum + (parseFloat(inv.accumulatedAdvance) || 0), 0))}</td>
                                                        <td className="p-3 text-sm text-right font-black text-emerald-600">{formatCurrency(groupInvoices.reduce((sum, inv) => sum + (parseFloat(inv.teamValue) || 0), 0))}</td>
                                                        <td className="p-3 text-sm text-right font-black text-indigo-600">{formatCurrency(groupInvoices.reduce((sum, inv) => sum + ((parseFloat(inv.accumulatedAdvance) || 0) + (parseFloat(inv.teamValue) || 0)), 0))}</td>
                                                        <td colSpan="6"></td>
                                                    </tr>
                                                    {sortedGroupInvoices.map((inv, idx) => {
                                                        const isAcctUser = currentUser?.role?.toUpperCase() === 'ACCOUNTANT';
                                                        const disableEdit = isAcctUser && !inv.qs_approved;

                                                        return (
                                                        <tr key={inv.id} className={`hover:bg-slate-50 transition group border-l-4 ${!parseFloat(inv.teamValue) ? 'border-l-slate-300 bg-slate-50 opacity-70 grayscale' : `${color.rowBorder} bg-white`}`}>
                                                            <td className="p-4 text-sm text-center text-slate-500 font-medium">{idx + 1}</td>
                                                            <td className="p-4 text-sm font-bold text-slate-800">{inv.phase || '-'}</td>
                                                            <td className="p-4 text-sm font-bold text-slate-800">{inv.teamName || '-'}</td>
                                                            <td className="p-4 text-sm text-right font-bold text-amber-600">{formatCurrency(parseFloat(inv.preTaxValue) || 0)}</td>
                                                            <td className="p-4 text-sm text-right font-bold text-red-600">{formatCurrency(parseFloat(inv.deductionAmount) || 0)}</td>
                                                            <td className="p-4 text-sm text-right font-medium text-blue-600">{formatCurrency(parseFloat(inv.accumulatedAdvance) || 0)}</td>
                                                            <td className="p-4 text-sm text-right font-bold text-emerald-600">{formatCurrency(parseFloat(inv.teamValue) || 0)}</td>
                                                            <td className="p-4 text-sm text-right font-black text-indigo-600">{formatCurrency((parseFloat(inv.accumulatedAdvance) || 0) + (parseFloat(inv.teamValue) || 0))}</td>
                                                            <td className="p-4 text-sm text-slate-600 font-medium whitespace-nowrap">{inv.account_name || '-'}</td>
                                                            <td className="p-4 text-sm text-slate-600 font-medium whitespace-nowrap">{inv.account_number || '-'}</td>
                                                            <td className="p-4 text-sm text-slate-600 font-medium uppercase whitespace-nowrap">{inv.bank_name || '-'}</td>
                                                            <td className="p-4 text-sm text-slate-500 max-w-[150px] truncate" title={inv.note}>{inv.note || '-'}</td>
                                                            {activeSubTab === 'history_team' && <td className="p-4 text-center">{inv.accountant_approved ? <span className="text-emerald-600 font-black">KT</span> : inv.qs_approved ? <span className="text-blue-600 font-black">QS</span> : <span className="text-slate-400">Chưa duyệt</span>}</td>}
                                                            <td className="p-4 text-center">
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <button 
                                                                        onClick={() => !disableEdit && handleEdit(inv)} 
                                                                        className={`p-1.5 rounded-lg transition border ${disableEdit ? 'text-slate-400 bg-slate-100 border-slate-200 cursor-not-allowed' : 'text-blue-500 hover:bg-blue-50 border-blue-200 bg-blue-50'}`} 
                                                                        title={disableEdit ? 'Kế toán chỉ được sửa sau khi QS đã duyệt' : 'Sửa'}
                                                                        disabled={disableEdit}
                                                                    >
                                                                        <Edit2 size={16} />
                                                                    </button>
                                                                    {currentUser?.role?.toUpperCase() === 'ADMIN' && (
                                                                        <button onClick={() => setConfirmDeleteId(inv.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition border border-red-200 bg-red-50" title="Xóa"><Trash2 size={16} /></button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        );
                                                    })}
                                                </React.Fragment>
                                            )})}
                                        </React.Fragment>
                                        );
                                    })
                                ) : (
                                    filteredInvoices.map((inv, idx) => (
                                        <tr key={inv.id} className="hover:bg-slate-50 transition group">
                                            <td className="p-4 text-sm text-center text-slate-500 font-medium">{idx + 1}</td>
                                            <td className="p-4 text-sm font-bold text-slate-800">{inv.projectName}</td>
                                            <td className="p-4 text-sm font-black text-slate-700 text-right">{formatCurrency(parseFloat(inv.preTaxValue) || 0)}</td>
                                            <td className="p-4 text-sm font-black text-red-500 text-right">{formatCurrency(parseFloat(inv.vatAmount) || 0)}</td>
                                            <td className="p-4 text-sm font-black text-emerald-600 text-right">{formatCurrency(parseFloat(inv.postTaxValue) || 0)} VNĐ</td>
                                            <td className="p-4 text-sm text-slate-600 font-medium">{inv.phase}</td>
                                            <td className="p-4 text-sm text-slate-500 max-w-xs truncate" title={inv.note}>{inv.note}</td>
                                            <td className="p-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={() => handleEdit(inv)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition border border-blue-200 bg-blue-50" title="Sửa"><Edit2 size={16} /></button>
                                                    {currentUser?.role?.toUpperCase() === 'ADMIN' && (
                                                        <button onClick={() => setConfirmDeleteId(inv.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition border border-red-200 bg-red-50" title="Xóa"><Trash2 size={16} /></button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )
                            )}
                            {activeSubTab === 'customer_debt' && filteredCustomerDebts.length > 0 && (
                                <tr className="bg-slate-100 border-t-2 border-slate-300">
                                    <td colSpan="9" className="p-4 text-sm font-black text-slate-800 text-right uppercase">Tổng cộng:</td>
                                    <td className="p-4 text-sm font-black text-slate-700 text-right">{formatCurrency(filteredCustomerDebts.reduce((sum, d) => sum + d.expected, 0))} VNĐ</td>
                                    <td className="p-4 text-sm font-black text-emerald-600 text-right">{formatCurrency(filteredCustomerDebts.reduce((sum, d) => sum + d.actual, 0))} VNĐ</td>
                                    <td className="p-4 text-sm font-black text-rose-600 text-right">{formatCurrency(filteredCustomerDebts.reduce((sum, d) => sum + d.remaining, 0))} VNĐ</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <ConfirmModal
                isOpen={!!confirmDeleteId}
                title="Xác nhận xóa"
                message="Bạn có chắc chắn muốn xóa dữ liệu này? Hành động này không thể hoàn tác."
                type="danger"
                onConfirm={confirmDelete}
                onCancel={() => setConfirmDeleteId(null)}
            />

            <ConfirmModal
                isOpen={isDeleteAllConfirmOpen}
                title="Xóa toàn bộ dữ liệu"
                message={`Bạn có chắc chắn muốn xóa tất cả ${filteredInvoices.length} dòng dữ liệu đang hiển thị? Hành động này cực kỳ nguy hiểm và không thể hoàn tác!`}
                type="danger"
                requirePassword={true}
                onConfirm={confirmDeleteAll}
                onCancel={() => setIsDeleteAllConfirmOpen(false)}
            />

            <ConfirmModal
                isOpen={!!confirmPeriodAction}
                title={
                    confirmPeriodAction?.type === 'APPROVE_QS' ? 'Xác nhận duyệt (QS)' :
                    confirmPeriodAction?.type === 'APPROVE_KT' ? 'Xác nhận duyệt (Kế Toán)' :
                    confirmPeriodAction?.type === 'REVERT_QS' ? 'Xác nhận hoàn tác (QS)' :
                    'Xác nhận hoàn tác (Kế Toán)'
                }
                message={
                    confirmPeriodAction?.type === 'APPROVE_QS' ? `Bạn có chắc chắn muốn DUYỆT toàn bộ kỳ thanh toán ${confirmPeriodAction?.period} với tư cách QS không? Kế toán sẽ nhìn thấy sau khi bạn duyệt.` :
                    confirmPeriodAction?.type === 'APPROVE_KT' ? `Bạn có chắc chắn muốn DUYỆT toàn bộ kỳ thanh toán ${confirmPeriodAction?.period} với tư cách Kế Toán không? Kỳ này sẽ chuyển sang Lịch sử chi.` :
                    `Bạn có chắc chắn muốn HOÀN TÁC toàn bộ kỳ thanh toán ${confirmPeriodAction?.period} không?`
                }
                type={confirmPeriodAction?.type?.includes('REVERT') ? 'warning' : 'info'}
                confirmText={confirmPeriodAction?.type?.includes('REVERT') ? 'Hoàn tác' : 'Duyệt kỳ này'}
                onConfirm={() => executePeriodToggle(confirmPeriodAction)}
                onCancel={() => setConfirmPeriodAction(null)}
            />
        </div>
    );
}
