import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FileSpreadsheet, Plus, X, Edit2, Trash2, CheckCircle2, Search, Download, RotateCcw, ChevronDown, ChevronRight, Printer, Copy, Upload, Eye, EyeOff, ZoomIn, ZoomOut, Coins } from 'lucide-react';
import { formatCurrency, parseVietnameseNumber } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import ConfirmModal from '@/components/ConfirmModal';

const CUSTOMER_DEBT_COLUMN_STORAGE_KEY = 'cbpro_expected_customer_debt_visible_columns_v2';
const EXPECTED_INVOICES_STORAGE_KEY = 'expected_invoices';
const EXPECTED_INVOICES_BACKUP_KEY = 'expected_invoices_backups_v1';
const EXPECTED_INVOICES_QUARANTINE_KEY = 'expected_invoices_quarantine_v1';
const MAX_EXPECTED_INVOICE_BACKUPS = 30;
const DEFAULT_CUSTOMER_DEBT_VISIBLE_COLUMNS = {
    stt: true,
    name: true,
    phase: true,
    expected: true,
    actual: true,
    remaining: true,
    dueDate: true,
    status: true,
    invoiceNo: true,
    invoiceDate: true,
    contractNo: true,
    voucherNo: true
};

const getCurrentMonthValue = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const formatMonthLabel = (value) => {
    if (!value) return '';
    const normalized = String(value).trim();
    if (/^\d{4}-\d{2}$/.test(normalized)) {
        const [year, month] = normalized.split('-');
        return `${month}/${year}`;
    }
    return normalized;
};

const normalizeMonthValue = (value) => {
    if (!value) return '';
    const normalized = String(value).trim();
    if (/^\d{4}-\d{2}$/.test(normalized)) return normalized;
    const slashMatch = normalized.match(/^(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
        return `${slashMatch[2]}-${String(slashMatch[1]).padStart(2, '0')}`;
    }
    return normalized;
};

const addBusinessDays = (dateValue, days) => {
    const startDate = new Date(dateValue);
    if (Number.isNaN(startDate.getTime())) return null;

    const dueDate = new Date(startDate.getTime());
    let added = 0;
    while (added < days) {
        dueDate.setDate(dueDate.getDate() + 1);
        if (dueDate.getDay() !== 0 && dueDate.getDay() !== 6) {
            added++;
        }
    }
    return dueDate;
};

const normalizeKeyPart = (value) => String(value || '').trim().toLowerCase();

const getExpectedInvoiceKey = (inv = {}) => {
    const projectName = normalizeKeyPart(inv.projectName);
    const phase = normalizeKeyPart(inv.phase);
    const invoiceMonth = normalizeMonthValue(inv.invoice_month || inv.created_at?.slice(0, 7) || '');
    const teamName = normalizeKeyPart(inv.teamName);
    const paymentPeriod = normalizeKeyPart(inv.payment_period);
    if (teamName || paymentPeriod) {
        return ['team', projectName, phase, paymentPeriod, teamName].join('__');
    }
    return ['invoice', projectName, phase, invoiceMonth].join('__');
};

const dedupeExpectedInvoices = (rows = []) => {
    const seen = new Map();
    rows.forEach(row => {
        const key = getExpectedInvoiceKey(row);
        if (!seen.has(key)) {
            seen.set(key, row);
            return;
        }

        const current = seen.get(key);
        const currentTime = new Date(current?.created_at || 0).getTime();
        const nextTime = new Date(row?.created_at || 0).getTime();

        if (nextTime >= currentTime) {
            seen.set(key, row);
        }
    });
    return Array.from(seen.values());
};

const TEAM_ACCOUNT_FIELDS = ['account_name', 'account_number', 'bank_name'];

const getBankCodeForQR = (bankFullName) => {
    if (!bankFullName) return '';
    const match = bankFullName.match(/^([A-Z0-9]+)\s*-/i);
    if (match) return match[1];
    return bankFullName.trim().replace(/\s+/g, '');
};

const cleanAccountFieldValue = (value) => String(value || '').trim();

const buildMissingTeamAccountPatch = (dbRow = {}, localRow = {}) => {
    const patch = {};

    TEAM_ACCOUNT_FIELDS.forEach(field => {
        const dbValue = cleanAccountFieldValue(dbRow[field]);
        const localValue = cleanAccountFieldValue(localRow[field]);
        if (!dbValue && localValue) {
            patch[field] = localValue;
        }
    });

    return patch;
};

const syncLocalTeamAccountInfoToSupabase = async (dbRows = [], localRows = []) => {
    const dbByKey = new Map(dbRows.map(row => [getExpectedInvoiceKey(row), row]));
    const updates = [];

    localRows.forEach(localRow => {
        const dbRow = dbByKey.get(getExpectedInvoiceKey(localRow));
        if (!dbRow?.id) return;

        const patch = buildMissingTeamAccountPatch(dbRow, localRow);
        if (Object.keys(patch).length === 0) return;

        updates.push({ id: dbRow.id, patch });
        Object.assign(dbRow, patch);
    });

    if (updates.length === 0) return 0;

    let synced = 0;
    for (const update of updates) {
        const { error } = await supabase
            .from('expected_invoices')
            .update(update.patch)
            .eq('id', update.id);

        if (error) {
            console.warn('Failed to sync local team account info:', error);
            continue;
        }
        synced += 1;
    }

    return synced;
};

const getExpectedInvoiceStats = (rows = []) => {
    const safeRows = Array.isArray(rows) ? rows : [];
    return safeRows.reduce((stats, row) => {
        const hasTeamName = Boolean(String(row?.teamName || '').trim());
        const hasTeamValue = Number(row?.teamValue || 0) !== 0;
        const hasAdvance = Number(row?.accumulatedAdvance || 0) !== 0;
        if (hasTeamName || hasTeamValue || hasAdvance) stats.teamRows += 1;
        if (hasTeamValue) stats.nonzeroTeamRows += 1;
        stats.totalRows += 1;
        return stats;
    }, { totalRows: 0, teamRows: 0, nonzeroTeamRows: 0 });
};

const shouldBlockExpectedInvoiceOverwrite = (previousRows = [], nextRows = []) => {
    const previous = getExpectedInvoiceStats(previousRows);
    const next = getExpectedInvoiceStats(nextRows);

    // Chỉ chặn khi dữ liệu mới bị trống hoàn toàn một cách bất thường (ví dụ do lỗi kết nối)
    // trong khi dữ liệu cũ đang lưu trữ có nhiều hơn 10 dòng.
    const totalDropped = previous.totalRows >= 10 && next.totalRows === 0;

    return totalDropped;
};

const saveExpectedInvoiceBackup = (rows = [], reason = 'auto') => {
    if (typeof window === 'undefined' || !Array.isArray(rows) || rows.length === 0) return;

    try {
        const backups = JSON.parse(localStorage.getItem(EXPECTED_INVOICES_BACKUP_KEY) || '[]');
        const nextBackup = {
            id: `${Date.now()}_${reason}`,
            reason,
            created_at: new Date().toISOString(),
            stats: getExpectedInvoiceStats(rows),
            rows
        };

        const nextBackups = [nextBackup, ...backups];
        for (let keep = MAX_EXPECTED_INVOICE_BACKUPS; keep >= 3; keep -= 3) {
            try {
                localStorage.setItem(EXPECTED_INVOICES_BACKUP_KEY, JSON.stringify(nextBackups.slice(0, keep)));
                return;
            } catch (error) {
                if (keep <= 3) throw error;
            }
        }
    } catch (error) {
        console.warn('Không thể tạo backup expected_invoices:', error);
    }
};

const quarantineExpectedInvoices = (previousRows = [], nextRows = [], reason = 'suspicious_overwrite') => {
    if (typeof window === 'undefined') return;

    try {
        const quarantines = JSON.parse(localStorage.getItem(EXPECTED_INVOICES_QUARANTINE_KEY) || '[]');
        const record = {
            id: `${Date.now()}_${reason}`,
            reason,
            created_at: new Date().toISOString(),
            previousStats: getExpectedInvoiceStats(previousRows),
            nextStats: getExpectedInvoiceStats(nextRows),
            rows: nextRows
        };
        localStorage.setItem(EXPECTED_INVOICES_QUARANTINE_KEY, JSON.stringify([record, ...quarantines].slice(0, 10)));
    } catch (error) {
        console.warn('Không thể lưu quarantine expected_invoices:', error);
    }
};

export default function ExpectedInvoices({ projects, projectDetails, currentUser, incomes = [], transactions = [], handleCopyTable, exportTableToExcel, onAddTransaction, showToast, onNavigateToProject, usersList = [], deleteRequests = [] }) {
    const adminPassword = usersList?.find(u => u.role?.toUpperCase() === 'ADMIN' || u.username?.toLowerCase() === 'admin')?.password || '123456';
    const [invoices, setInvoices] = useState([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [requestDeleteInvoice, setRequestDeleteInvoice] = useState(null);
    const [isDeleteAllConfirmOpen, setIsDeleteAllConfirmOpen] = useState(false);
    const [deletePeriodState, setDeletePeriodState] = useState({ isOpen: false, periodName: '', periodInvoices: [], password: '', error: '' });
    const [isBulkAddModalOpen, setIsBulkAddModalOpen] = useState(false);
    const [bulkAddMonth, setBulkAddMonth] = useState('');
    const [activeSubTab, setActiveSubTab] = useState('customer_debt');
    const [filterInvoiceMonth, setFilterInvoiceMonth] = useState('');
    const [uploadingPdfId, setUploadingPdfId] = useState(null);
    const [uploadingProjectPdfKey, setUploadingProjectPdfKey] = useState(null);
    const [confirmDeletePdf, setConfirmDeletePdf] = useState(null);
    const [confirmDeleteProjectPdf, setConfirmDeleteProjectPdf] = useState(null);
    const [tableZoom, setTableZoom] = useState(1);
    const [hideZeroRowsOnPrint, setHideZeroRowsOnPrint] = useState(true);
    const [hideUnissuedCustomerDebtRowsOnPrint, setHideUnissuedCustomerDebtRowsOnPrint] = useState(false);
    const [customerDebtVisibleColumns, setCustomerDebtVisibleColumns] = useState(() => {
        if (typeof window === 'undefined') return DEFAULT_CUSTOMER_DEBT_VISIBLE_COLUMNS;
        try {
            const saved = localStorage.getItem(CUSTOMER_DEBT_COLUMN_STORAGE_KEY);
            return saved ? { ...DEFAULT_CUSTOMER_DEBT_VISIBLE_COLUMNS, ...JSON.parse(saved) } : DEFAULT_CUSTOMER_DEBT_VISIBLE_COLUMNS;
        } catch(e) {
            return DEFAULT_CUSTOMER_DEBT_VISIBLE_COLUMNS;
        }
    });
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
        deductionAmount: '',
        invoice_month: getCurrentMonthValue()
    });
    const [confirmPeriodAction, setConfirmPeriodAction] = useState(null);
    const [editingPeriodName, setEditingPeriodName] = useState(null);
    const [newPeriodName, setNewPeriodName] = useState('');
    const [renameError, setRenameError] = useState('');

    const [isClonePeriodModalOpen, setIsClonePeriodModalOpen] = useState(false);
    const [cloneSourcePeriod, setCloneSourcePeriod] = useState('');
    const [cloneTargetPeriod, setCloneTargetPeriod] = useState('');

    const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
    const [advanceData, setAdvanceData] = useState(null);

    const [teamInfoList, setTeamInfoList] = useState([]);
    const [isTeamInfoFormOpen, setIsTeamInfoFormOpen] = useState(false);
    const [teamInfoForm, setTeamInfoForm] = useState({
        team_name: '',
        account_name: '',
        account_number: '',
        bank_name: ''
    });
    const [isCustomTeamInfoName, setIsCustomTeamInfoName] = useState(false);
    const [confirmDeleteTeamInfoId, setConfirmDeleteTeamInfoId] = useState(null);

    const allProjectTeamNames = useMemo(() => {
        const names = new Set();
        if (transactions && transactions.length > 0) {
            transactions.forEach(t => {
                if (t.recipient) names.add(t.recipient.trim());
            });
        }
        if (invoices && invoices.length > 0) {
            invoices.forEach(i => {
                if (i.teamName) names.add(i.teamName.trim());
            });
        }
        return [...names].filter(Boolean).sort();
    }, [transactions, invoices]);

    const fetchTeamInfo = async () => {
        try {
            const { data, error } = await supabase.from('team_info').select('*').order('team_name', { ascending: true });
            if (error) throw error;
            setTeamInfoList(data || []);
        } catch (err) {
            console.warn('Lỗi khi lấy thông tin tổ đội từ database, fallback sang localStorage:', err);
            const saved = localStorage.getItem('system_team_info');
            setTeamInfoList(saved ? JSON.parse(saved) : []);
        }
    };

    const handleSaveTeamInfo = async (e) => {
        if (e) e.preventDefault();
        
        if (!teamInfoForm.team_name) {
            showToast?.('Vui lòng chọn hoặc nhập tên tổ đội!', 'error');
            return;
        }

        setIsLoaded(false);
        try {
            const payload = {
                team_name: teamInfoForm.team_name.trim(),
                account_name: teamInfoForm.account_name.trim(),
                account_number: teamInfoForm.account_number.trim(),
                bank_name: teamInfoForm.bank_name.trim()
            };

            if (editingId) {
                const { error } = await supabase
                    .from('team_info')
                    .update(payload)
                    .eq('id', editingId);

                if (error) throw error;

                // Propagate updates to all matching expected invoices
                try {
                    await supabase
                        .from('expected_invoices')
                        .update({
                            account_name: payload.account_name,
                            account_number: payload.account_number,
                            bank_name: payload.bank_name
                        })
                        .eq('teamName', payload.team_name);
                    
                    setInvoices(prev => prev.map(inv => {
                        if (inv.teamName && inv.teamName.toLowerCase() === payload.team_name.toLowerCase()) {
                            return {
                                ...inv,
                                account_name: payload.account_name,
                                account_number: payload.account_number,
                                bank_name: payload.bank_name
                            };
                        }
                        return inv;
                    }));
                } catch (e) {
                    console.warn('Failed to propagate bank info to expected invoices:', e);
                }

                showToast?.('Cập nhật thông tin tổ đội thành công!', 'success');
            } else {
                const dup = teamInfoList.find(t => t.team_name.toLowerCase() === payload.team_name.toLowerCase());
                if (dup) {
                    showToast?.('Tổ đội này đã tồn tại thông tin tài khoản!', 'error');
                    setIsLoaded(true);
                    return;
                }

                const { error } = await supabase
                    .from('team_info')
                    .insert([payload]);

                if (error) throw error;
                showToast?.('Thêm thông tin tổ đội thành công!', 'success');
            }

            setEditingId(null);
            setIsTeamInfoFormOpen(false);
            setTeamInfoForm({ team_name: '', account_name: '', account_number: '', bank_name: '' });
            fetchTeamInfo();
        } catch (err) {
            console.error('Error saving team info:', err);
            let localList = [...teamInfoList];
            const payload = {
                team_name: teamInfoForm.team_name.trim(),
                account_name: teamInfoForm.account_name.trim(),
                account_number: teamInfoForm.account_number.trim(),
                bank_name: teamInfoForm.bank_name.trim()
            };

            if (editingId) {
                localList = localList.map(t => t.id === editingId ? { ...t, ...payload } : t);
            } else {
                const newId = `local_${Date.now()}`;
                localList.push({ id: newId, ...payload });
            }
            setTeamInfoList(localList);
            localStorage.setItem('system_team_info', JSON.stringify(localList));
            
            setEditingId(null);
            setIsTeamInfoFormOpen(false);
            setTeamInfoForm({ team_name: '', account_name: '', account_number: '', bank_name: '' });
            showToast?.('Đã lưu thông tin tổ đội (Local)!', 'success');
        } finally {
            setIsLoaded(true);
        }
    };

    const handleDeleteTeamInfo = async (id) => {
        setIsLoaded(false);
        try {
            if (!id.toString().startsWith('local_')) {
                const { error } = await supabase
                    .from('team_info')
                    .delete()
                    .eq('id', id);
                if (error) throw error;
            }
            
            const newValues = teamInfoList.filter(t => t.id !== id);
            setTeamInfoList(newValues);
            localStorage.setItem('system_team_info', JSON.stringify(newValues));
            showToast?.('Đã xóa thông tin tổ đội!', 'success');
        } catch (err) {
            console.error('Error deleting team info:', err);
            showToast?.('Lỗi khi xóa thông tin tổ đội!', 'error');
        } finally {
            setIsLoaded(true);
            setConfirmDeleteTeamInfoId(null);
        }
    };

    const syncExpectedInvoiceBankInfoToTeamInfo = async (teamName, accountName, accountNumber, bankName) => {
        if (!teamName || (!accountName && !accountNumber && !bankName)) return;
        
        try {
            const existing = teamInfoList.find(t => t.team_name.toLowerCase() === teamName.toLowerCase());
            const payload = {
                team_name: teamName.trim(),
                account_name: (accountName || '').trim(),
                account_number: (accountNumber || '').trim(),
                bank_name: (bankName || '').trim()
            };

            if (existing) {
                const hasChanges = 
                    (payload.account_name && payload.account_name !== existing.account_name) ||
                    (payload.account_number && payload.account_number !== existing.account_number) ||
                    (payload.bank_name && payload.bank_name !== existing.bank_name);
                
                if (hasChanges) {
                    await supabase
                        .from('team_info')
                        .update(payload)
                        .eq('id', existing.id);
                    fetchTeamInfo();
                }
            } else {
                await supabase
                    .from('team_info')
                    .insert([payload]);
                fetchTeamInfo();
            }
        } catch (e) {
            console.warn('Không thể tự động đồng bộ thông tin tài khoản tổ đội sang team_info table:', e);
            let localList = [...teamInfoList];
            const existing = localList.find(t => t.team_name.toLowerCase() === teamName.toLowerCase());
            const payload = {
                team_name: teamName.trim(),
                account_name: (accountName || '').trim(),
                account_number: (accountNumber || '').trim(),
                bank_name: (bankName || '').trim()
            };

            if (existing) {
                localList = localList.map(t => t.team_name.toLowerCase() === teamName.toLowerCase() ? { ...t, ...payload } : t);
            } else {
                localList.push({ id: `local_${Date.now()}`, ...payload });
            }
            setTeamInfoList(localList);
            localStorage.setItem('system_team_info', JSON.stringify(localList));
        }
    };

    useEffect(() => {
        if (isLoaded && invoices.length > 0 && teamInfoList.length > 0) {
            const list = teamInfoList;
            const missingTeams = [];
            invoices.forEach(inv => {
                if (!inv.teamName) return;
                const exists = list.some(t => t.team_name.toLowerCase() === inv.teamName.toLowerCase());
                const hasBankInfo = inv.account_name || inv.account_number || inv.bank_name;
                if (!exists && hasBankInfo) {
                    const alreadyAdded = missingTeams.some(t => t.team_name.toLowerCase() === inv.teamName.toLowerCase());
                    if (!alreadyAdded) {
                        missingTeams.push({
                            team_name: inv.teamName.trim(),
                            account_name: (inv.account_name || '').trim(),
                            account_number: (inv.account_number || '').trim(),
                            bank_name: (inv.bank_name || '').trim()
                        });
                    }
                }
            });

            if (missingTeams.length > 0) {
                const autoSync = async () => {
                    let updated = false;
                    for (const team of missingTeams) {
                        try {
                            const { error } = await supabase.from('team_info').insert([team]);
                            if (!error) updated = true;
                        } catch (e) {
                            console.warn('Lỗi khi chèn tự động tổ đội:', e);
                        }
                    }
                    if (updated) {
                        fetchTeamInfo();
                    }
                };
                autoSync();
            }
        }
    }, [invoices, isLoaded, teamInfoList]);

    const handleManualSyncTeamInfo = async () => {
        setIsLoaded(false);
        try {
            const list = teamInfoList;
            const syncedTeams = [];
            
            invoices.forEach(inv => {
                if (!inv.teamName) return;
                const existing = list.find(t => t.team_name.toLowerCase() === inv.teamName.toLowerCase());
                const hasBankInfo = inv.account_name || inv.account_number || inv.bank_name;
                
                if (hasBankInfo) {
                    const payload = {
                        team_name: inv.teamName.trim(),
                        account_name: (inv.account_name || '').trim(),
                        account_number: (inv.account_number || '').trim(),
                        bank_name: (inv.bank_name || '').trim()
                    };

                    const alreadyInSyncList = syncedTeams.some(t => t.team_name.toLowerCase() === inv.teamName.toLowerCase());
                    if (!alreadyInSyncList) {
                        if (!existing) {
                            syncedTeams.push({ action: 'insert', payload });
                        } else {
                            const hasChanges = 
                                (payload.account_name && payload.account_name !== existing.account_name) ||
                                (payload.account_number && payload.account_number !== existing.account_number) ||
                                (payload.bank_name && payload.bank_name !== existing.bank_name);
                            if (hasChanges) {
                                syncedTeams.push({ action: 'update', id: existing.id, payload });
                            }
                        }
                    }
                }
            });

            if (syncedTeams.length === 0) {
                showToast?.('Thông tin tài khoản của các tổ đội đã được đồng bộ đầy đủ!', 'info');
                setIsLoaded(true);
                return;
            }

            let count = 0;
            for (const item of syncedTeams) {
                try {
                    if (item.action === 'insert') {
                        const { error } = await supabase.from('team_info').insert([item.payload]);
                        if (!error) count++;
                    } else {
                        const { error } = await supabase.from('team_info').update(item.payload).eq('id', item.id);
                        if (!error) count++;
                    }
                } catch (e) {
                    console.warn('Lỗi khi đồng bộ tổ đội:', e);
                }
            }

            await fetchTeamInfo();
            showToast?.(`Đã đồng bộ thành công ${count} tổ đội từ Giá Trị Tổ Đội!`, 'success');
        } catch (err) {
            console.error(err);
            showToast?.('Lỗi xảy ra trong quá trình đồng bộ!', 'error');
        } finally {
            setIsLoaded(true);
        }
    };

    const getProjectsForTeam = (teamName) => {
        if (!teamName) return '-';
        const projectSet = new Set();
        
        if (invoices && invoices.length > 0) {
            invoices.forEach(i => {
                if (i.teamName && i.teamName.toLowerCase() === teamName.toLowerCase() && i.projectName) {
                    projectSet.add(i.projectName);
                }
            });
        }
        
        if (transactions && transactions.length > 0) {
            transactions.forEach(t => {
                if (t.recipient && t.recipient.toLowerCase() === teamName.toLowerCase() && t.project_name) {
                    projectSet.add(t.project_name);
                }
            });
        }

        const projectList = [...projectSet].filter(Boolean).sort();
        if (projectList.length === 0) return '-';
        return projectList.join(', ');
    };

    const [collapsedPhases, setCollapsedPhases] = useState({});
    const [collapsedProjects, setCollapsedProjects] = useState({});
    const [isConfirmTransferModalOpen, setIsConfirmTransferModalOpen] = useState(false);
    const [transferInvoice, setTransferInvoice] = useState(null);
    const [transferNote, setTransferNote] = useState('');

    const [filterProject, setFilterProject] = useState('');
    const [filterPhase, setFilterPhase] = useState('');
    const [isCustomPhase, setIsCustomPhase] = useState(false);
    const [isCustomTeamName, setIsCustomTeamName] = useState(false);
    const [isCustomPeriod, setIsCustomPeriod] = useState(false);

    const isSupabaseUuid = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ''));

    const moveExpectedInvoicesToTrash = async (records = []) => {
        const validRecords = records.filter(Boolean);
        if (validRecords.length === 0) return;
        const trashRecords = validRecords.map(record => ({
            original_table: 'expected_invoices',
            record_data: JSON.stringify(record),
            deleted_by: currentUser?.username || 'unknown',
            deleted_at: new Date().toISOString()
        }));

        try {
            const { error } = await supabase.from('trash_bin').insert(trashRecords);
            if (error) throw error;
        } catch(e) {
            const saved = localStorage.getItem('system_trash_bin');
            const parsed = saved ? JSON.parse(saved) : [];
            trashRecords.forEach((tr, idx) => parsed.unshift({ ...tr, id: `local_${Date.now()}_${idx}` }));
            localStorage.setItem('system_trash_bin', JSON.stringify(parsed));
        }
    };

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

    const availableInvoiceMonths = useMemo(() => {
        const months = new Set();
        invoices.forEach(inv => {
            const monthValue = normalizeMonthValue(inv.invoice_month || inv.created_at?.slice(0, 7) || '');
            if (monthValue) months.add(monthValue);
        });
        return Array.from(months).sort().reverse();
    }, [invoices]);

    const allPeriods = useMemo(() => {
        const periodMap = new Map();
        invoices.forEach(i => {
            if (i.payment_period) {
                const period = i.payment_period;
                const isClosed = i.is_completed || i.is_closed || i.accountant_approved;
                if (!periodMap.has(period)) {
                    periodMap.set(period, isClosed);
                } else {
                    if (!isClosed) {
                        periodMap.set(period, false);
                    }
                }
            }
        });

        const activePeriods = [];
        periodMap.forEach((isClosed, period) => {
            if (!isClosed) {
                activePeriods.push(period);
            }
        });

        if (formData?.payment_period && !activePeriods.includes(formData.payment_period)) {
            activePeriods.push(formData.payment_period);
        }

        return activePeriods.sort();
    }, [invoices, formData?.payment_period]);

    useEffect(() => {
        try {
            localStorage.setItem(CUSTOMER_DEBT_COLUMN_STORAGE_KEY, JSON.stringify(customerDebtVisibleColumns));
        } catch(e) {}
    }, [customerDebtVisibleColumns]);

    async function fetchInvoices() {
        try {
            const { data: dbData, error } = await supabase
                .from('expected_invoices')
                .select('*')
                .order('created_at', { ascending: true });
            
            if (error) throw error;
            
            // Lấy dữ liệu từ localStorage để đồng bộ (nếu có)
            const saved = localStorage.getItem(EXPECTED_INVOICES_STORAGE_KEY);
            let localInvoices = [];
            if (saved) {
                try {
                    localInvoices = JSON.parse(saved) || [];
                } catch (e) {}
            }

            localInvoices = dedupeExpectedInvoices(localInvoices);

            const dbDataNonNull = dbData || [];
            const normalizedDbData = dedupeExpectedInvoices(dbDataNonNull);
            const syncedAccountRows = await syncLocalTeamAccountInfoToSupabase(normalizedDbData, localInvoices);
            if (syncedAccountRows > 0) {
                showToast?.(`Da dong bo ${syncedAccountRows} dong STK/Ten TK len du lieu chung.`, 'success');
            }

            // Supabase is the source of truth. Local rows are only a browser backup
            // for total fetch failure, never merged into a successful DB response.
            setInvoices(normalizedDbData);
            return;
        } catch (error) {
            console.warn('Supabase fetch failed. Falling back to localStorage.', error);
            const saved = localStorage.getItem(EXPECTED_INVOICES_STORAGE_KEY);
            if (saved) {
                try {
                    setInvoices(dedupeExpectedInvoices(JSON.parse(saved)));
                } catch (e) {
                    console.error('Error parsing expected invoices', e);
                }
            }
        } finally {
            setIsLoaded(true);
        }
    }

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchInvoices();
            fetchTeamInfo();
        }, 0);
        return () => clearTimeout(timer);
    }, []);

    function loadFromLocal() {
        const saved = localStorage.getItem(EXPECTED_INVOICES_STORAGE_KEY);
        if (saved) {
            try {
                setInvoices(JSON.parse(saved));
            } catch (e) {
                console.error('Error parsing expected invoices', e);
            }
        }
    }

    useEffect(() => {
        if (isLoaded) {
            const saved = localStorage.getItem(EXPECTED_INVOICES_STORAGE_KEY);
            let previousInvoices = [];
            if (saved) {
                try {
                    previousInvoices = JSON.parse(saved) || [];
                } catch (e) {}
            }

            const normalizedInvoices = dedupeExpectedInvoices(invoices);
            if (shouldBlockExpectedInvoiceOverwrite(previousInvoices, normalizedInvoices)) {
                quarantineExpectedInvoices(previousInvoices, normalizedInvoices);
                showToast?.('Đã chặn ghi đè dữ liệu tổ đội bất thường. Bản cũ vẫn được giữ an toàn.', 'error');
                return;
            }

            saveExpectedInvoiceBackup(previousInvoices, 'before_local_save');
            localStorage.setItem(EXPECTED_INVOICES_STORAGE_KEY, JSON.stringify(normalizedInvoices));
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
        
        const preTax = parseFloat(parseVietnameseNumber(formData.preTaxValue)) || 0;
        const vat = parseFloat(parseVietnameseNumber(formData.vatAmount)) || 0;
        const postTax = parseFloat(parseVietnameseNumber(formData.postTaxValue)) || 0;
        const teamVal = parseFloat(parseVietnameseNumber(formData.teamValue)) || 0;
        const accAdv = parseFloat(parseVietnameseNumber(formData.accumulatedAdvance)) || 0;
        const normalizedInvoiceMonth = normalizeMonthValue(formData.invoice_month) || getCurrentMonthValue();

        const buildRecord = () => ({
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
            deductionAmount: formData.deductionAmount ? parseInt(formData.deductionAmount.toString().replace(/\D/g, '')) : 0,
            invoice_month: normalizedInvoiceMonth
        });

        if (activeSubTab === 'team') {
            const teamExistsInProject = invoices.some(i => 
                i.id !== editingId &&
                i.projectName === formData.projectName && 
                i.teamName && 
                i.teamName.trim().toLowerCase() === (formData.teamName || '').trim().toLowerCase()
            );
            if (teamExistsInProject) {
                const errMsg = `Tổ đội "${formData.teamName}" đã tồn tại trong công trình "${formData.projectName}"! Không thể tạo trùng lặp.`;
                if (showToast) showToast(errMsg, 'error');
                else alert(errMsg);
                return;
            }
        }

        try {
            if (editingId) {
                const updatedRecord = buildRecord();
                const { data, error } = await supabase
                    .from('expected_invoices')
                    .update(updatedRecord)
                    .eq('id', editingId)
                    .select();

                if (error) {
                    console.error('Supabase update failed:', error);
                    if (showToast) showToast('Chua luu duoc len du lieu chung. Vui long thu lai hoac bao admin kiem tra ket noi.', 'error');
                    else alert('Chua luu duoc len du lieu chung. Vui long thu lai hoac bao admin kiem tra ket noi.');
                    return;
                }

                setInvoices(prev => prev.map(inv => 
                    inv.id === editingId ? { ...inv, ...updatedRecord } : inv
                ));
            } else {
                const newRecord = buildRecord();
                const existingDuplicate = invoices.find(inv => getExpectedInvoiceKey(inv) === getExpectedInvoiceKey(newRecord));

                if (existingDuplicate?.id) {
                    if (showToast) showToast(`Đợt ${newRecord.phase || ''} của công trình ${newRecord.projectName || ''} trong tháng ${formatMonthLabel(newRecord.invoice_month)} đã tồn tại!`, 'error');
                    else alert(`Đợt ${newRecord.phase || ''} của công trình ${newRecord.projectName || ''} trong tháng ${formatMonthLabel(newRecord.invoice_month)} đã tồn tại!`);
                    return;
                } else {
                    const { data, error } = await supabase
                        .from('expected_invoices')
                        .insert([newRecord])
                        .select();

                    if (error) {
                        console.error('Supabase insert failed:', error);
                        if (showToast) showToast('Chua luu duoc len du lieu chung. Vui long thu lai hoac bao admin kiem tra ket noi.', 'error');
                        else alert('Chua luu duoc len du lieu chung. Vui long thu lai hoac bao admin kiem tra ket noi.');
                        return;
                    } else if (data && data.length > 0) {
                        setInvoices(prev => dedupeExpectedInvoices([...prev, data[0]]));
                    }
                }
            }
            if (activeSubTab === 'team') {
                syncExpectedInvoiceBankInfoToTeamInfo(
                    formData.teamName,
                    formData.account_name,
                    formData.account_number,
                    formData.bank_name
                );
            }
            resetForm();
        } catch (error) {
            console.error('Error in handleSave:', error);
            if (showToast) showToast('Có lỗi xảy ra khi lưu dữ liệu!', 'error');
            else alert('Có lỗi xảy ra khi lưu dữ liệu!');
        }
    };

    const resetForm = () => {
        setIsFormOpen(false);
        setEditingId(null);
        setIsCustomPhase(false);
        setIsCustomTeamName(false);
        setIsCustomPeriod(false);
        setFormData({ projectName: '', preTaxValue: '', vatAmount: '', postTaxValue: '', teamValue: '', accumulatedAdvance: '', teamName: '', phase: '', note: '', payment_period: '', account_name: '', account_number: '', bank_name: '', deductionAmount: '', invoice_month: getCurrentMonthValue() });
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
            deductionAmount: inv.deductionAmount ? inv.deductionAmount.toLocaleString('en-US') : '',
            invoice_month: normalizeMonthValue(inv.invoice_month || inv.created_at?.slice(0, 7) || '')
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
            
            const ids = periodInvoices.map(inv => inv.id);
            await supabase
                .from('expected_invoices')
                .update(updatePayload)
                .in('id', ids);
            
            setInvoices(prev => prev.map(inv => {
                if (periodInvoices.find(p => p.id === inv.id)) {
                    return { ...inv, ...updatePayload };
                }
                return inv;
            }));
            setConfirmPeriodAction(null);
        } catch (error) {
            console.error('Error toggling period:', error);
            if (showToast) showToast('Có lỗi xảy ra!', 'error');
            else alert('Có lỗi xảy ra!');
        }
    };

    const handleConfirmTransfer = async () => {
        if (!transferInvoice) return;
        try {
            const { data, error } = await supabase
                .from('expected_invoices')
                .update({
                    cashier_approved: true,
                    cashier_note: 'Đã thanh toán'
                })
                .eq('id', transferInvoice.id)
                .select();

            if (error) throw error;

            if (showToast) showToast('Xác nhận chuyển khoản thành công!', 'success');
            else alert('Xác nhận chuyển khoản thành công!');
            
            setInvoices(prev => prev.map(inv => 
                inv.id === transferInvoice.id 
                    ? { ...inv, cashier_approved: true, cashier_note: transferNote } 
                    : inv
            ));
            setIsConfirmTransferModalOpen(false);
            setTransferInvoice(null);
            setTransferNote('');
        } catch (err) {
            console.error('Failed to confirm transfer:', err);
            if (showToast) showToast('Không thể xác nhận chuyển khoản. Vui lòng thử lại.', 'error');
            else alert('Không thể xác nhận chuyển khoản. Vui lòng thử lại.');
        }
    };

    const handleRenamePeriod = async (oldPeriod, periodInvoices) => {
        if (!newPeriodName.trim() || newPeriodName === oldPeriod) {
            setEditingPeriodName(null);
            return;
        }
        
        if (allPeriods.includes(newPeriodName)) {
            setRenameError('Tên kỳ thanh toán này đã tồn tại!');
            return;
        }

        try {
            const ids = periodInvoices.map(inv => inv.id);
            for (const id of ids) {
                await supabase
                    .from('expected_invoices')
                    .update({ payment_period: newPeriodName })
                    .eq('id', id);
            }
            
            setInvoices(prev => prev.map(inv => 
                ids.includes(inv.id) ? { ...inv, payment_period: newPeriodName } : inv
            ));
            
            setEditingPeriodName(null);
        } catch (error) {
            console.error('Error renaming period:', error);
            if (showToast) showToast('Có lỗi xảy ra khi đổi tên!', 'error');
            else alert('Có lỗi xảy ra khi đổi tên!');
        }
    };

    const handleClonePeriod = async (sourcePeriod, targetPeriod) => {
        if (!sourcePeriod || !targetPeriod || targetPeriod.trim() === '') return;
        if (allPeriods.includes(targetPeriod.trim())) {
            if (showToast) showToast('Tên kỳ thanh toán này đã tồn tại!', 'error');
            else alert('Tên kỳ thanh toán này đã tồn tại!');
            return;
        }

        try {
            const periodInvoices = invoices.filter(inv => inv.payment_period === sourcePeriod);
            const newInvoices = periodInvoices.map(inv => {
                return {
                    projectName: inv.projectName,
                    phase: inv.phase,
                    teamName: inv.teamName,
                    preTaxValue: 0,
                    deductionAmount: 0,
                    accumulatedAdvance: 0,
                    teamValue: 0,
                    account_name: inv.account_name,
                    account_number: inv.account_number,
                    bank_name: inv.bank_name,
                    note: inv.note,
                    payment_period: targetPeriod.trim(),
                    qs_approved: false,
                    accountant_approved: false,
                    is_completed: false
                };
            });

            const { data, error } = await supabase
                .from('expected_invoices')
                .insert(newInvoices)
                .select();
            
            if (error) {
                console.error('Error inserting cloned invoices:', error);
                if (showToast) showToast('Có lỗi xảy ra khi nhân bản!', 'error');
                else alert('Có lỗi xảy ra khi nhân bản!');
            } else if (data) {
                const formattedNew = data.map(d => ({
                    id: d.id,
                    projectName: d.projectName,
                    phase: d.phase,
                    teamName: d.teamName,
                    preTaxValue: d.preTaxValue,
                    vatAmount: d.vatAmount,
                    postTaxValue: d.postTaxValue,
                    deductionAmount: d.deductionAmount,
                    accumulatedAdvance: d.accumulatedAdvance,
                    teamValue: d.teamValue,
                    account_name: d.account_name,
                    account_number: d.account_number,
                    bank_name: d.bank_name,
                    note: d.note,
                    created_at: d.created_at,
                    payment_period: d.payment_period,
                    qs_approved: d.qs_approved,
                    accountant_approved: d.accountant_approved,
                    is_completed: d.is_completed
                }));
                setInvoices(prev => [...prev, ...formattedNew]);
                if (showToast) showToast('Nhân bản kỳ thanh toán thành công!', 'success');
                else alert('Nhân bản kỳ thanh toán thành công!');
                setIsClonePeriodModalOpen(false);
                setCloneSourcePeriod('');
                setCloneTargetPeriod('');
            }
        } catch (error) {
            console.error('Error cloning period:', error);
        }
    };

    const handleDeletePeriod = (periodName, periodInvoices) => {
        setDeletePeriodState({ isOpen: true, periodName, periodInvoices, password: '', error: '' });
    };

    const confirmDeletePeriod = async () => {
        if (!deletePeriodState.password) {
            setDeletePeriodState(prev => ({ ...prev, error: 'Vui lòng nhập mật khẩu!' }));
            return;
        }
        if (!deletePeriodState.password || deletePeriodState.password !== adminPassword) {
            setDeletePeriodState(prev => ({ ...prev, error: 'Mật khẩu không chính xác!' }));
            return;
        }

        try {
            const ids = deletePeriodState.periodInvoices.map(inv => inv.id);
            const dbIds = ids.filter(isSupabaseUuid);
            await moveExpectedInvoicesToTrash(deletePeriodState.periodInvoices);

            if (dbIds.length > 0) {
                const { error } = await supabase
                    .from('expected_invoices')
                    .delete()
                    .in('id', dbIds);
                if (error) throw error;
            }
            setInvoices(prev => prev.filter(inv => !ids.includes(inv.id)));
            if (showToast) showToast('Đã xóa toàn bộ dữ liệu trong kỳ!', 'success');
            setDeletePeriodState({ isOpen: false, periodName: '', periodInvoices: [], password: '', error: '' });
        } catch (error) {
            console.error('Error deleting period:', error);
            if (showToast) showToast('Có lỗi xảy ra khi xóa kỳ thanh toán!', 'error');
            setDeletePeriodState(prev => ({ ...prev, error: 'Lỗi server khi xóa!' }));
        }
    };

    const handleBulkAddByMonth = async () => {
        if (!bulkAddMonth) return;
        
        try {
            const matchedIncomes = incomes.filter(inc => {
                if (!inc.date) return false;
                return inc.date.startsWith(bulkAddMonth);
            });

            if (matchedIncomes.length === 0) {
                if (showToast) showToast(`Không tìm thấy đợt thanh toán nào trong tháng ${bulkAddMonth}!`, 'error');
                return;
            }

            const newRecords = [];
            for (const inc of matchedIncomes) {
                const exists = invoices.some(inv => 
                    inv.projectName === inc.project_name && 
                    inv.phase === inc.phase
                );
                if (!exists) {
                    newRecords.push({
                        projectName: inc.project_name,
                        preTaxValue: inc.amount || 0,
                        vatAmount: inc.vat_amount || 0,
                        postTaxValue: inc.post_tax_amount || 0,
                        teamValue: 0,
                        accumulatedAdvance: 0,
                        teamName: '',
                        phase: inc.phase,
                        note: '',
                        payment_period: '',
                        account_name: '',
                        account_number: '',
                        bank_name: '',
                        deductionAmount: 0,
                        qs_approved: false,
                        accountant_approved: false,
                        is_completed: false
                    });
                }
            }

            if (newRecords.length === 0) {
                if (showToast) showToast('Tất cả hóa đơn trong tháng này đã tồn tại trong danh sách!', 'error');
                return;
            }

            const { data, error } = await supabase
                .from('expected_invoices')
                .insert(newRecords)
                .select();
            
            if (error) {
                console.error('Error bulk inserting:', error);
                if (showToast) showToast('Có lỗi xảy ra khi thêm hàng loạt!', 'error');
            } else if (data) {
                const formattedNew = data.map(d => ({
                    id: d.id,
                    projectName: d.projectName,
                    phase: d.phase,
                    teamName: d.teamName,
                    preTaxValue: d.preTaxValue,
                    vatAmount: d.vatAmount,
                    postTaxValue: d.postTaxValue,
                    deductionAmount: d.deductionAmount,
                    accumulatedAdvance: d.accumulatedAdvance,
                    teamValue: d.teamValue,
                    account_name: d.account_name,
                    account_number: d.account_number,
                    bank_name: d.bank_name,
                    note: d.note,
                    created_at: d.created_at,
                    payment_period: d.payment_period,
                    qs_approved: d.qs_approved,
                    accountant_approved: d.accountant_approved,
                    is_completed: d.is_completed
                }));
                setInvoices(prev => [...prev, ...formattedNew]);
                if (showToast) showToast(`Đã thêm thành công ${newRecords.length} hóa đơn!`, 'success');
                setIsBulkAddModalOpen(false);
                setBulkAddMonth('');
            }
        } catch (err) {
            console.error('Error in bulk add:', err);
        }
    };

    const handleBulkAddByMonthV2 = async () => {
        if (!bulkAddMonth) return;

        try {
            const matchedIncomes = incomes.filter(inc => inc.date && inc.date.startsWith(bulkAddMonth));

            if (matchedIncomes.length === 0) {
                if (showToast) showToast(`Không tìm thấy đợt thanh toán nào trong tháng ${bulkAddMonth}!`, 'error');
                return;
            }

            const payloads = matchedIncomes.map(inc => {
                const candidate = {
                    projectName: inc.project_name,
                    preTaxValue: inc.amount || 0,
                    vatAmount: inc.vat_amount || 0,
                    postTaxValue: inc.post_tax_amount || 0,
                    teamValue: 0,
                    accumulatedAdvance: 0,
                    teamName: '',
                    phase: inc.phase,
                    invoice_month: bulkAddMonth,
                    note: '',
                    payment_period: '',
                    account_name: '',
                    account_number: '',
                    bank_name: '',
                    deductionAmount: 0,
                    qs_approved: false,
                    accountant_approved: false,
                    is_completed: false
                };
                const duplicate = invoices.find(inv => getExpectedInvoiceKey(inv) === getExpectedInvoiceKey(candidate));
                return { ...candidate, _duplicateId: duplicate?.id || null };
            });

            const inserts = payloads.filter(item => !item._duplicateId);
            const duplicates = payloads.filter(item => item._duplicateId);

            if (inserts.length === 0) {
                if (showToast) showToast(`Các đợt trong tháng ${formatMonthLabel(bulkAddMonth)} đã tồn tại!`, 'error');
                return;
            }

            if (inserts.length > 0) {
                const { data, error } = await supabase
                    .from('expected_invoices')
                    .insert(inserts.map(({ _duplicateId, ...record }) => record))
                    .select();

                if (error) {
                    console.error('Error bulk inserting:', error);
                    if (showToast) showToast('Có lỗi xảy ra khi thêm hàng loạt!', 'error');
                    return;
                }

                if (data) {
                    setInvoices(prev => dedupeExpectedInvoices([...prev, ...data]));
                }
            }

            if (showToast) {
                const duplicateText = duplicates.length > 0 ? ` Bỏ qua ${duplicates.length} đợt đã tồn tại.` : '';
                showToast(`Đã thêm ${inserts.length} hóa đơn tháng ${formatMonthLabel(bulkAddMonth)}.${duplicateText}`, 'success');
            }
            setIsBulkAddModalOpen(false);
            setBulkAddMonth('');
        } catch (err) {
            console.error('Error in bulk add:', err);
        }
    };

    const handleDeleteClick = (inv) => {
        const isAuthorizer = currentUser?.role?.toUpperCase() === 'ADMIN';
        if (isAuthorizer) {
            setConfirmDeleteId(inv.id);
        } else {
            setRequestDeleteInvoice(inv);
        }
    };

    const submitDeleteRequest = async (reason) => {
        if (!requestDeleteInvoice) return;
        try {
            const inv = requestDeleteInvoice;
            const recordName = `Dự kiến: ${inv.projectName || ''} - ${inv.teamName || 'HĐ'} - ${inv.phase || ''}`;
            const { error } = await supabase.from('delete_requests').insert([{
                original_table: 'expected_invoices',
                record_id: inv.id,
                record_name: recordName,
                requested_by: currentUser?.username || 'unknown',
                reason: reason.trim(),
                status: 'pending'
            }]);
            if (error) throw error;
            if (showToast) showToast('Đã gửi đề nghị xóa dự kiến tới Admin/QS Trưởng!', 'success');
        } catch (error) {
            if (showToast) showToast('Lỗi khi gửi đề nghị xóa: ' + (error.message || 'không rõ lỗi'), 'error');
        } finally {
            setRequestDeleteInvoice(null);
        }
    };

    const confirmDelete = async () => {
        if (!confirmDeleteId) return;
        try {
            const record = invoices.find(inv => inv.id === confirmDeleteId);
            await moveExpectedInvoicesToTrash(record ? [record] : []);

            if (isSupabaseUuid(confirmDeleteId)) {
                const { error } = await supabase
                    .from('expected_invoices')
                    .delete()
                    .eq('id', confirmDeleteId);
                if (error) throw error;
            }

            setInvoices(prev => prev.filter(inv => inv.id !== confirmDeleteId));
            if (showToast) showToast('Đã xóa hóa đơn dự kiến!', 'success');
        } catch (error) {
            console.error('Error in handleDelete:', error);
            if (showToast) showToast('Xóa thất bại: ' + (error.message || 'không rõ lỗi'), 'error');
        }
        setConfirmDeleteId(null);
    };

    const handleDeleteAll = () => {
        setIsDeleteAllConfirmOpen(true);
    };

    const confirmDeleteAll = async (password) => {
        if (deleteAllTargetInvoices.length === 0) {
            setIsDeleteAllConfirmOpen(false);
            return;
        }

        if (!password || password !== adminPassword) {
            alert('Mật khẩu xác nhận không chính xác!');
            setIsDeleteAllConfirmOpen(false);
            return;
        }
        
        try {
            const idsToDelete = deleteAllTargetInvoices.map(inv => inv.id);
            const dbIdsToDelete = idsToDelete.filter(isSupabaseUuid);
            await moveExpectedInvoicesToTrash(deleteAllTargetInvoices);

            if (dbIdsToDelete.length > 0) {
                const { error } = await supabase
                    .from('expected_invoices')
                    .delete()
                    .in('id', dbIdsToDelete);
                if (error) throw error;
            }
            
            setInvoices(prev => prev.filter(inv => !idsToDelete.includes(inv.id)));
            if (showToast) showToast('Đã xóa tất cả các hóa đơn dự kiến đang hiển thị!', 'success');
        } catch (error) {
            console.error('Error in confirmDeleteAll:', error);
            if (showToast) showToast('Xóa thất bại: ' + (error.message || 'không rõ lỗi'), 'error');
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

    const updateInvoicePdfUrl = (id, pdfUrl) => {
        setInvoices(prev => prev.map(inv => (
            inv.id === id ? { ...inv, team_pdf_url: pdfUrl } : inv
        )));
    };

    const getInvoicePeriod = (inv) => inv.payment_period || inv.phase || 'Chưa phân kỳ';

    const updateProjectPdfUrl = (projectName, period, pdfUrl) => {
        setInvoices(prev => prev.map(inv => (
            (!projectName || inv.projectName === projectName) && getInvoicePeriod(inv) === period
                ? { ...inv, project_pdf_url: pdfUrl }
                : inv
        )));
    };

    const handleUploadTeamPdf = async (e, inv) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            if (showToast) showToast('Vui lòng chọn file PDF!', 'error');
            e.target.value = '';
            return;
        }

        setUploadingPdfId(inv.id);
        try {
            const originalName = file.name.replace(/\.[^/.]+$/, '') || 'team_pdf';
            const sanitizedName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
            const sanitizedProject = (inv.projectName || 'project').replace(/[^a-zA-Z0-9.\-_]/g, '_');
            const sanitizedTeam = (inv.teamName || 'team').replace(/[^a-zA-Z0-9.\-_]/g, '_');
            const fileStamp = `${file.lastModified}_${file.size}`;
            const filePath = `${sanitizedProject}/team-values/${sanitizedTeam}_${inv.id}_${fileStamp}_${sanitizedName}.pdf`;

            const { error: uploadError } = await supabase.storage
                .from('invoices')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) {
                throw new Error(
                    uploadError.message === 'Bucket not found'
                        ? 'Không tìm thấy bucket "invoices". Hãy tạo bucket public tên "invoices" trong Supabase Storage.'
                        : uploadError.message
                );
            }

            const { data: { publicUrl } } = supabase.storage
                .from('invoices')
                .getPublicUrl(filePath);

            const { error } = await supabase
                .from('expected_invoices')
                .update({ team_pdf_url: publicUrl })
                .eq('id', inv.id);

            if (error) throw error;

            updateInvoicePdfUrl(inv.id, publicUrl);
            if (showToast) showToast('Tải lên PDF thành công!', 'success');
        } catch (err) {
            console.error('Error uploading team PDF:', err);
            if (showToast) showToast(err.message || 'Lỗi khi tải lên PDF!', 'error');
        } finally {
            setUploadingPdfId(null);
            e.target.value = '';
        }
    };

    const handleDeleteTeamPdf = async (inv) => {
        const pdfUrl = inv.team_pdf_url || inv.pdf_url;
        try {
            if (pdfUrl && pdfUrl.includes('/public/invoices/')) {
                const parts = pdfUrl.split('/public/invoices/');
                if (parts.length > 1) {
                    const filePath = decodeURIComponent(parts[1]);
                    const { error: storageError } = await supabase.storage.from('invoices').remove([filePath]);
                    if (storageError) console.warn('Error deleting team PDF from storage:', storageError);
                }
            }

            const { error } = await supabase
                .from('expected_invoices')
                .update({ team_pdf_url: null })
                .eq('id', inv.id);

            if (error) throw error;

            updateInvoicePdfUrl(inv.id, null);
            if (showToast) showToast('Đã xóa PDF!', 'success');
        } catch (err) {
            console.error('Error deleting team PDF:', err);
            if (showToast) showToast(err.message || 'Lỗi khi xóa PDF!', 'error');
        } finally {
            setConfirmDeletePdf(null);
        }
    };

    const handleUploadProjectPdf = async (e, projectName, period) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            if (showToast) showToast('Vui lòng chọn file PDF!', 'error');
            e.target.value = '';
            return;
        }

        const key = `${projectName}__${period}`;
        setUploadingProjectPdfKey(key);
        try {
            const originalName = file.name.replace(/\.[^/.]+$/, '') || 'project_pdf';
            const sanitizedName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
            const sanitizedProject = (projectName || 'tong_ky').replace(/[^a-zA-Z0-9.\-_]/g, '_');
            const sanitizedPeriod = (period || 'period').replace(/[^a-zA-Z0-9.\-_]/g, '_');
            const fileStamp = `${file.lastModified}_${file.size}`;
            const filePath = `${sanitizedProject}/project-total/${sanitizedPeriod}_${fileStamp}_${sanitizedName}.pdf`;

            const { error: uploadError } = await supabase.storage.from('invoices').upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('invoices').getPublicUrl(filePath);
            const ids = invoices
                .filter(inv => (!projectName || inv.projectName === projectName) && getInvoicePeriod(inv) === period)
                .map(inv => inv.id);

            const { error } = await supabase
                .from('expected_invoices')
                .update({ project_pdf_url: publicUrl })
                .in('id', ids);
            if (error) throw error;

            updateProjectPdfUrl(projectName, period, publicUrl);
            if (showToast) showToast('Tải lên PDF tổng công trình thành công!', 'success');
        } catch (err) {
            console.error('Error uploading project PDF:', err);
            if (showToast) showToast(err.message || 'Lỗi khi tải lên PDF tổng công trình!', 'error');
        } finally {
            setUploadingProjectPdfKey(null);
            e.target.value = '';
        }
    };

    const handleDeleteProjectPdf = async (projectName, period, pdfUrl) => {
        try {
            if (pdfUrl && pdfUrl.includes('/public/invoices/')) {
                const parts = pdfUrl.split('/public/invoices/');
                if (parts.length > 1) {
                    const filePath = decodeURIComponent(parts[1]);
                    const { error: storageError } = await supabase.storage.from('invoices').remove([filePath]);
                    if (storageError) console.warn('Error deleting project PDF from storage:', storageError);
                }
            }

            const ids = invoices
                .filter(inv => (!projectName || inv.projectName === projectName) && getInvoicePeriod(inv) === period)
                .map(inv => inv.id);
            const { error } = await supabase
                .from('expected_invoices')
                .update({ project_pdf_url: null })
                .in('id', ids);
            if (error) throw error;

            updateProjectPdfUrl(projectName, period, null);
            if (showToast) showToast('Đã xóa PDF tổng công trình!', 'success');
        } catch (err) {
            console.error('Error deleting project PDF:', err);
            if (showToast) showToast(err.message || 'Lỗi khi xóa PDF tổng công trình!', 'error');
        } finally {
            setConfirmDeleteProjectPdf(null);
        }
    };

    const changeTableZoom = (delta) => {
        setTableZoom(prev => Math.min(1.25, Math.max(0.45, Number((prev + delta).toFixed(2)))));
    };

    const invoiceMatchesCurrentScope = (inv) => {
        if (activeSubTab === 'invoice') {
            if (String(inv.teamName || '').trim() || String(inv.payment_period || '').trim()) return false;
            if (!inv.postTaxValue && !inv.expectedValue && !inv.preTaxValue && !inv.vatAmount) return false;
        } else if (activeSubTab === 'team') {
            if (!inv.teamValue && !inv.teamName) return false;
            if (inv.accountant_approved) return false;
            if ((currentUser?.role?.toUpperCase() === 'ACCOUNTANT' || currentUser?.role?.toUpperCase()?.startsWith('KẾ TOÁN')) && !inv.qs_approved) return false;
        } else if (activeSubTab === 'history_team') {
            if (!inv.teamValue && !inv.teamName) return false;
            if (!inv.accountant_approved) return false;
        }

        if (filterProject && inv.projectName !== filterProject) return false;
        if (filterPhase && inv.phase !== filterPhase) return false;
        if (activeSubTab === 'invoice' && filterInvoiceMonth && normalizeMonthValue(inv.invoice_month || inv.created_at?.slice(0, 7) || '') !== filterInvoiceMonth) return false;
        return true;
    };

    const deleteAllTargetInvoices = invoices.filter(invoiceMatchesCurrentScope);

    let filteredInvoices = invoices.filter(inv => {
        if (!invoiceMatchesCurrentScope(inv)) return false;

        const term = searchTerm.trim().toLowerCase();
        if (!term) return true;

        return (
            (inv.projectName || '').toLowerCase().includes(term) ||
            (inv.phase || '').toLowerCase().includes(term) ||
            (inv.teamName || '').toLowerCase().includes(term) ||
            (inv.account_name || '').toLowerCase().includes(term) ||
            (inv.account_number || '').toLowerCase().includes(term) ||
            (inv.bank_name || '').toLowerCase().includes(term) ||
            (inv.created_by || '').toLowerCase().includes(term) ||
            (inv.note || '').toLowerCase().includes(term) ||
            (formatMonthLabel(inv.invoice_month || inv.created_at?.slice(0, 7) || '')).toLowerCase().includes(term) ||
            (projectDetails?.[inv.projectName]?.contractNo || '').toLowerCase().includes(term)
        );
    });

    if (activeSubTab === 'history_team') {
        filteredInvoices.sort((a, b) => (a.projectName || '').localeCompare(b.projectName || ''));
    }

    const isPrintableTeamRow = useCallback((inv) => {
        if (hideZeroRowsOnPrint && !(parseFloat(inv.teamValue) || 0)) return false;
        return true;
    }, [hideZeroRowsOnPrint]);
    const getPrintableTeamRows = useCallback((rows = []) => rows.filter(isPrintableTeamRow), [isPrintableTeamRow]);

    const printPeriods = [...new Set(filteredInvoices.map(inv => getInvoicePeriod(inv)).filter(Boolean))];
    const printPeriodTitle = printPeriods.length === 1 ? printPeriods[0] : 'TẤT CẢ CÁC KỲ';
    const hasLongPrintNotes = filteredInvoices.some(inv => (inv.note || '').trim().length > 12);
    const teamPrintLayout = useMemo(() => {
        if (activeSubTab !== 'team' && activeSubTab !== 'history_team') {
            return {
                rowCount: 10,
                fontSize: 8.2,
                headerFontSize: 8.2,
                summaryFontSize: 9.2,
                cellPaddingY: 3,
                cellPaddingX: 6,
            };
        }

        const grouped = filteredInvoices.reduce((acc, inv) => {
            const period = inv.payment_period || inv.phase || 'Chưa phân kỳ';
            if (!acc[period]) acc[period] = {};
            const proj = inv.projectName || 'Khác';
            if (!acc[period][proj]) acc[period][proj] = [];
            acc[period][proj].push(inv);
            return acc;
        }, {});

        const rowCount = Object.entries(grouped).reduce((sum, [period, projectGroups]) => {
            if (collapsedPhases[period]) return sum;

            const periodRows = Object.values(projectGroups).flat();
            const visiblePeriodRows = getPrintableTeamRows(periodRows);

            let periodCount = visiblePeriodRows.length > 0 ? 1 : 0; // Period header
            Object.values(projectGroups).forEach(rows => {
                const visibleRows = getPrintableTeamRows(rows);
                if (visibleRows.length > 0) {
                    periodCount += 1 + visibleRows.length; // Project summary + rows
                }
            });

            return sum + periodCount + 1; // Period total
        }, 1); // Table header

        if (rowCount >= 58) {
            return { rowCount, fontSize: 5.9, headerFontSize: 6.4, summaryFontSize: 7.2, cellPaddingY: 1, cellPaddingX: 4 };
        }
        if (rowCount >= 48) {
            return { rowCount, fontSize: 6.4, headerFontSize: 6.8, summaryFontSize: 7.7, cellPaddingY: 1, cellPaddingX: 4 };
        }
        if (rowCount >= 40) {
            return { rowCount, fontSize: 7.0, headerFontSize: 7.4, summaryFontSize: 8.3, cellPaddingY: 2, cellPaddingX: 5 };
        }
        return { rowCount, fontSize: 8.2, headerFontSize: 8.2, summaryFontSize: 9.2, cellPaddingY: 3, cellPaddingX: 6 };
    }, [activeSubTab, filteredInvoices, collapsedPhases, getPrintableTeamRows]);

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
                    invoice_date = sortedInvoices[0].date || '';
                }

                for (const inv of sortedInvoices) {
                    if (inv.note) {
                        try {
                            const parsed = JSON.parse(inv.note);
                            if (parsed && typeof parsed === 'object') {
                                if (!invoice_no && parsed.invoice_no) {
                                    invoice_no = parsed.invoice_no;
                                }
                                if (parsed.invoice_date && (!invoice_date || invoice_date === sortedInvoices[0].date)) {
                                    invoice_date = parsed.invoice_date;
                                }
                                if (parsed.is_offset && phaseHstt === undefined) {
                                    phaseHstt = 0;
                                    if (parsed.invoice_no) invoice_no = parsed.invoice_no;
                                    if (parsed.invoice_date) invoice_date = parsed.invoice_date;
                                } else if ('actual_received_amount' in parsed && phaseHstt === undefined) {
                                    const val = Number(parsed.actual_received_amount) || 0;
                                    phaseHstt = val || inv.post_tax_amount || inv.amount || 0;
                                    if (parsed.invoice_no) invoice_no = parsed.invoice_no;
                                    if (parsed.invoice_date) invoice_date = parsed.invoice_date;
                                }
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
                    const dueDateObj = addBusinessDays(invoice_date, 15);
                    if (dueDateObj) {
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

    const hasCustomerDebtInvoice = useCallback((debt) => Boolean(String(debt.invoice_no || '').trim()), []);
    const isPrintableCustomerDebtRow = useCallback((debt) => (
        !hideUnissuedCustomerDebtRowsOnPrint || hasCustomerDebtInvoice(debt)
    ), [hideUnissuedCustomerDebtRowsOnPrint, hasCustomerDebtInvoice]);
    const getPrintableCustomerDebtRows = useCallback((rows = []) => rows.filter(isPrintableCustomerDebtRow), [isPrintableCustomerDebtRow]);

    const getCollectorGroup = (projectName) => {
        const details = projectDetails[projectName] || {};
        const gc = details.generalContractor || '';
        const inv = details.investor || '';
        if (gc && gc.trim()) return gc.trim();
        if (inv && inv.trim()) return inv.trim();
        return 'CHƯA PHÂN LOẠI';
    };

    const groupedCustomerDebts = useMemo(() => {
        const groups = {};
        filteredCustomerDebts.forEach(debt => {
            const groupName = getCollectorGroup(debt.projectName);
            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(debt);
        });
        
        // Sort groups: 'CHƯA PHÂN LOẠI' last, others alphabetically
        return Object.entries(groups).sort(([a], [b]) => {
            if (a === 'CHƯA PHÂN LOẠI') return 1;
            if (b === 'CHƯA PHÂN LOẠI') return -1;
            return a.localeCompare(b);
        });
    }, [filteredCustomerDebts, projectDetails]);

    const printableFilteredCustomerDebts = getPrintableCustomerDebtRows(filteredCustomerDebts);

    const customerDebtColumns = [
        { key: 'stt', label: 'STT', className: 'w-16 text-center', cellClassName: 'text-center text-slate-500 font-medium' },
        { key: 'name', label: 'Tên', className: 'min-w-[220px] text-center', cellClassName: 'text-center font-bold text-slate-900' },
        { key: 'phase', label: 'Đợt thanh toán', className: 'w-40 text-center', cellClassName: 'text-center font-bold text-slate-700' },
        { key: 'expected', label: 'Cần thu', className: 'w-44 text-center', cellClassName: 'text-center font-black text-slate-800' },
        { key: 'actual', label: 'Đã thu', className: 'w-40 text-center', cellClassName: 'text-center font-black text-emerald-600' },
        { key: 'remaining', label: 'Còn lại', className: 'w-40 text-center', cellClassName: 'text-center font-black text-rose-600' },
        { key: 'dueDate', label: 'Ngày tới hạn', className: 'w-40 text-center', cellClassName: 'text-center font-medium text-slate-700' },
        { key: 'status', label: 'Hạn', className: 'w-32 text-center', cellClassName: 'text-center font-black' },
        { key: 'invoiceNo', label: 'Số HĐ', className: 'w-44 text-center', cellClassName: 'text-center font-bold text-slate-700' },
        { key: 'invoiceDate', label: 'Ngày HĐ', className: 'w-32 text-center', cellClassName: 'text-center font-medium text-slate-700' },
        { key: 'contractNo', label: 'Số hợp đồng', className: 'w-52 text-center', cellClassName: 'text-center font-medium text-slate-700' },
        { key: 'voucherNo', label: 'Số CT', className: 'w-36 text-center', cellClassName: 'text-center font-medium text-slate-700' }
    ];

    const visibleCustomerDebtColumns = customerDebtColumns.filter(col => customerDebtVisibleColumns[col.key] !== false);

    const customerDebtLayout = useMemo(() => {
        const count = visibleCustomerDebtColumns.length || 1;
        if (count <= 6) {
            return { minWidth: 980, fontSize: '14px', headerFontSize: '13px', cellPaddingX: '20px', cellPaddingY: '14px' };
        }
        if (count <= 8) {
            return { minWidth: 1180, fontSize: '13px', headerFontSize: '12px', cellPaddingX: '16px', cellPaddingY: '13px' };
        }
        return { minWidth: 1450, fontSize: '12px', headerFontSize: '11px', cellPaddingX: '12px', cellPaddingY: '12px' };
    }, [visibleCustomerDebtColumns.length]);

    const toggleCustomerDebtColumn = (key) => {
        setCustomerDebtVisibleColumns(prev => ({ ...prev, [key]: prev[key] === false }));
    };

    const renderCustomerDebtCell = (debt, idx, key) => {
        switch (key) {
            case 'stt':
                return idx + 1;
            case 'name':
                return debt.projectName;
            case 'phase':
                return debt.phase || '-';
            case 'expected':
                return `${formatCurrency(debt.expected)} VNĐ`;
            case 'actual':
                return `${formatCurrency(debt.actual)} VNĐ`;
            case 'remaining':
                return `${formatCurrency(debt.remaining)} VNĐ`;
            case 'dueDate':
                return debt.due_date || '-';
            case 'status':
                return (
                    debt.overdue_days > 0 ? (
                        <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-black text-red-700">Trễ {debt.overdue_days} ngày</span>
                    ) : debt.due_date ? (
                        <span className="text-xs font-black text-emerald-600">Trong hạn</span>
                    ) : '-'
                );
            case 'invoiceNo':
                return debt.invoice_no || <span className="font-black text-amber-700">Chưa xuất hóa đơn</span>;
            case 'invoiceDate':
                return debt.invoice_date || '-';
            case 'contractNo': {
                if (!debt.contractNo) return '-';
                try {
                    if (debt.contractNo.startsWith('{')) {
                        const parsed = JSON.parse(debt.contractNo);
                        const parts = [];
                        if (parsed.main_contract) parts.push(`Chính: ${parsed.main_contract}`);
                        if (parsed.sub_contract_1) parts.push(`Phụ 1: ${parsed.sub_contract_1}`);
                        if (parsed.sub_contract_2) parts.push(`Phụ 2: ${parsed.sub_contract_2}`);
                        if (parsed.sub_contract_annex) parts.push(`PL HĐ phụ: ${parsed.sub_contract_annex}`);
                        return parts.length > 0 ? parts.join(' | ') : '-';
                    }
                } catch(e) {}
                return debt.contractNo;
            }
            case 'voucherNo':
                return debt.voucher_no || '-';
            default:
                return '-';
        }
    };

    const availablePhases = useMemo(() => {
        if (activeSubTab === 'customer_debt') {
            return [...new Set(customerDebts.filter(i => !filterProject || i.projectName === filterProject).map(i => i.phase).filter(Boolean))].sort();
        }
        return [...new Set(invoices.filter(i => !filterProject || i.projectName === filterProject).map(i => i.phase).filter(Boolean))].sort();
    }, [activeSubTab, invoices, customerDebts, filterProject]);

    return (
        <div className="w-full mx-auto animate-in fade-in duration-500 font-sans text-slate-800 print:w-full print:max-w-none print:bg-white print:text-black">
            <style dangerouslySetInnerHTML={{__html: `
                @media print {
                    @page { size: A3 landscape; margin: 15mm; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white !important; }
                    .print-table-container { overflow: visible !important; max-height: none !important; }
                }
            `}} />
            <header className="mb-8 flex justify-between items-center print:hidden">
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
                        onClick={() => window.print()}
                        className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-4 py-2 rounded-xl font-bold transition flex items-center gap-2 print:hidden"
                        title="In PDF"
                    >
                        <Printer size={20} />
                        <span className="hidden sm:inline">In</span>
                    </button>
                    <button 
                        onClick={() => exportTableToExcel('expected-invoices-table', 'Du_Kien')}
                        className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-4 py-2 rounded-xl font-bold transition flex items-center gap-2 print:hidden"
                        title="Xuất Excel"
                    >
                        <Download size={20} />
                        <span className="hidden sm:inline">Xuất Excel</span>
                    </button>
                    {activeSubTab === 'team' && (
                        <button 
                            onClick={() => setIsClonePeriodModalOpen(true)}
                            className="bg-purple-50 text-purple-600 hover:bg-purple-100 px-4 py-2 rounded-xl font-bold transition flex items-center gap-2 print:hidden"
                        >
                            <Copy size={20} />
                            <span className="hidden sm:inline">Thêm kỳ mới</span>
                        </button>
                    )}
                    {activeSubTab !== 'customer_debt' && (currentUser?.role?.toUpperCase() === 'ADMIN' || currentUser?.role?.toUpperCase() === 'QS TRƯỞNG') && (
                        <button 
                            onClick={handleDeleteAll}
                            disabled={deleteAllTargetInvoices.length === 0}
                            className={`px-6 py-2.5 rounded-xl font-bold transition flex items-center gap-2 ${deleteAllTargetInvoices.length === 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-red-50 hover:bg-red-100 text-red-600'}`}
                        >
                            <Trash2 size={20} />
                            Xóa tất cả
                        </button>
                    )}
                    {activeSubTab === 'invoice' && (
                        <button 
                            onClick={() => setIsBulkAddModalOpen(true)}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-4 py-2 rounded-xl font-bold transition flex items-center gap-2 shadow-lg shadow-indigo-600/10"
                        >
                            <Plus size={20} />
                            <span className="hidden sm:inline">Thêm theo tháng</span>
                        </button>
                    )}
                    {activeSubTab !== 'customer_debt' && activeSubTab !== 'team_info' && (
                        <button 
                            onClick={() => { resetForm(); setIsFormOpen(true); }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                        >
                            <Plus size={20} />
                            Thêm mới
                        </button>
                    )}
                    {activeSubTab === 'team_info' && (
                        <div className="flex gap-2">
                            <button 
                                onClick={handleManualSyncTeamInfo}
                                className="bg-sky-50 text-sky-600 hover:bg-sky-100 px-4 py-2.5 rounded-xl font-bold transition flex items-center gap-2 border border-sky-100"
                                title="Đồng bộ thông tin tài khoản ngân hàng từ Giá Trị Tổ Đội sang"
                            >
                                <RotateCcw size={20} />
                                Cập nhật từ Giá Trị Tổ Đội
                            </button>
                            <button 
                                onClick={() => {
                                    setEditingId(null);
                                    setTeamInfoForm({ team_name: '', account_name: '', account_number: '', bank_name: '' });
                                    setIsCustomTeamInfoName(false);
                                    setIsTeamInfoFormOpen(true);
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                            >
                                <Plus size={20} />
                                Thêm mới tổ đội
                            </button>
                        </div>
                    )}
                </div>
            </header>

            <div className="flex gap-6 border-b border-slate-200 mb-6 overflow-x-auto hide-scrollbar print:hidden">
                <button 
                    onClick={() => setActiveSubTab('customer_debt')}
                    className={`pb-3 font-black text-sm px-2 border-b-[3px] transition-colors whitespace-nowrap ${activeSubTab === 'customer_debt' ? 'border-rose-600 text-rose-700' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}`}
                >
                    CÔNG NỢ THU
                </button>
                <button 
                    onClick={() => setActiveSubTab('invoice')}
                    className={`pb-3 font-black text-sm px-2 border-b-[3px] transition-colors whitespace-nowrap ${activeSubTab === 'invoice' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}`}
                >
                    HĐ DỰ KIẾN
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
                <button 
                    onClick={() => setActiveSubTab('team_info')}
                    className={`pb-3 font-black text-sm px-2 border-b-[3px] transition-colors whitespace-nowrap ${activeSubTab === 'team_info' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}`}
                >
                    THÔNG TIN TỔ ĐỘI
                </button>
            </div>

            <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4 print:hidden">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
                    <input 
                        type="text"
                        id="cbpro-expected-invoice-search"
                        name="cbpro-expected-invoice-search"
                        autoComplete="new-password"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        placeholder="Tìm kiếm..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold outline-none focus:border-emerald-500 focus:bg-white transition"
                    />
                </div>
                {activeSubTab !== 'team_info' && (
                    <>
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
                    </>
                )}

                {activeSubTab === 'invoice' && (
                    <div className="w-full md:w-52">
                        <select
                            value={filterInvoiceMonth}
                            onChange={(e) => setFilterInvoiceMonth(e.target.value)}
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 focus:bg-white transition"
                        >
                            <option value="">Tất cả tháng HĐ</option>
                            {availableInvoiceMonths.map(month => (
                                <option key={month} value={month}>{formatMonthLabel(month)}</option>
                            ))}
                        </select>
                    </div>
                )}
                {activeSubTab === 'customer_debt' && (
                    <button
                        type="button"
                        onClick={() => setHideUnissuedCustomerDebtRowsOnPrint(prev => !prev)}
                        className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-black transition md:w-auto ${hideUnissuedCustomerDebtRowsOnPrint ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                        title={hideUnissuedCustomerDebtRowsOnPrint ? 'Khi in sẽ ẩn dòng công nợ chưa có số HĐ' : 'Khi in sẽ hiện cả dòng công nợ chưa có số HĐ'}
                    >
                        <EyeOff size={18} />
                        <span className="hidden xl:inline">{hideUnissuedCustomerDebtRowsOnPrint ? 'Ẩn chưa xuất HĐ' : 'In cả chưa xuất HĐ'}</span>
                    </button>
                )}
                {(activeSubTab === 'team' || activeSubTab === 'history_team') && (
                    <div className="contents">
                    <button
                        type="button"
                        onClick={() => setHideZeroRowsOnPrint(prev => !prev)}
                        className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-black transition md:w-auto ${hideZeroRowsOnPrint ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                        title={hideZeroRowsOnPrint ? 'Khi in sẽ ẩn tổ đội có giá trị kỳ này bằng 0' : 'Khi in sẽ hiện cả tổ đội có giá trị kỳ này bằng 0'}
                    >
                        <EyeOff size={18} />
                        <span className="hidden xl:inline">{hideZeroRowsOnPrint ? 'Ẩn dòng 0 khi in' : 'In cả dòng 0'}</span>
                    </button>
                    </div>
                )}
                <div className="flex items-center justify-end gap-2 md:w-40">
                    <button
                        type="button"
                        onClick={() => changeTableZoom(-0.1)}
                        className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition"
                        title="Thu nhỏ bảng"
                    >
                        <ZoomOut size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={() => setTableZoom(1)}
                        className="min-w-12 px-2 py-2 rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-600 tabular-nums"
                        title="Đưa bảng về 100%"
                    >
                        {Math.round(tableZoom * 100)}%
                    </button>
                    <button
                        type="button"
                        onClick={() => changeTableZoom(0.1)}
                        className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition"
                        title="Phóng to bảng"
                    >
                        <ZoomIn size={18} />
                    </button>
                </div>
            </div>

            {activeSubTab === 'customer_debt' && (
                <div className="mb-4 flex flex-wrap items-center gap-2 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm print:hidden">
                    <span className="mr-1 text-xs font-black uppercase tracking-wide text-slate-500">Ẩn/hiện cột:</span>
                    {customerDebtColumns.map(col => {
                        const isVisible = customerDebtVisibleColumns[col.key] !== false;
                        return (
                            <button
                                key={col.key}
                                type="button"
                                onClick={() => toggleCustomerDebtColumn(col.key)}
                                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-black transition ${isVisible ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                title={`${isVisible ? 'Ẩn' : 'Hiện'} cột ${col.label}`}
                            >
                                {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                                {col.label}
                            </button>
                        );
                    })}
                </div>
            )}

            {isFormOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="bg-slate-900 px-6 py-4 flex justify-between items-center">
                        <h3 className="text-white font-bold text-lg">{editingId ? 'Cập nhật' : 'Thêm mới'} {activeSubTab === 'invoice' ? 'hóa đơn' : 'tổ đội'} dự kiến</h3>
                        <button onClick={resetForm} className="text-slate-400 hover:text-white transition"><X /></button>
                    </div>
                    <form onSubmit={handleSave} className="p-6 flex flex-col gap-6">
                        <div className={activeSubTab === 'invoice' ? 'grid grid-cols-1 md:grid-cols-3 gap-6' : 'grid grid-cols-1 md:grid-cols-2 gap-6'}>
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
                                <>
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
                                <div>
                                    <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">Tháng hóa đơn</label>
                                    <input
                                        type="month"
                                        name="invoice_month"
                                        value={formData.invoice_month || ''}
                                        onChange={handleFormChange}
                                        className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition"
                                    />
                                </div>
                                </>
                            ) : (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">Đợt</label>
                                        <input 
                                            type="text" 
                                            name="phase" 
                                            value={formData.phase || ''}
                                            onChange={handleFormChange}
                                            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white transition"
                                            placeholder="Có thể để trống"
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
                                                if (val === 'Khác') {
                                                    setIsCustomTeamName(true);
                                                    setFormData(prev => ({ ...prev, teamName: '', accumulatedAdvance: '', account_name: '', account_number: '', bank_name: '' }));
                                                } else {
                                                    setIsCustomTeamName(false);
                                                    const teamInvoices = invoices.filter(i => i.projectName === formData.projectName && i.teamName === val && !i.is_completed);
                                                    const lastInvoice = teamInvoices.length > 0 ? teamInvoices[teamInvoices.length - 1] : null;
                                                    const lastAdvance = lastInvoice ? ((parseFloat(lastInvoice.accumulatedAdvance) || 0) + (parseFloat(lastInvoice.teamValue) || 0)) : 0;
                                                    
                                                    const matchedTeamInfo = teamInfoList.find(t => t.team_name.toLowerCase() === val.toLowerCase());
                                                    
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
                                                    const deduc = formData.deductionAmount ? parseInt(formData.deductionAmount.toString().replace(/\D/g, '')) : 0;
                                                    setFormData(prev => ({ 
                                                        ...prev, 
                                                        preTaxValue: preTax ? preTax.toLocaleString('en-US') : '',
                                                        teamValue: (preTax - deduc) > 0 ? (preTax - deduc).toLocaleString('en-US') : '0'
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
                                                    const preTax = formData.preTaxValue ? parseInt(formData.preTaxValue.toString().replace(/\D/g, '')) : 0;
                                                    setFormData(prev => ({ 
                                                        ...prev, 
                                                        deductionAmount: deduc ? deduc.toLocaleString('en-US') : '',
                                                        teamValue: (preTax - deduc) > 0 ? (preTax - deduc).toLocaleString('en-US') : '0'
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
                                        <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">Lũy kế kỳ trước</label>
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
                                            className="w-full bg-slate-100 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-black text-emerald-600 outline-none cursor-not-allowed"
                                            placeholder="Tự động tính..."
                                            readOnly
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

            {activeSubTab === 'team_info' ? (
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-900 text-white border-b border-slate-200">
                                    <th className="p-4 font-black uppercase text-xs tracking-wider w-16 text-center">STT</th>
                                    <th className="p-4 font-black uppercase text-xs tracking-wider">Tên Tổ Đội</th>
                                    <th className="p-4 font-black uppercase text-xs tracking-wider">Công Trình</th>
                                    <th className="p-4 font-black uppercase text-xs tracking-wider">Tên TK</th>
                                    <th className="p-4 font-black uppercase text-xs tracking-wider">Số TK</th>
                                    <th className="p-4 font-black uppercase text-xs tracking-wider">Ngân hàng</th>
                                    <th className="p-4 font-black uppercase text-xs tracking-wider text-center w-32">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {teamInfoList.filter(t => !searchTerm || t.team_name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="p-8 text-center text-slate-500">Chưa có dữ liệu thông tin tổ đội phù hợp.</td>
                                    </tr>
                                ) : (
                                    teamInfoList.filter(t => !searchTerm || t.team_name.toLowerCase().includes(searchTerm.toLowerCase())).map((t, idx) => (
                                        <tr key={t.id} className="hover:bg-slate-50 transition">
                                            <td className="p-4 text-center font-bold text-slate-500">{idx + 1}</td>
                                            <td className="p-4 text-sm font-black text-slate-800">{t.team_name}</td>
                                            <td className="p-4 text-sm font-bold text-amber-700">{getProjectsForTeam(t.team_name)}</td>
                                            <td className="p-4 text-sm font-semibold text-slate-600">{t.account_name || '-'}</td>
                                            <td className="p-4 text-sm font-mono text-slate-600">{t.account_number || '-'}</td>
                                            <td className="p-4 text-sm font-bold text-slate-600">{t.bank_name || '-'}</td>
                                            <td className="p-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setEditingId(t.id);
                                                            setTeamInfoForm({
                                                                team_name: t.team_name,
                                                                account_name: t.account_name || '',
                                                                account_number: t.account_number || '',
                                                                bank_name: t.bank_name || ''
                                                            });
                                                            setIsCustomTeamInfoName(!allProjectTeamNames.includes(t.team_name));
                                                            setIsTeamInfoFormOpen(true);
                                                        }}
                                                        className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-lg transition"
                                                        title="Sửa"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => setConfirmDeleteTeamInfoId(t.id)}
                                                        className="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 border border-red-200 rounded-lg transition"
                                                        title="Xóa"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="expected-print-report bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden print:rounded-none print:border-none print:shadow-none print:overflow-visible">
                <div className="expected-print-scroll overflow-x-auto overflow-y-auto max-h-[calc(100vh-250px)] print:overflow-visible print:max-h-none">
                    <div className="expected-print-zoom" style={{ zoom: tableZoom }}>
                    {activeSubTab === 'customer_debt' && (
                        <div className="expected-print-title">
                            BẢNG THEO DÕI CÔNG NỢ PHẢI THU KHÁCH HÀNG
                        </div>
                    )}
                    {activeSubTab === 'invoice' && (
                        <div className="expected-print-title">
                            BẢNG THEO DÕI HÓA ĐƠN VÀ TIẾN ĐỘ THU TIỀN
                        </div>
                    )}
                    {(activeSubTab === 'team' || activeSubTab === 'history_team') && (
                        <div className="expected-print-title">
                            BẢNG KHỐI LƯỢNG TỔ ĐỘI KỲ {printPeriodTitle}
                        </div>
                    )}
                    <table 
                        id="expected-invoices-table" 
                        className={`w-full text-left border-collapse table-fixed ${activeSubTab === 'team' || activeSubTab === 'history_team' ? 'min-w-[1580px] sm:min-w-[1500px]' : ''} [&_td]:align-middle [&_th]:align-middle [&_th]:h-14 [&_th]:leading-tight [&_td]:leading-tight max-sm:[&_td]:!p-2 max-sm:[&_th]:!p-2 max-sm:[&_td]:!text-[11px] max-sm:[&_th]:!text-[10px] ${activeSubTab === 'team' || activeSubTab === 'history_team' ? 'expected-team-print-table' : ''} ${activeSubTab === 'customer_debt' ? 'expected-customer-debt-print-table' : ''}`}
                        style={{
                            minWidth: activeSubTab === 'customer_debt' ? `${customerDebtLayout.minWidth}px` : undefined,
                            '--row-count': teamPrintLayout.rowCount,
                            '--print-font-size': `${teamPrintLayout.fontSize}pt`,
                            '--print-header-font-size': `${teamPrintLayout.headerFontSize}pt`,
                            '--print-summary-font-size': `${teamPrintLayout.summaryFontSize}pt`,
                            '--print-cell-padding-y': `${teamPrintLayout.cellPaddingY}px`,
                            '--print-cell-padding-x': `${teamPrintLayout.cellPaddingX}px`,
                            '--print-note-width': hasLongPrintNotes ? '10%' : '7%',
                        }}
                    >
                        {activeSubTab === 'customer_debt' && (
                            <colgroup>
                                {visibleCustomerDebtColumns.map(col => (
                                    <col
                                        key={col.key}
                                        style={{
                                            width: ({
                                                stt: '4%', name: '20%', expected: '10%', actual: '10%', remaining: '10%',
                                                dueDate: '9%', overdue: '8%', invoiceNumber: '9%', invoiceDate: '9%',
                                                contractNumber: '14%', documentNumber: '8%'
                                            })[col.key] || '9%'
                                        }}
                                    />
                                ))}
                            </colgroup>
                        )}
                        {activeSubTab === 'invoice' && (
                            <colgroup>
                                <col style={{ width: '4%' }} />
                                <col style={{ width: '18%' }} />
                                <col style={{ width: '9%' }} />
                                <col style={{ width: '12%' }} />
                                <col style={{ width: '10%' }} />
                                <col style={{ width: '12%' }} />
                                <col style={{ width: '10%' }} />
                                <col style={{ width: '19%' }} />
                                <col style={{ width: '6%' }} />
                            </colgroup>
                        )}
                        {(activeSubTab === 'team' || activeSubTab === 'history_team') && (
                            <colgroup>
                                <col className="w-12" />
                                <col className="w-[280px]" />
                                <col className="w-24" />
                                <col className="w-20" />
                                <col className="w-32" />
                                <col className="w-32" />
                                <col className="w-[140px]" />
                                <col className="w-[170px]" />
                                <col className="w-[110px]" />
                                <col className="w-[110px]" />
                                <col className={hasLongPrintNotes ? 'w-[150px]' : 'w-[110px]'} />
                                <col className="w-[72px] print-hide-col" />
                                
                                <col className="w-20 print-hide-col" />
                                <col className="w-24 print-hide-col" />
                            </colgroup>
                        )}
                        <thead>
                            <tr className="bg-slate-900 text-white border-b border-slate-200 sticky top-0 z-20">
                                {activeSubTab === 'customer_debt' ? (
                                    visibleCustomerDebtColumns.map(col => (
                                        <th
                                            key={col.key}
                                            className={`font-black uppercase ${col.className || ''}`}
                                            style={{
                                                padding: `${customerDebtLayout.cellPaddingY} ${customerDebtLayout.cellPaddingX}`,
                                                fontSize: customerDebtLayout.headerFontSize
                                            }}
                                        >
                                                <div className="flex items-center justify-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleCustomerDebtColumn(col.key)}
                                                    className="print:hidden rounded-lg border border-white/15 bg-white/10 p-1 text-white/80 hover:bg-white/20 hover:text-white"
                                                    title={`Ẩn cột ${col.label}`}
                                                >
                                                    <Eye size={14} />
                                                </button>
                                                <span>{col.label}</span>
                                            </div>
                                        </th>
                                    ))
                                ) : activeSubTab === 'customer_debt' ? null : (
                                    <>
                                        <th className="p-4 font-black uppercase text-sm text-center">STT</th>
                                <th className="p-4 font-black uppercase text-sm">
                                    {activeSubTab === 'customer_debt' ? 'Tên' : (activeSubTab === 'team' || activeSubTab === 'history_team' ? 'Tên tổ đội' : 'Tên công trình')}
                                </th>
                                    </>
                                )}
                                {activeSubTab === 'invoice' ? (
                                    <>
                                        <th className="p-4 font-black uppercase text-sm">Tháng HĐ</th>
                                        <th className="p-4 font-black text-slate-100 uppercase text-sm text-right w-36">Giá trị trước thuế</th>
                                        <th className="p-4 font-black text-slate-100 uppercase text-sm text-right w-32">Thuế VAT</th>
                                        <th className="p-4 font-black text-slate-100 uppercase text-sm text-right w-40">Giá trị sau thuế</th>
                                        <th className="p-4 font-black uppercase text-sm">Đợt</th>
                                        <th className="p-4 font-black uppercase text-sm">Ghi chú</th>
                                        <th className="p-4 font-black uppercase text-sm w-24 text-center print:hidden">Thao tác</th>
                                    </>
                                ) : activeSubTab === 'team' || activeSubTab === 'history_team' ? (
                                    <>
                                        <th className="p-3 font-black uppercase text-sm text-center">Thực chi</th>
                                        <th className="p-3 font-black uppercase text-sm text-center">Thu</th>
                                        <th className="p-3 font-black uppercase text-sm text-center whitespace-normal"><span className="block text-center">Lũy kế</span><span className="block text-center">kì trước</span></th>
                                        <th className="p-3 font-black uppercase text-sm text-center whitespace-normal"><span className="block text-center">Lũy kế</span><span className="block text-center">kỳ này</span></th>
                                        <th className="p-3 font-black uppercase text-sm text-center whitespace-normal"><span className="block text-center">Lũy kế</span><span className="block text-center">đến nay</span></th>
                                        <th className="p-3 font-black uppercase text-sm text-center">Tên TK</th>
                                        <th className="p-3 font-black uppercase text-sm text-center">Số TK</th>
                                        <th className="p-3 font-black uppercase text-sm text-center">Ngân hàng</th>
                                        <th className="p-3 font-black uppercase text-sm text-center">Ghi chú</th>
                                        <th className="p-3 font-black uppercase text-sm text-center print:hidden">Đợt</th>
                                        
                                        <th className="p-4 font-black uppercase text-sm text-center print:hidden">PDF</th>
                                        <th className="p-4 font-black uppercase text-sm text-center print:hidden">Thao tác</th>
                                    </>
                                ) : activeSubTab === 'customer_debt' ? null : (
                                    <>
                                        <th className="p-4 font-black uppercase text-sm">Số hợp đồng</th>
                                        <th className="p-4 font-black uppercase text-sm">Số HĐ</th>
                                        <th className="p-4 font-black uppercase text-sm">Ngày HĐ</th>
                                        <th className="p-4 font-black uppercase text-sm">Ngày tới hạn</th>
                                        <th className="p-4 font-black uppercase text-sm text-center">Quá hạn</th>
                                        <th className="p-4 font-black uppercase text-sm">Số CT</th>
                                        <th className="p-4 font-black uppercase text-sm">Đợt TT</th>
                                        <th className="p-4 font-black text-slate-100 uppercase text-sm text-right w-40">Cần thu (HSTT)</th>
                                        <th className="p-4 font-black text-slate-100 uppercase text-sm text-right w-40">Đã thu</th>
                                        <th className="p-4 font-black text-slate-100 uppercase text-sm text-right w-40">Còn lại</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {activeSubTab === 'customer_debt' ? (
                                filteredCustomerDebts.length === 0 ? (
                                    <tr>
                                        <td colSpan={visibleCustomerDebtColumns.length || 1} className="p-8 text-center text-slate-500">Chưa có dữ liệu phù hợp.</td>
                                    </tr>
                                ) : (
                                    (() => {
                                        let globalIdx = 0;
                                        return groupedCustomerDebts.map(([groupName, debts]) => {
                                            const printableDebts = getPrintableCustomerDebtRows(debts);
                                            return (
                                            <React.Fragment key={groupName}>
                                                <tr className={`bg-indigo-50 border-y-2 border-indigo-200/80 sticky top-[52px] z-10 print:bg-slate-200 print:border-slate-400 print:text-black ${printableDebts.length === 0 ? 'print:hidden' : ''}`}>
                                                    {visibleCustomerDebtColumns.map(col => {
                                                        if (col.key === 'stt') {
                                                            return <td key={col.key} className="p-4 text-center text-[16px] print:text-black">🏢</td>;
                                                        }
                                                        if (col.key === 'name') {
                                                            return (
                                                                <td key={col.key} className="p-4 text-left font-black text-[16px] text-indigo-950 uppercase tracking-wider print:text-black print:text-[16px] print:font-black">
                                                                    {groupName}
                                                                </td>
                                                            );
                                                        }
                                                        if (col.key === 'expected') {
                                                            return (
                                                                <td key={col.key} className="p-4 text-center font-black text-[14px] text-slate-800 bg-indigo-100/30 print:text-black print:text-[14px] print:font-black print:bg-slate-300/30">
                                                                    {formatCurrency(printableDebts.reduce((sum, d) => sum + d.expected, 0))} VNĐ
                                                                </td>
                                                            );
                                                        }
                                                        if (col.key === 'actual') {
                                                            return (
                                                                <td key={col.key} className="p-4 text-center font-black text-[14px] text-emerald-700 bg-indigo-100/30 print:text-black print:text-[14px] print:font-black print:bg-slate-300/30">
                                                                    {formatCurrency(printableDebts.reduce((sum, d) => sum + d.actual, 0))} VNĐ
                                                                </td>
                                                            );
                                                        }
                                                        if (col.key === 'remaining') {
                                                            return (
                                                                <td key={col.key} className="p-4 text-center font-black text-[14px] text-rose-700 bg-indigo-100/30 print:text-black print:text-[14px] print:font-black print:bg-slate-300/30">
                                                                    {formatCurrency(printableDebts.reduce((sum, d) => sum + d.remaining, 0))} VNĐ
                                                                </td>
                                                            );
                                                        }
                                                        return <td key={col.key} className="p-4 text-center text-slate-400 text-[12px] font-bold print:text-slate-600">---</td>;
                                                    })}
                                                </tr>
                                                {debts.map((debt) => {
                                                    const currentIdx = globalIdx++;
                                                    const hideUnissuedDebtInPrint = hideUnissuedCustomerDebtRowsOnPrint && !hasCustomerDebtInvoice(debt);
                                                    return (
                                                        <tr key={debt.id} className={`hover:bg-slate-50 transition group ${hideUnissuedDebtInPrint ? 'print:hidden' : ''}`}>
                                                            {visibleCustomerDebtColumns.map(col => (
                                                                <td
                                                                    key={col.key}
                                                                    className={`${col.cellClassName || ''}`}
                                                                    style={{
                                                                        padding: `${customerDebtLayout.cellPaddingY} ${customerDebtLayout.cellPaddingX}`,
                                                                        fontSize: customerDebtLayout.fontSize
                                                                    }}
                                                                >
                                                                    {renderCustomerDebtCell(debt, currentIdx, col.key)}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    );
                                                })}
                                            </React.Fragment>
                                        );});
                                    })()
                                )
                            ) : (
                                filteredInvoices.length === 0 ? (
                                    <tr>
                                        <td colSpan={activeSubTab === 'invoice' ? 9 : 14} className="p-8 text-center text-slate-500">Chưa có dữ liệu phù hợp.</td>
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
                                        const printablePeriodInvoices = getPrintableTeamRows(periodInvoices);
                                        const hasPrintablePeriodRows = printablePeriodInvoices.length > 0;
                                        const isQsApproved = periodInvoices[0]?.qs_approved;
                                        const isKtApproved = periodInvoices[0]?.accountant_approved;
                                        const role = currentUser?.role?.toUpperCase();
                                        const canApproveQs = (role === 'QS' || role === 'QS TRƯỞNG' || role === 'ADMIN') && !isQsApproved;
                                        const canRevertQs = (role === 'QS' || role === 'QS TRƯỞNG' || role === 'ADMIN') && isQsApproved && !isKtApproved;
                                        const canApproveKt = (role === 'ACCOUNTANT' || role?.startsWith('KẾ TOÁN') || role === 'ADMIN') && isQsApproved && !isKtApproved;
                                        const canRevertKt = (role === 'ACCOUNTANT' || role?.startsWith('KẾ TOÁN') || role === 'ADMIN') && isKtApproved;

                                        return (
                                        <React.Fragment key={period}>
                                            <tr className={`bg-slate-900 cursor-pointer hover:bg-slate-800 transition sticky top-[52px] z-10 ${!hasPrintablePeriodRows ? 'print:hidden' : ''}`} onClick={() => setCollapsedPhases(prev => ({ ...prev, [period]: !prev[period] }))}>
                                                <td colSpan={14} className="p-4 py-5">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <div className="p-1 bg-slate-800 rounded-md">
                                                                {collapsedPhases[period] ? <ChevronRight size={18} className="text-white" /> : <ChevronDown size={18} className="text-white" />}
                                                            </div>
                                                            {editingPeriodName === period ? (
                                                                <div className="flex flex-col ml-2" onClick={e => e.stopPropagation()}>
                                                                    <div className="flex items-center gap-2">
                                                                        <input 
                                                                            type="text" 
                                                                            value={newPeriodName}
                                                                            onChange={e => { setNewPeriodName(e.target.value); setRenameError(''); }}
                                                                            className="px-2 py-1 text-sm text-slate-900 bg-white font-bold rounded outline-none"
                                                                            autoFocus
                                                                        />
                                                                        <button onClick={() => handleRenamePeriod(period, periodInvoices)} className="bg-emerald-500 hover:bg-emerald-400 text-white p-1 rounded transition">
                                                                            <CheckCircle2 size={16} />
                                                                        </button>
                                                                        <button onClick={() => { setEditingPeriodName(null); setRenameError(''); }} className="bg-slate-500 hover:bg-slate-400 text-white p-1 rounded transition">
                                                                            <X size={16} />
                                                                        </button>
                                                                    </div>
                                                                    {renameError && <span className="text-rose-400 text-xs mt-1 font-bold">{renameError}</span>}
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-black text-white text-sm uppercase tracking-wider">KỲ THANH TOÁN: {period}</span>
                                                                    <button 
                                                                        onClick={(e) => { e.stopPropagation(); setEditingPeriodName(period); setNewPeriodName(period); }} 
                                                                        className="text-slate-400 hover:text-white transition p-1"
                                                                        title="Đổi tên kỳ thanh toán"
                                                                    >
                                                                        <Edit2 size={14} />
                                                                    </button>
                                                                    {currentUser?.role?.toUpperCase() === 'ADMIN' && (
                                                                        <button 
                                                                            onClick={(e) => { e.stopPropagation(); handleDeletePeriod(period, periodInvoices); }} 
                                                                            className="text-slate-400 hover:text-rose-400 transition p-1"
                                                                            title="Xóa toàn bộ kỳ này"
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
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
                                            {!collapsedPhases[period] && Object.entries(projectGroups).sort((a, b) => a[0].localeCompare(b[0])).map(([projName, groupInvoices], projIdx) => {
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
                                                    if (aVal !== 0 || bVal !== 0) {
                                                        if (aVal === 0) return 1;
                                                        if (bVal === 0) return -1;
                                                        return (a.teamName || '').localeCompare(b.teamName || '');
                                                    }
                                                    const prevPeriod = allPeriods[allPeriods.indexOf(period) - 1];
                                                    if (prevPeriod) {
                                                        const getPrevValue = (inv) => {
                                                            const prevInv = invoices.find(i => 
                                                                i.payment_period === prevPeriod && 
                                                                i.projectName === inv.projectName && 
                                                                i.teamName === inv.teamName
                                                            );
                                                            return prevInv ? (parseFloat(prevInv.teamValue) || 0) : 0;
                                                        };
                                                        const aPrev = getPrevValue(a);
                                                        const bPrev = getPrevValue(b);
                                                        if (aPrev !== 0 || bPrev !== 0) {
                                                            if (aPrev === 0) return 1;
                                                            if (bPrev === 0) return -1;
                                                            return (a.teamName || '').localeCompare(b.teamName || '');
                                                        }
                                                    }
                                                    return (a.teamName || '').localeCompare(b.teamName || '');
                                                });
                                                const printableGroupInvoices = getPrintableTeamRows(sortedGroupInvoices);
                                                const hasPrintableGroupRows = printableGroupInvoices.length > 0;
                                                return (
                                                <React.Fragment key={projName}>
                                                    <tr 
                                                        className={`expected-project-summary-row ${color.bg} border-y ${color.border} cursor-pointer hover:opacity-90 select-none ${!hasPrintableGroupRows ? 'print:hidden' : ''}`}
                                                        onClick={() => setCollapsedProjects(prev => ({ ...prev, [`${period}_${projName}`]: !prev[`${period}_${projName}`] }))}
                                                    >
                                                        <td className="text-center p-3">
                                                            <div className="flex items-center justify-center print:hidden">
                                                                {collapsedProjects[`${period}_${projName}`] ? <ChevronRight size={16} className={color.text} /> : <ChevronDown size={16} className={color.text} />}
                                                            </div>
                                                        </td>
                                                        <td 
                                                            className={`p-3 font-black ${color.text} text-sm uppercase text-left hover:underline`}
                                                            onDoubleClick={(e) => { e.stopPropagation(); onNavigateToProject && onNavigateToProject(projName); }}
                                                            title="Click đúp để xem chi tiết công trình"
                                                        >
                                                            {projName}:
                                                        </td>
                                                        <td className="p-3 text-sm text-center tabular-nums font-black text-emerald-600">{formatCurrency(printableGroupInvoices.reduce((sum, inv) => sum + (parseFloat(inv.teamValue) || 0), 0))}</td>
                                                        <td className="p-3 text-sm text-center tabular-nums font-black text-red-600">{formatCurrency(printableGroupInvoices.reduce((sum, inv) => sum + (parseFloat(inv.deductionAmount) || 0), 0))}</td>
                                                        <td className="p-3 text-sm text-center tabular-nums font-black text-blue-600">{formatCurrency(printableGroupInvoices.reduce((sum, inv) => sum + (parseFloat(inv.accumulatedAdvance) || 0), 0))}</td>
                                                        <td className="p-3 text-sm text-center tabular-nums font-black text-amber-600">{formatCurrency(printableGroupInvoices.reduce((sum, inv) => sum + (parseFloat(inv.preTaxValue) || 0), 0))}</td>
                                                        <td className="p-3 text-sm text-center tabular-nums font-black text-indigo-600">{formatCurrency(printableGroupInvoices.reduce((sum, inv) => sum + ((parseFloat(inv.accumulatedAdvance) || 0) + (parseFloat(inv.preTaxValue) || 0)), 0))}</td>
                                                        <td colSpan={7}></td>
                                                    </tr>
                                                    {!collapsedProjects[`${period}_${projName}`] && sortedGroupInvoices.map((inv, idx) => {
                                                        const role = currentUser?.role?.toUpperCase();
                                                        const isCashier = role === 'THỦ QUỸ';
                                                        const isAcctUser = role === 'ACCOUNTANT' || role?.startsWith('KẾ TOÁN');
                                                        const disableEdit = isAcctUser && !inv.qs_approved;
                                                        const canDeleteTeamRow = role === 'ADMIN' || role === 'QS' || role === 'QS TRƯỞNG';
                                                         const canConfirmTransfer = isCashier || isAcctUser || role === 'ADMIN';
                                                         const canPostTransaction = isAcctUser || role === 'ADMIN';
                                                        const isZero = !parseFloat(inv.teamValue);
                                                        const hideZeroInPrint = hideZeroRowsOnPrint && isZero;
                                                        const teamPdfUrl = inv.team_pdf_url || inv.pdf_url;

                                                        return (
                                                        <tr id={"row-" + inv.id} key={inv.id} className={`hover:bg-slate-50 transition group border-l-4 ${hideZeroInPrint ? 'print:hidden' : ''} ${isZero ? 'border-l-slate-200 bg-slate-50/50 opacity-40' : `${color.rowBorder} bg-white`}`}>
                                                            <td className={`p-4 text-sm text-center font-medium ${isZero ? 'text-slate-400' : 'text-slate-500'}`}>{idx + 1}</td>
                                                            <td className={`p-4 text-sm font-bold whitespace-nowrap overflow-hidden text-ellipsis ${isZero ? 'text-slate-400' : 'text-slate-800'}`}>{inv.teamName || '-'}</td>
                                                            <td className={`p-4 text-sm text-center tabular-nums font-bold ${isZero ? 'text-slate-400' : 'text-emerald-600'}`}>{formatCurrency(parseFloat(inv.teamValue) || 0)}</td>
                                                            <td className={`p-4 text-sm text-center tabular-nums font-bold ${isZero ? 'text-slate-400' : 'text-red-600'}`}>{formatCurrency(parseFloat(inv.deductionAmount) || 0)}</td>
                                                            <td className={`p-4 text-sm text-center tabular-nums font-medium ${isZero ? 'text-slate-400' : 'text-blue-600'}`}>{formatCurrency(parseFloat(inv.accumulatedAdvance) || 0)}</td>
                                                            <td className={`p-4 text-sm text-center tabular-nums font-bold ${isZero ? 'text-slate-400' : 'text-amber-600'}`}>{formatCurrency(parseFloat(inv.preTaxValue) || 0)}</td>
                                                            <td className={`p-4 text-sm text-center tabular-nums font-bold ${isZero ? 'text-slate-400' : 'text-indigo-600'}`}>{formatCurrency((parseFloat(inv.accumulatedAdvance) || 0) + (parseFloat(inv.preTaxValue) || 0))}</td>
                                                            {(() => {
                                                                const teamAccount = teamInfoList.find(t => t.team_name && inv.teamName && t.team_name.toLowerCase() === inv.teamName.toLowerCase());
                                                                const displayAccountName = inv.account_name || teamAccount?.account_name || '-';
                                                                const displayAccountNumber = inv.account_number || teamAccount?.account_number || '-';
                                                                const displayBankName = inv.bank_name || teamAccount?.bank_name || '-';
                                                                return (
                                                                    <>
                                                                        <td className={`p-4 text-sm text-center font-medium whitespace-nowrap overflow-hidden text-ellipsis ${isZero ? 'text-slate-400' : 'text-slate-600'}`}>{displayAccountName}</td>
                                                                        <td className={`p-4 text-sm text-center font-medium whitespace-nowrap ${isZero ? 'text-slate-400' : 'text-slate-600'}`}>{displayAccountNumber}</td>
                                                                        <td className={`p-4 text-sm text-center font-medium uppercase whitespace-nowrap overflow-hidden text-ellipsis ${isZero ? 'text-slate-400' : 'text-slate-600'}`}>{displayBankName}</td>
                                                                    </>
                                                                );
                                                            })()}
                                                            <td className={`p-4 text-sm text-center break-words ${isZero ? 'text-slate-400' : 'text-slate-500'}`} title={inv.note}>{inv.note || '-'}</td>
                                                            <td className={`p-4 text-sm text-center font-medium whitespace-nowrap print:hidden ${isZero ? 'text-slate-400' : 'text-slate-700'}`}>{inv.phase || '-'}</td>
                                                            
                                                            <td className="p-4 text-center print:hidden">
                                                                {teamPdfUrl ? (
                                                                    <div className="flex items-center justify-center gap-1.5">
                                                                        <a href={teamPdfUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg transition border border-indigo-100" title="Xem PDF">
                                                                            <Eye size={16} />
                                                                        </a>
                                                                        <button onClick={() => setConfirmDeletePdf(inv)} className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition border border-rose-100" title="Xóa PDF">
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="relative group/upload flex items-center justify-center">
                                                                        <input
                                                                            type="file"
                                                                            accept=".pdf,application/pdf"
                                                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                                            onChange={(e) => handleUploadTeamPdf(e, inv)}
                                                                            disabled={uploadingPdfId === inv.id}
                                                                            title="Tải lên PDF"
                                                                        />
                                                                        <button className={`p-1.5 rounded-lg transition border ${uploadingPdfId === inv.id ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-slate-50 text-slate-600 border-slate-200 group-hover/upload:bg-indigo-600 group-hover/upload:text-white group-hover/upload:border-indigo-600'}`} title="Tải lên PDF">
                                                                            <Upload size={16} className={uploadingPdfId === inv.id ? 'animate-bounce' : ''} />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="p-4 text-center print:hidden">
                                                                <div className="flex items-center justify-center gap-2">
                                                                    {(() => {
                                                                        const isPendingDelete = deleteRequests.some(r => r.original_table === 'expected_invoices' && r.record_id === inv.id);
                                                                        if (isPendingDelete) {
                                                                            return (
                                                                                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded whitespace-nowrap self-center">
                                                                                    Chờ xóa
                                                                                </span>
                                                                            );
                                                                        }
                                                                        return (
                                                                            <>
                                                                                <button 
                                                                                    onClick={() => !disableEdit && handleEdit(inv)} 
                                                                                    className={`p-1.5 rounded-lg transition border ${disableEdit ? 'text-slate-400 bg-slate-100 border-slate-200 cursor-not-allowed' : 'text-blue-500 hover:bg-blue-50 border-blue-200 bg-blue-50'}`} 
                                                                                    title={disableEdit ? 'Kế toán chỉ được sửa sau khi QS đã duyệt' : 'Sửa'}
                                                                                    disabled={disableEdit}
                                                                                >
                                                                                    <Edit2 size={16} />
                                                                                </button>
                                                                                {canDeleteTeamRow && (
                                                                                    <button 
                                                                                        onClick={() => handleDeleteClick(inv)} 
                                                                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition border border-red-200 bg-red-50" 
                                                                                        title={(currentUser?.role?.toUpperCase() === 'ADMIN' || currentUser?.role?.toUpperCase() === 'QS TRƯỞNG') ? "Xóa" : "Đề nghị Xóa"}
                                                                                    >
                                                                                        <Trash2 size={16} />
                                                                                    </button>
                                                                                )}
                                                                            </>
                                                                        );
                                                                    })()}
                                                                    {activeSubTab === 'history_team' && (
                                                                        <div className="flex items-center justify-center">
                                                                            {!inv.cashier_approved ? (
                                                                                canConfirmTransfer && (
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            setTransferInvoice(inv);
                                                                                            setTransferNote('');
                                                                                            setIsConfirmTransferModalOpen(true);
                                                                                        }}
                                                                                        className="px-2 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition border border-blue-200 bg-blue-50 whitespace-nowrap text-xs font-bold animate-pulse"
                                                                                        title="Xác nhận chuyển khoản ngân hàng"
                                                                                    >
                                                                                        Thanh toán
                                                                                    </button>
                                                                                )
                                                                            ) : (
                                                                                canPostTransaction ? (
                                                                                    transactions?.some(t => 
                                                                                        t.project_name === inv.projectName && 
                                                                                        t.recipient === inv.teamName && 
                                                                                        (t.note || '') === `Tạm ứng tổ đội - ${inv.teamName} - ${inv.payment_period}`
                                                                                    ) ? (
                                                                                        <span className="px-2 py-1.5 text-slate-400 bg-slate-100 rounded-lg border border-slate-200 whitespace-nowrap text-xs font-bold select-none cursor-not-allowed" title="Đã có giao dịch chi tương ứng trong Sổ quỹ">
                                                                                            Đã tạo T.Ứng
                                                                                        </span>
                                                                                    ) : (
                                                                                        <button 
                                                                                            onClick={() => {
                                                                                                setAdvanceData({
                                                                                                    project_name: inv.projectName,
                                                                                                    recipient: inv.teamName,
                                                                                                    amount: parseFloat(inv.teamValue) || 0,
                                                                                                    payment_period: inv.payment_period,
                                                                                                    note: `Tạm ứng tổ đội - ${inv.teamName} - ${inv.payment_period}`,
                                                                                                    code: '622',
                                                                                                    corresponding_account: ''
                                                                                                });
                                                                                                setIsAdvanceModalOpen(true);
                                                                                            }}
                                                                                            className="px-2 py-1.5 text-orange-500 hover:bg-orange-50 rounded-lg transition border border-orange-200 bg-orange-50 whitespace-nowrap text-xs font-bold" 
                                                                                            title="Tạo Nhập liệu Tạm ứng"
                                                                                        >
                                                                                            Hạch toán
                                                                                        </button>
                                                                                    )
                                                                                ) : (
                                                                                    <span 
                                                                                        className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-black cursor-help whitespace-nowrap"
                                                                                        title={`Thủ quỹ đã xác nhận chuyển khoản. Ghi chú: ${inv.cashier_note || 'Không có'}`}
                                                                                    >
                                                                                        Đã CK
                                                                                    </span>
                                                                                )
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        );
                                                    }) || null}
                                                </React.Fragment>
                                            )})}
                                            {!collapsedPhases[period] && (
                                                <tr className={`bg-indigo-50 border-y-2 border-indigo-300 shadow-[inset_0_1px_0_rgba(99,102,241,0.22),inset_0_-1px_0_rgba(99,102,241,0.22)] ${!hasPrintablePeriodRows ? 'print:hidden' : ''}`}>
                                                    <td></td>
                                                    <td className="p-4 font-black text-indigo-950 text-base uppercase text-left">TỔNG:</td>
                                                    <td className="p-4 text-base text-center tabular-nums font-black text-emerald-700">{formatCurrency(printablePeriodInvoices.reduce((sum, inv) => sum + (parseFloat(inv.teamValue) || 0), 0))}</td>
                                                    <td className="p-4 text-base text-center tabular-nums font-black text-red-600">{formatCurrency(printablePeriodInvoices.reduce((sum, inv) => sum + (parseFloat(inv.deductionAmount) || 0), 0))}</td>
                                                    <td className="p-4 text-base text-center tabular-nums font-black text-blue-700">{formatCurrency(printablePeriodInvoices.reduce((sum, inv) => sum + (parseFloat(inv.accumulatedAdvance) || 0), 0))}</td>
                                                    <td className="p-4 text-base text-center tabular-nums font-black text-amber-600">{formatCurrency(printablePeriodInvoices.reduce((sum, inv) => sum + (parseFloat(inv.preTaxValue) || 0), 0))}</td>
                                                    <td className="p-4 text-base text-center tabular-nums font-black text-indigo-700">{formatCurrency(printablePeriodInvoices.reduce((sum, inv) => sum + ((parseFloat(inv.accumulatedAdvance) || 0) + (parseFloat(inv.preTaxValue) || 0)), 0))}</td>
                                                    <td></td>
                                                    <td></td>
                                                    <td></td>
                                                    <td></td>
                                                    <td className="print:hidden"></td>
                                                    <td className="p-4 text-center print:hidden">
                                                        {periodInvoices.find(inv => inv.project_pdf_url)?.project_pdf_url ? (
                                                            <div className="flex items-center justify-center gap-1.5">
                                                                <a href={periodInvoices.find(inv => inv.project_pdf_url)?.project_pdf_url} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg transition border border-indigo-100" title="Xem PDF tổng">
                                                                    <Eye size={16} />
                                                                </a>
                                                                <button onClick={() => setConfirmDeleteProjectPdf({ projectName: null, period, pdfUrl: periodInvoices.find(inv => inv.project_pdf_url)?.project_pdf_url })} className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition border border-rose-100" title="Xóa PDF tổng">
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="relative group/upload flex items-center justify-center">
                                                                <input type="file" accept=".pdf,application/pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={(e) => handleUploadProjectPdf(e, null, period)} disabled={uploadingProjectPdfKey === `null__${period}`} title="Tải lên PDF tổng" />
                                                                <button className={`p-1.5 rounded-lg transition border ${uploadingProjectPdfKey === `null__${period}` ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-slate-50 text-slate-600 border-slate-200 group-hover/upload:bg-indigo-600 group-hover/upload:text-white group-hover/upload:border-indigo-600'}`} title="Tải lên PDF tổng">
                                                                    <Upload size={16} className={uploadingProjectPdfKey === `null__${period}` ? 'animate-bounce' : ''} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="print:hidden"></td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                        );
                                    })
                                ) : (
                                    filteredInvoices.map((inv, idx) => (
                                        <tr key={inv.id} className="hover:bg-slate-50 transition group">
                                            <td className="p-4 text-sm text-center text-slate-500 font-medium">{idx + 1}</td>
                                            <td 
                                                className="p-4 text-sm font-bold text-slate-800 cursor-pointer hover:text-indigo-600 hover:underline"
                                                onDoubleClick={() => onNavigateToProject && onNavigateToProject(inv.projectName)}
                                                title="Click đúp để xem chi tiết công trình"
                                            >
                                                {inv.projectName}
                                            </td>
                                            <td className="p-4 text-sm text-slate-600 font-bold">{formatMonthLabel(inv.invoice_month || inv.created_at?.slice(0, 7) || '') || '-'}</td>
                                            <td className="p-4 text-sm font-black text-slate-700 text-right">{formatCurrency(parseFloat(inv.preTaxValue) || 0)}</td>
                                            <td className="p-4 text-sm font-black text-red-500 text-right">{formatCurrency(parseFloat(inv.vatAmount) || 0)}</td>
                                            <td className="p-4 text-sm font-black text-emerald-600 text-right">{formatCurrency(parseFloat(inv.postTaxValue) || 0)} VNĐ</td>
                                            <td className="p-4 text-sm text-slate-600 font-medium">{inv.phase}</td>
                                            <td className="p-4 text-sm text-slate-500 max-w-xs truncate" title={inv.note}>{inv.note}</td>
                                            <td className="p-4 text-center print:hidden">
                                                <div className="flex items-center justify-center gap-2">
                                                    {(() => {
                                                        const isPendingDelete = deleteRequests.some(r => r.original_table === 'expected_invoices' && r.record_id === inv.id);
                                                        if (isPendingDelete) {
                                                            return (
                                                                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded whitespace-nowrap">
                                                                    Chờ xóa
                                                                </span>
                                                            );
                                                        }
                                                        const isAuthorizer = currentUser?.role?.toUpperCase() === 'ADMIN';
                                                        return (
                                                            <>
                                                                <button onClick={() => handleEdit(inv)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition border border-blue-200 bg-blue-50" title="Sửa"><Edit2 size={16} /></button>
                                                                {(isAuthorizer || true) && (
                                                                    <button 
                                                                        onClick={() => handleDeleteClick(inv)} 
                                                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition border border-red-200 bg-red-50" 
                                                                        title={isAuthorizer ? "Xóa" : "Đề nghị Xóa"}
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )
                            )}
                            {activeSubTab === 'customer_debt' && filteredCustomerDebts.length > 0 && (
                                <tr className={`bg-slate-100 border-t-2 border-slate-300 ${printableFilteredCustomerDebts.length === 0 ? 'print:hidden' : ''}`}>
                                    {visibleCustomerDebtColumns.map(col => {
                                        const totalClass = `p-4 text-sm ${col.cellClassName || ''}`;
                                        if (col.key === 'name') {
                                            return <td key={col.key} className="p-4 text-center text-sm font-black text-slate-800 uppercase">Tổng cộng:</td>;
                                        }
                                        if (col.key === 'expected') {
                                            return <td key={col.key} className={totalClass}>{formatCurrency(printableFilteredCustomerDebts.reduce((sum, d) => sum + d.expected, 0))} VNĐ</td>;
                                        }
                                        if (col.key === 'actual') {
                                            return <td key={col.key} className={totalClass}>{formatCurrency(printableFilteredCustomerDebts.reduce((sum, d) => sum + d.actual, 0))} VNĐ</td>;
                                        }
                                        if (col.key === 'remaining') {
                                            return <td key={col.key} className={totalClass}>{formatCurrency(printableFilteredCustomerDebts.reduce((sum, d) => sum + d.remaining, 0))} VNĐ</td>;
                                        }
                                        return <td key={col.key} className="p-4"></td>;
                                    })}
                                </tr>
                            )}
                            {activeSubTab === 'invoice' && filteredInvoices.length > 0 && (
                                <tr className="bg-slate-100 border-t-2 border-slate-300">
                                    <td colSpan="3" className="p-4 text-sm font-black text-slate-800 text-right uppercase">Tổng cộng:</td>
                                    <td className="p-4 text-sm font-black text-slate-700 text-right">{formatCurrency(filteredInvoices.reduce((sum, inv) => sum + (parseFloat(inv.preTaxValue) || 0), 0))}</td>
                                    <td className="p-4 text-sm font-black text-red-500 text-right">{formatCurrency(filteredInvoices.reduce((sum, inv) => sum + (parseFloat(inv.vatAmount) || 0), 0))}</td>
                                    <td className="p-4 text-sm font-black text-emerald-600 text-right">{formatCurrency(filteredInvoices.reduce((sum, inv) => sum + (parseFloat(inv.postTaxValue) || 0), 0))} VNĐ</td>
                                    <td colSpan="3"></td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    <div className="expected-print-signatures hidden">
                        <div className="expected-print-signature-box">
                            <div className="expected-print-signature-title">QS</div>
                            <div className="expected-print-signature-space"></div>
                        </div>
                        <div className="expected-print-signature-box">
                            <div className="expected-print-signature-title">KẾ TOÁN</div>
                            <div className="expected-print-signature-space"></div>
                        </div>
                        <div className="expected-print-signature-box">
                            <div className="expected-print-signature-title">GIÁM ĐỐC</div>
                            <div className="expected-print-signature-space"></div>
                        </div>
                    </div>
                    </div>
                </div>
            </div>
            )}
            
            <ConfirmModal
                isOpen={!!confirmDeleteId}
                title="Xác nhận xóa"
                message="Bạn có chắc chắn muốn xóa dữ liệu này? Hành động này không thể hoàn tác."
                type="danger"
                onConfirm={confirmDelete}
                onCancel={() => setConfirmDeleteId(null)}
            />

            <ConfirmModal
                isOpen={!!requestDeleteInvoice}
                title="Đề nghị xóa hóa đơn dự kiến"
                message={`Gửi đề nghị admin/QS trưởng xóa dòng dự kiến ${requestDeleteInvoice?.projectName || ''} - ${requestDeleteInvoice?.phase || ''}.`}
                type="info"
                confirmText="Gửi đề nghị"
                requireReason={true}
                reasonLabel="Lý do đề nghị xóa"
                reasonPlaceholder="Ví dụ: nhập sai kỳ, sai tổ đội, trùng dòng..."
                onConfirm={submitDeleteRequest}
                onCancel={() => setRequestDeleteInvoice(null)}
            />

            <ConfirmModal
                isOpen={!!confirmDeletePdf}
                title="Xóa PDF"
                message="Bạn có chắc chắn muốn xóa file PDF này khỏi dòng tổ đội không?"
                confirmText="Xóa PDF"
                type="danger"
                onConfirm={() => confirmDeletePdf && handleDeleteTeamPdf(confirmDeletePdf)}
                onCancel={() => setConfirmDeletePdf(null)}
            />

            <ConfirmModal
                isOpen={!!confirmDeleteProjectPdf}
                title="Xóa PDF tổng công trình"
                message="Bạn có chắc chắn muốn xóa file PDF tổng công trình này không?"
                confirmText="Xóa PDF"
                type="danger"
                onConfirm={() => confirmDeleteProjectPdf && handleDeleteProjectPdf(confirmDeleteProjectPdf.projectName, confirmDeleteProjectPdf.period, confirmDeleteProjectPdf.pdfUrl)}
                onCancel={() => setConfirmDeleteProjectPdf(null)}
            />

            <ConfirmModal
                isOpen={isDeleteAllConfirmOpen}
                title="Xóa toàn bộ dữ liệu"
                message={`Bạn có chắc chắn muốn xóa tất cả ${deleteAllTargetInvoices.length} dòng dữ liệu trong tab/bộ lọc hiện tại? Ô tìm kiếm sẽ không làm lệch phạm vi xóa. Hành động này cực kỳ nguy hiểm và không thể hoàn tác!`}
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

            {isClonePeriodModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-slate-900 px-6 py-4 flex justify-between items-center">
                            <h3 className="text-white font-bold text-lg flex items-center gap-2"><Copy size={20} /> Thêm kỳ thanh toán mới (Nhân bản)</h3>
                            <button onClick={() => { setIsClonePeriodModalOpen(false); setCloneSourcePeriod(''); setCloneTargetPeriod(''); }} className="text-slate-400 hover:text-white transition"><X /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-sm text-blue-800 mb-2">
                                <p className="font-bold mb-1">Quy tắc nhân bản:</p>
                                <ul className="list-disc pl-5 space-y-1">
                                    <li>Sao chép toàn bộ danh sách tổ đội từ kỳ cũ sang kỳ mới.</li>
                                    <li>Số liệu (Lũy kế kỳ trước, Giá trị KL, Thu lại đội) = 0 để nhập tay lại.</li>
                                </ul>
                            </div>
                            <div>
                                <label className="block text-sm font-black text-slate-900 mb-2">Chọn kỳ thanh toán cũ muốn copy *</label>
                                <select 
                                    value={cloneSourcePeriod}
                                    onChange={(e) => setCloneSourcePeriod(e.target.value)}
                                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 transition"
                                >
                                    <option value="">-- Chọn kỳ cũ --</option>
                                    {allPeriods.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-black text-slate-900 mb-2">Nhập tên/ngày cho kỳ thanh toán mới *</label>
                                <input 
                                    type="text" 
                                    value={cloneTargetPeriod}
                                    onChange={(e) => setCloneTargetPeriod(e.target.value)}
                                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 transition"
                                    placeholder="Ví dụ: 15/07/2026..."
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-slate-100">
                                <button 
                                    onClick={() => { setIsClonePeriodModalOpen(false); setCloneSourcePeriod(''); setCloneTargetPeriod(''); }} 
                                    className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition"
                                >
                                    Hủy
                                </button>
                                <button 
                                    onClick={() => handleClonePeriod(cloneSourcePeriod, cloneTargetPeriod)} 
                                    disabled={!cloneSourcePeriod || !cloneTargetPeriod || cloneTargetPeriod.trim() === ''}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold transition flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <CheckCircle2 size={18} /> Xác nhận Thêm
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {deletePeriodState.isOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-red-600 px-6 py-4 flex justify-between items-center">
                            <h3 className="text-white font-bold text-lg flex items-center gap-2"><Trash2 size={20} /> Xác nhận xóa kỳ thanh toán</h3>
                            <button onClick={() => setDeletePeriodState(prev => ({...prev, isOpen: false}))} className="text-red-200 hover:text-white transition"><X /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-slate-600">Bạn đang yêu cầu <b>XÓA TOÀN BỘ</b> hóa đơn trong kỳ <b>&quot;{deletePeriodState.periodName}&quot;</b>.</p>
                            <div className="bg-red-50 text-red-800 p-4 rounded-xl text-sm border border-red-200">
                                <b>Cảnh báo:</b> Hành động này sẽ xóa vĩnh viễn dữ liệu của kỳ này và không thể phục hồi!
                            </div>
                            <div>
                                <label className="block text-sm font-black text-slate-900 mb-2">Vui lòng nhập mật khẩu tài khoản để xác nhận *</label>
                                <input 
                                    type="password" 
                                    value={deletePeriodState.password}
                                    onChange={(e) => setDeletePeriodState(prev => ({...prev, password: e.target.value, error: ''}))}
                                    onKeyDown={(e) => { if (e.key === 'Enter') confirmDeletePeriod(); }}
                                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-red-500 transition"
                                    placeholder="Nhập mật khẩu của bạn..."
                                    autoFocus
                                />
                                {deletePeriodState.error && <p className="text-red-500 text-sm mt-2 font-bold">{deletePeriodState.error}</p>}
                            </div>
                            <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-slate-100">
                                <button 
                                    onClick={() => setDeletePeriodState(prev => ({...prev, isOpen: false}))} 
                                    className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition"
                                >
                                    Hủy
                                </button>
                                <button 
                                    onClick={confirmDeletePeriod} 
                                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-xl font-bold transition flex items-center gap-2 shadow-lg"
                                >
                                    <Trash2 size={18} /> Xác nhận Xóa
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isConfirmTransferModalOpen && transferInvoice && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95">
                        <header className="bg-slate-900 text-white p-4 flex justify-between items-center">
                            <h3 className="font-black flex items-center gap-2 text-lg"><Coins size={20}/> Thanh Toán Phiếu</h3>
                            <button onClick={() => { setIsConfirmTransferModalOpen(false); setTransferInvoice(null); setTransferNote(''); }} className="text-slate-400 hover:text-white transition"><X/></button>
                        </header>
                        <div className="p-6 flex flex-col items-center">
                            <div className="w-full bg-slate-50 rounded-2xl p-4 mb-4 border border-slate-100 space-y-2">
                                <div className="flex justify-between items-center pb-2 border-b border-slate-200 border-dashed">
                                    <span className="text-slate-500 font-bold text-xs uppercase">Số tiền</span>
                                    <span className="font-black text-lg text-slate-800">{formatCurrency(parseFloat(transferInvoice.teamValue) || 0)} VNĐ</span>
                                </div>
                                <div className="flex justify-between items-center pb-2 border-b border-slate-200 border-dashed">
                                    <span className="text-slate-500 font-bold text-xs uppercase">Người lập</span>
                                    <span className="font-bold text-sm text-slate-700 uppercase">{transferInvoice.created_by || currentUser?.username || '-'}</span>
                                </div>
                                <div className="flex justify-between items-center pb-2 border-b border-slate-200 border-dashed">
                                    <span className="text-slate-500 font-bold text-xs uppercase">Công trình</span>
                                    <span className="font-bold text-sm text-slate-700 uppercase">{transferInvoice.projectName || '-'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 font-bold text-xs uppercase">Người nhận</span>
                                    <span className="font-bold text-sm text-slate-700 uppercase">{transferInvoice.account_name || transferInvoice.teamName || '-'}</span>
                                </div>
                            </div>
                            
                            {transferInvoice.bank_name && transferInvoice.account_number ? (
                                <div className="p-2 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 mb-6">
                                    <img 
                                        src={`https://img.vietqr.io/image/${getBankCodeForQR(transferInvoice.bank_name)}-${transferInvoice.account_number.trim()}-compact2.png?amount=${parseFloat(transferInvoice.teamValue) || 0}&accountName=${encodeURIComponent(transferInvoice.account_name || '')}`} 
                                        alt="VietQR" 
                                        className="w-[320px] h-[320px] object-contain rounded-xl bg-white mx-auto" 
                                    />
                                </div>
                            ) : (
                                <div className="text-sm text-red-500 font-bold p-3 mb-6">
                                    Không tìm thấy thông tin tài khoản ngân hàng để tạo QR!
                                </div>
                            )}
                            
                            <div className="w-full space-y-3">
                                <button 
                                    onClick={handleConfirmTransfer}
                                    className="w-full bg-emerald-600 text-white py-3.5 rounded-xl font-black shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 hover:-translate-y-0.5 transition-all flex justify-center items-center gap-2"
                                >
                                    <CheckCircle2 size={20} /> XÁC NHẬN ĐÃ CHUYỂN KHOẢN
                                </button>
                                <button 
                                    onClick={() => { setIsConfirmTransferModalOpen(false); setTransferInvoice(null); setTransferNote(''); }}
                                    className="w-full py-2.5 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition"
                                >
                                    Đóng lại
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isBulkAddModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center">
                            <h3 className="text-white font-bold text-lg flex items-center gap-2"><Plus size={20} /> Thêm HĐ Dự kiến theo tháng</h3>
                            <button onClick={() => { setIsBulkAddModalOpen(false); setBulkAddMonth(''); }} className="text-indigo-200 hover:text-white transition"><X /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-slate-600">Hệ thống sẽ tự động quét các đợt thanh toán (Thu thực tế) trong tháng bạn chọn và thêm vào danh sách HĐ Dự kiến.</p>
                            <div>
                                <label className="block text-sm font-black text-slate-900 mb-2">Chọn tháng *</label>
                                <input 
                                    type="month" 
                                    value={bulkAddMonth}
                                    onChange={(e) => setBulkAddMonth(e.target.value)}
                                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 transition"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-slate-100">
                                <button 
                                    onClick={() => { setIsBulkAddModalOpen(false); setBulkAddMonth(''); }} 
                                    className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition"
                                >
                                    Hủy
                                </button>
                                <button 
                                onClick={handleBulkAddByMonthV2}
                                    disabled={!bulkAddMonth}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold transition flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <CheckCircle2 size={18} /> Xác nhận Thêm
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isAdvanceModalOpen && advanceData && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-slate-900 px-6 py-4 flex justify-between items-center">
                            <h3 className="text-white font-bold text-lg flex items-center gap-2">Tạo Giao Dịch Tạm Ứng</h3>
                            <button onClick={() => { setIsAdvanceModalOpen(false); setAdvanceData(null); }} className="text-slate-400 hover:text-white transition"><X /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-black text-slate-900 mb-2">Công trình</label>
                                <input type="text" value={advanceData.project_name} readOnly className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-600 outline-none cursor-not-allowed" />
                            </div>
                            <div>
                                <label className="block text-sm font-black text-slate-900 mb-2">Người nhận (Tổ đội)</label>
                                <input type="text" value={advanceData.recipient} onChange={(e) => setAdvanceData({...advanceData, recipient: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 transition" />
                            </div>
                            <div>
                                <label className="block text-sm font-black text-slate-900 mb-2">Số tiền Tạm ứng (CHI)</label>
                                <input type="text" value={advanceData.amount ? formatCurrency(advanceData.amount) : ''} onChange={(e) => setAdvanceData({...advanceData, amount: parseVietnameseNumber(e.target.value)})} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2 text-sm font-black text-orange-600 outline-none focus:border-indigo-500 transition" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-black text-slate-900 mb-2">Mã chi phí (Nợ)</label>
                                    <input type="text" value={advanceData.code} onChange={(e) => setAdvanceData({...advanceData, code: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 transition" placeholder="VD: 622" />
                                </div>
                                <div>
                                    <label className="block text-sm font-black text-slate-900 mb-2">Tài khoản đối ứng (Có)</label>
                                    <input type="text" value={advanceData.corresponding_account} onChange={(e) => setAdvanceData({...advanceData, corresponding_account: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 transition" placeholder="VD: 1111 - Tiền mặt" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-black text-slate-900 mb-2">Ghi chú</label>
                                <input type="text" value={advanceData.note} onChange={(e) => setAdvanceData({...advanceData, note: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 transition" />
                            </div>
                            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-sm text-blue-800">
                                Giao dịch này sẽ được tự động ghi nhận vào <b>Sổ Thu/Chi</b> với loại hình là <b>CHI</b>.
                            </div>
                            <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-slate-100">
                                <button onClick={() => { setIsAdvanceModalOpen(false); setAdvanceData(null); }} className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition">Hủy</button>
                                <button 
                                    onClick={() => {
                                        if (onAddTransaction) {
                                            onAddTransaction('EXPENSE', {
                                                project_name: advanceData.project_name,
                                                accounting_date: new Date().toISOString().split('T')[0],
                                                recipient: advanceData.recipient,
                                                code: advanceData.code || '',
                                                corresponding_account: advanceData.corresponding_account || '',
                                                debit: advanceData.amount,
                                                note: advanceData.note
                                            });
                                            setIsAdvanceModalOpen(false);
                                            setAdvanceData(null);
                                        }
                                    }} 
                                    className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2.5 rounded-xl font-bold transition shadow-lg"
                                >
                                    Xác nhận Tạo
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isTeamInfoFormOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white">
                            <h3 className="font-bold text-lg">{editingId ? 'Cập nhật' : 'Thêm mới'} thông tin tổ đội</h3>
                            <button onClick={() => { setIsTeamInfoFormOpen(false); setEditingId(null); }} className="text-slate-400 hover:text-white transition"><X /></button>
                        </div>
                        <form onSubmit={handleSaveTeamInfo} className="p-6 flex flex-col gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">Tên tổ đội *</label>
                                    <select 
                                        value={isCustomTeamInfoName ? 'Khác' : (allProjectTeamNames.includes(teamInfoForm.team_name) ? teamInfoForm.team_name : (teamInfoForm.team_name ? 'Khác' : ''))}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === 'Khác') {
                                                setIsCustomTeamInfoName(true);
                                                setTeamInfoForm(prev => ({ ...prev, team_name: '' }));
                                            } else {
                                                setIsCustomTeamInfoName(false);
                                                setTeamInfoForm(prev => ({ ...prev, team_name: val }));
                                            }
                                        }}
                                        className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white transition"
                                    >
                                        <option value="">-- Chọn tổ đội từ công trình --</option>
                                        {allProjectTeamNames.map(name => (
                                            <option key={name} value={name}>{name}</option>
                                        ))}
                                        <option value="Khác">Khác...</option>
                                    </select>
                                    {(isCustomTeamInfoName || (!allProjectTeamNames.includes(teamInfoForm.team_name) && teamInfoForm.team_name)) && (
                                        <input 
                                            type="text" 
                                            value={teamInfoForm.team_name || ''}
                                            onChange={(e) => setTeamInfoForm(prev => ({ ...prev, team_name: e.target.value }))}
                                            className="w-full mt-2 bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white transition"
                                            placeholder="Nhập tên tổ đội..."
                                            required
                                        />
                                    )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">Tên tài khoản</label>
                                        <input 
                                            type="text" 
                                            value={teamInfoForm.account_name || ''}
                                            onChange={(e) => setTeamInfoForm(prev => ({ ...prev, account_name: e.target.value }))}
                                            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white transition"
                                            placeholder="Ví dụ: NGUYEN VAN A"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">Số tài khoản</label>
                                        <input 
                                            type="text" 
                                            value={teamInfoForm.account_number || ''}
                                            onChange={(e) => setTeamInfoForm(prev => ({ ...prev, account_number: e.target.value }))}
                                            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white transition"
                                            placeholder="Nhập số tài khoản..."
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">Ngân hàng</label>
                                    <input 
                                        type="text" 
                                        value={teamInfoForm.bank_name || ''}
                                        onChange={(e) => setTeamInfoForm(prev => ({ ...prev, bank_name: e.target.value }))}
                                        className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white transition"
                                        placeholder="Ví dụ: VIETINBANK"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 w-full justify-end border-t border-slate-100 pt-4">
                                <button 
                                    type="button" 
                                    onClick={() => { setIsTeamInfoFormOpen(false); setEditingId(null); }}
                                    className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition text-sm whitespace-nowrap"
                                >
                                    Hủy
                                </button>
                                <button 
                                    type="submit" 
                                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition text-sm whitespace-nowrap"
                                >
                                    Lưu lại
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={confirmDeleteTeamInfoId !== null}
                title="Xác nhận xóa"
                message="Bạn có chắc chắn muốn xóa thông tin tài khoản của tổ đội này? Hành động này không thể hoàn tác."
                onConfirm={() => handleDeleteTeamInfo(confirmDeleteTeamInfoId)}
                onCancel={() => setConfirmDeleteTeamInfoId(null)}
                type="danger"
            />
        </div>
    );
}
