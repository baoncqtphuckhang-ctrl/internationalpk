'use client';
/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

import React, { useState, useMemo, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Dashboard from '@/components/Dashboard';
import HistoryTable from '@/components/HistoryTable';
import InputForm from '@/components/InputForm';
import LoginForm from '@/components/LoginForm';
import ApprovalWorkflow from '@/components/ApprovalWorkflow';
import ProjectManager from '@/components/ProjectManager';
import ExpenseSummary from '@/components/ExpenseSummary';
import ExcelImportModal from '@/components/ExcelImportModal';
import MaterialOrder from '@/components/MaterialOrder';
import MaterialOrderManager from '@/components/MaterialOrderManager';
import ExpectedInvoices from '@/components/ExpectedInvoices';
import ConfirmModal from '@/components/ConfirmModal';
import UserModal from '@/components/UserModal';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDateVN, parseVietnameseNumber, parseDateVN } from '@/lib/utils';
import { AlertCircle, CheckCircle2, Plus, Trash2, Key, Edit3 } from 'lucide-react';

// --- CONFIG & CONSTANTS ---
const ROLES = {
    ADMIN: 'ADMIN', GIAMDOC: 'GIÁM ĐỐC', THUKY: 'THƯ KÝ',
    QS: 'QS', GS: 'GS', KETOAN: 'KẾ TOÁN'
};

const STATUSES = {
    DRAFT: 'Draft', WAITING_QS: 'Waiting QS', WAITING_ACC: 'Waiting Accounting',
    APPROVED: 'Approved', REJECTED: 'Rejected', PAID: 'Paid', ACCOUNTED: 'Accounted'
};

const MOCK_USERS = [
    { id: 'u1', username: 'admin', password: '0000', role: ROLES.ADMIN, name: 'Quản trị hệ thống', isLocked: false },
    { id: 'u2', username: 'giamdoc', password: '1', role: ROLES.GIAMDOC, name: 'Giám Đốc', isLocked: false },
    { id: 'u3', username: 'qs_01', password: '1', role: ROLES.QS, name: 'Nguyễn Văn QS', isLocked: false },
    { id: 'u6', username: 'ketoan_01', password: '1', role: ROLES.KETOAN, name: 'Kế toán trưởng', isLocked: false },
];

export default function Home() {
    const [usersList, setUsersList] = useState(MOCK_USERS);
    const [isUsersLoaded, setIsUsersLoaded] = useState(false);

    useEffect(() => {
        const savedUsers = localStorage.getItem('usersList');
        if (savedUsers) {
            try { setUsersList(JSON.parse(savedUsers)); } catch(e) {}
        }
        setIsUsersLoaded(true);
    }, []);

    useEffect(() => {
        if (isUsersLoaded) {
            localStorage.setItem('usersList', JSON.stringify(usersList));
        }
    }, [usersList, isUsersLoaded]);
    const [currentUser, setCurrentUser] = useState(null);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [projects, setProjects] = useState([]);
    const [projectDetails, setProjectDetails] = useState({});
    const [transactions, setTransactions] = useState([]);
    const [incomes, setIncomes] = useState([]);
    const [dnttList, setDnttList] = useState([]);
    const [dashboardProjectFilter, setDashboardProjectFilter] = useState('');
    const [selectedProject, setSelectedProject] = useState('');
    const [previousTab, setPreviousTab] = useState(null);
    
    const [isLoading, setIsLoading] = useState(true);
    const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });
    const [userModal, setUserModal] = useState({ isOpen: false, user: null });
    
    const showToast = (msg, type = 'success') => {
        setToast({ show: true, msg, type });
        setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 3000);
    };

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data: projData } = await supabase.from('projects').select('*').order('name');
            setProjects(projData || []);
            if (projData?.length > 0 && !selectedProject) setSelectedProject(projData[0].name);

            const details = {};
            projData?.forEach(p => {
                details[p.name] = { 
                    contractValueAfterTax: p.contract_value_after_tax,
                    advanceValue: p.advance_value,
                    debtToCollect: p.debt_to_collect || 0,
                    contractNo: p.contract_no,
                    address: p.address || '',
                    chtName: p.cht_name || '',
                    chtPhone: p.cht_phone || ''
                };
            });
            setProjectDetails(details);

            let allTrans = [];
            let page = 0;
            const pageSize = 1000;
            while(true) {
                const { data, error } = await supabase
                    .from('transactions')
                    .select('*')
                    .order('accounting_date', { ascending: false })
                    .range(page * pageSize, (page + 1) * pageSize - 1);
                
                if (error) {
                    console.error('Fetch transactions error:', error);
                    break;
                }
                
                if (data && data.length > 0) {
                    allTrans = [...allTrans, ...data];
                    if (data.length < pageSize) break;
                    page++;
                } else {
                    break;
                }
            }

            const normalizedTransData = allTrans.map(t => ({
                ...t,
                code: t.code ? t.code.toString().trim().replace(',', '.') : t.code
            }));
            setTransactions(normalizedTransData);

            const { data: incData } = await supabase.from('incomes').select('*').order('date', { ascending: false });
            setIncomes(incData || []);

            const { data: approvalData } = await supabase.from('approval_requests').select('*').order('created_at', { ascending: false });
            setDnttList(approvalData || []);
        } catch (error) {
            showToast('Lỗi kết nối Database!', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (currentUser) fetchData();
    }, [currentUser]);

    const [editTransaction, setEditTransaction] = useState(null);

    const [isPasting, setIsPasting] = useState(false);
    const [pasteText, setPasteText] = useState('');

        const handleConfirmImport = async (processedTransactions) => {
            setIsLoading(true);
            try {
                const { error } = await supabase.from('transactions').insert(processedTransactions);
                if (error) throw error;
                showToast(`Đã nhập thành công ${processedTransactions.length} dòng dữ liệu!`);
                setPasteText('');
                setIsPasting(false);
                fetchData();
            } catch (error) {
                showToast('Lỗi khi lưu dữ liệu vào Database!', 'error');
            } finally {
                setIsLoading(false);
            }
        };

    const handleAddData = async (type, data, editId = null) => {
        setIsLoading(true);
        try {
            if (type === 'EXPENSE') {
                const payload = {
                    project_name: data.project_name,
                    accounting_date: data.accounting_date,
                    code: data.code,
                    debit: data.debit,
                    note: data.note,
                    created_by: currentUser.username
                };
                if (editId) {
                    const { error } = await supabase.from('transactions').update(payload).eq('id', editId);
                    if (error) throw error;
                } else {
                    const { error } = await supabase.from('transactions').insert([payload]);
                    if (error) throw error;
                }
            } else {
                const payload = {
                    project_name: data.project_name,
                    date: data.accounting_date,
                    phase: data.phase,
                    amount: data.amount,
                    is_paid: true,
                    created_by: currentUser.username
                };
                if (editId) {
                    const { error } = await supabase.from('incomes').update(payload).eq('id', editId);
                    if (error) throw error;
                } else {
                    const { error } = await supabase.from('incomes').insert([payload]);
                    if (error) throw error;
                }
            }
            showToast('Đã lưu dữ liệu thành công!');
            setEditTransaction(null);
            if (previousTab) {
                setActiveTab(previousTab);
                setPreviousTab(null);
            }
            fetchData();
        } catch (error) {
            showToast('Lỗi khi lưu dữ liệu!', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditTransaction = (t) => {
        setEditTransaction({ ...t, type: t.phase ? 'INCOME' : 'EXPENSE' });
        setPreviousTab(activeTab);
        setActiveTab('input');
    };

    const handleProjectDoubleClick = (projectName) => {
        setSelectedProject(projectName);
        setActiveTab('project-detail');
    };


    const handleTogglePhasePaid = async (projectName, phase, isFullyPaid) => {
        setIsLoading(true);
        try {
            const { error } = await supabase
                .from('incomes')
                .update({ is_paid: !isFullyPaid })
                .eq('project_name', projectName)
                .eq('phase', phase);
            
            if (error) throw error;
            showToast(`Đã ${!isFullyPaid ? 'xác nhận thu tiền' : 'hủy xác nhận thu tiền'} đợt ${phase}!`);
            fetchData();
        } catch (error) {
            console.error(error);
            showToast('Lỗi khi cập nhật trạng thái thu tiền!', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpsertProject = async (data, isEdit) => {
        setIsLoading(true);
        try {
            if (isEdit) {
                const { error } = await supabase.from('projects').update({
                    contract_no: data.contract_no,
                    contract_value_after_tax: data.contract_value_after_tax,
                    advance_value: data.advance_value,
                    debt_to_collect: data.debt_to_collect,
                    address: data.address,
                    cht_name: data.cht_name,
                    cht_phone: data.cht_phone
                }).eq('name', data.name);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('projects').insert([{
                    name: data.name,
                    contract_no: data.contract_no,
                    contract_value_after_tax: data.contract_value_after_tax,
                    advance_value: data.advance_value,
                    debt_to_collect: data.debt_to_collect,
                    address: data.address,
                    cht_name: data.cht_name,
                    cht_phone: data.cht_phone
                }]);
                if (error) throw error;
            }
            showToast('Đã cập nhật thông tin công trình!');
            fetchData();
        } catch (error) {
            console.error('Error saving project:', error);
            showToast('Lỗi khi lưu công trình!', 'error');
        } finally {
            setIsLoading(false);
        }
    };
    const handleDeleteProject = async (name) => {
        setIsLoading(true);
        try {
            // Xóa dữ liệu ở các bảng liên quan (nếu có)
            await supabase.from('transactions').delete().eq('project_name', name);
            await supabase.from('incomes').delete().eq('project_name', name);
            await supabase.from('approval_requests').delete().eq('project_name', name);

            // Xóa công trình chính
            const { error } = await supabase.from('projects').delete().eq('name', name);
            if (error) throw error;
            
            showToast('Đã xóa công trình!');
            if (selectedProject === name) setSelectedProject('');
            fetchData();
        } catch (error) {
            console.error('Delete Error:', error);
            // Nếu lỗi do khóa ngoại hoặc bảng không tồn tại, vẫn cố gắng fetch lại
            showToast('Lỗi khi xóa công trình! Vui lòng kiểm tra lại dữ liệu liên quan.', 'error');
            fetchData();
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyTable = (tableId) => {
        const table = document.getElementById(tableId);
        if (!table) return;
        
        // Chuyển đổi bảng thành dạng Tab-Separated Values (TSV) để dán vào Excel chuẩn nhất
        let tsv = [];
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
            let rowData = [];
            // Lấy tất cả th và td, bỏ cột cuối (Thao tác)
            const cells = Array.from(row.querySelectorAll('th, td'));
            const dataCells = cells.slice(0, cells.length - 1);
            
            dataCells.forEach(cell => {
                // Bỏ qua các element input/filter trong header
                let text = cell.innerText.split('\n')[0].trim();
                rowData.push(text);
            });
            tsv.push(rowData.join('\t'));
        });

        const tsvString = tsv.join('\n');
        navigator.clipboard.writeText(tsvString).then(() => {
            showToast('Đã copy dữ liệu chuẩn Excel!');
        }).catch(err => {
            showToast('Lỗi khi copy!', 'error');
        });
    };

    const exportTableToExcel = (tableId, filename) => {
        const originalTable = document.getElementById(tableId);
        if (!originalTable) return;
        
        const projectName = selectedProject || 'Tat_ca_cong_trinh';
        const finalFilename = `${filename}_${projectName}_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}`;

        const table = originalTable.cloneNode(true);
        table.querySelectorAll('input, button, svg, .filter-dropdown').forEach(el => el.remove());
        
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
            if (row.lastElementChild) row.lastElementChild.remove();
            
            Array.from(row.children).forEach(cell => {
                if (cell.tagName === 'TH') {
                    cell.innerHTML = cell.innerText.trim().split('\n')[0];
                    cell.style.textAlign = 'center';
                } else {
                    const text = cell.innerText.trim();
                    const isCurrency = cell.classList.contains('text-right') && (text.includes('.') || text.includes(',') || !isNaN(text.replace(/\./g, '')));
                    if (!isCurrency) {
                        cell.style.msoNumberFormat = '"\\@"';
                    }
                    cell.style.verticalAlign = 'middle';
                    
                    if (cell.classList.contains('text-right')) {
                        cell.style.textAlign = 'right';
                    } else if (cell.classList.contains('text-left') || cell.classList.contains('max-w-[250px]')) {
                        cell.style.textAlign = 'left';
                    } else {
                        cell.style.textAlign = 'center';
                    }
                }
            });
        });

        const html = '\uFEFF' + `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: 'Times New Roman', serif; }
                    .header-title { font-size: 24px; font-weight: bold; color: #1e40af; text-align: center; padding: 20px 0; text-transform: uppercase; }
                    .sub-title { font-size: 14px; text-align: center; color: #64748b; padding-bottom: 20px; font-style: italic; }
                    table { border-collapse: collapse; width: 100%; }
                    th { background-color: #1e40af; color: #ffffff; font-weight: bold; border: 1px solid #94a3b8; padding: 12px 8px; text-align: center; vertical-align: middle; }
                    td { border: 1px solid #cbd5e1; padding: 10px 8px; vertical-align: middle; }
                    tr:nth-child(even) td { background-color: #f8fafc; }
                </style>
            </head>
            <body>
                <div class="header-title">BÁO CÁO CHI TIẾT CÔNG TRÌNH</div>
                <div class="sub-title">Công trình: ${projectName} | Ngày xuất: ${new Date().toLocaleString('vi-VN')}</div>
                ${table.outerHTML}
            </body>
            </html>
        `;
        
        const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = finalFilename + '.xls';
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        showToast('Đã xuất báo cáo chuyên nghiệp!');
    };

    const handleDeleteTransaction = async (id) => {
        setIsLoading(true);
        try {
            const { error } = await supabase.from('transactions').delete().eq('id', id);
            if (error) throw error;
            showToast('Đã xóa dữ liệu chi!');
            fetchData();
        } catch (error) {
            showToast('Lỗi khi xóa dữ liệu!', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteIncome = async (id) => {
        setIsLoading(true);
        try {
            const { error } = await supabase.from('incomes').delete().eq('id', id);
            if (error) throw error;
            showToast('Đã xóa dữ liệu thu!');
            fetchData();
        } catch (error) {
            showToast('Lỗi khi xóa dữ liệu thu!', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteAllTransactions = async () => {
        if (!selectedProject) {
            showToast('Vui lòng chọn một công trình cụ thể!', 'error');
            return;
        }

        const pass = prompt('Vui lòng nhập mật khẩu tài khoản ADMIN để xác nhận thao tác xóa:');
        if (pass !== currentUser.password) {
            alert('Mật khẩu không chính xác! Hủy thao tác xóa.');
            return;
        }

        setIsLoading(true);
        try {
            const { error } = await supabase.from('transactions').delete().eq('project_name', selectedProject);
            if (error) throw error;
            showToast(`Đã xóa toàn bộ dữ liệu giao dịch của công trình ${selectedProject}!`);
            fetchData();
        } catch (error) {
            showToast('Lỗi khi xóa dữ liệu!', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddDNTT = async (data) => {
        setIsLoading(true);
        try {
            const { error } = await supabase.from('approval_requests').insert([{
                ...data,
                created_by: currentUser.username,
                status: STATUSES.WAITING_QS
            }]);
            if (error) throw error;
            showToast('Đã gửi yêu cầu phê duyệt!');
            fetchData();
        } catch (error) {
            showToast('Lỗi khi gửi yêu cầu!', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteApproval = async (id) => {
        setConfirmModal({
            isOpen: true,
            message: 'Bạn có chắc chắn muốn xóa phiếu này và toàn bộ dữ liệu (giao dịch, đơn hàng) liên quan?',
            onConfirm: async () => {
                setConfirmModal({ isOpen: false, message: '', onConfirm: null });
                setIsLoading(true);
        try {
            // 1. Xóa các giao dịch liên quan trong bảng transactions
            const { error: transError } = await supabase.from('transactions').delete().ilike('note', `%[ID:${id}]%`);
            if (transError) throw transError;

            // 2. Xóa đơn đặt hàng vật tư liên quan (đồng bộ)
            const dntt = dnttList.find(d => d.id === id);
            if (dntt && dntt.doc_type === 'Đơn Vật Tư') {
                try {
                    const r = JSON.parse(dntt.reason);
                    if (r.date && r.project) {
                        await supabase.from('material_orders')
                            .delete()
                            .eq('project_name', r.project)
                            .eq('order_date', r.date)
                            .eq('recipient', r.recipient || dntt.recipient);
                    }
                } catch(e) {}
            }

            // 3. Xóa phiếu phê duyệt
            const { error: appError } = await supabase.from('approval_requests').delete().eq('id', id);
            if (appError) throw appError;

            showToast('Đã xóa phiếu và dữ liệu đồng bộ liên quan!');
            fetchData();
        } catch (error) {
            console.error(error);
            showToast('Lỗi khi xóa dữ liệu!', 'error');
        } finally {
            setIsLoading(false);
        }
            }
        });
    };

    const handleUpdateApprovalStatus = async (id, newStatus) => {
        setIsLoading(true);
        try {
            const { error } = await supabase.from('approval_requests').update({ status: newStatus }).eq('id', id);
            if (error) throw error;
            showToast('Đã cập nhật trạng thái!');
            fetchData();
        } catch (error) {
            showToast('Lỗi khi cập nhật!', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAccountDNTT = async (id, distribution) => {
        setIsLoading(true);
        try {
            // 1. Chèn các dòng giao dịch vào transactions, đính kèm ID phiếu vào note để liên kết
            const { error: transError } = await supabase.from('transactions').insert(distribution.map(d => ({
                ...d,
                note: `[ID:${id}] ${d.note}`,
                accounting_date: new Date().toISOString().split('T')[0],
                created_by: currentUser.username
            })));
            if (transError) throw transError;

            // 2. Cập nhật trạng thái DNTT sang ACCOUNTED (và cập nhật tổng tiền hạch toán thực tế)
            const totalSum = distribution.reduce((sum, d) => sum + (d.debit || 0), 0);
            const { error: statusError } = await supabase.from('approval_requests').update({ 
                status: STATUSES.ACCOUNTED,
                total_amount: totalSum
            }).eq('id', id);
            if (statusError) throw statusError;

            showToast('Đã hạch toán chi phí thành công!');
            fetchData();
        } catch (error) {
            console.error(error);
            showToast('Lỗi khi hạch toán!', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateAccountingRequest = async (dnttPayload) => {
        setIsLoading(true);
        try {
            const { error } = await supabase.from('approval_requests').insert([{
                ...dnttPayload,
                created_by: currentUser.username
            }]);
            if (error) throw error;
            showToast('Đơn đặt hàng đã được chuyển sang kế toán hạch toán!');
            fetchData();
        } catch (error) {
            console.error('Error creating accounting request:', error);
            showToast('Lỗi khi chuyển tiếp kế toán!', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleExportBackup = () => {
        const fileName = `Backup_ToanBoDuLieu_${new Date().toISOString().split('T')[0]}`;
        
        let rowsHtml = '';
        const sortedTrans = [...transactions].sort((a, b) => new Date(a.accounting_date) - new Date(b.accounting_date));
        
        sortedTrans.forEach((t, i) => {
            const dateObj = new Date(t.accounting_date);
            const formattedDate = !isNaN(dateObj.getTime()) ? `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getFullYear()}` : t.accounting_date;
            
            rowsHtml += `
                <tr>
                    <td style="border: 1px solid #000; text-align: center; vertical-align: middle; font-family: 'Times New Roman'; font-size: 11pt;">${i + 1}</td>
                    <td style="border: 1px solid #000; text-align: center; vertical-align: middle; font-family: 'Times New Roman'; font-size: 11pt;">${formattedDate}</td>
                    <td style="border: 1px solid #000; vertical-align: middle; font-family: 'Times New Roman'; font-size: 11pt;">${t.project_name || ''}</td>
                    <td style="border: 1px solid #000; text-align: center; vertical-align: middle; font-family: 'Times New Roman'; font-size: 11pt;">${t.code || ''}</td>
                    <td style="border: 1px solid #000; text-align: center; vertical-align: middle; font-family: 'Times New Roman'; font-size: 11pt;">${t.corresponding_account || ''}</td>
                    <td style="border: 1px solid #000; text-align: right; vertical-align: middle; font-family: 'Times New Roman'; font-size: 11pt;">${t.debit > 0 ? Number(t.debit).toLocaleString('en-US') : ''}</td>
                    <td style="border: 1px solid #000; text-align: right; vertical-align: middle; font-family: 'Times New Roman'; font-size: 11pt;">${t.credit > 0 ? Number(t.credit).toLocaleString('en-US') : ''}</td>
                    <td style="border: 1px solid #000; vertical-align: middle; font-family: 'Times New Roman'; font-size: 11pt;">${t.recipient || ''}</td>
                    <td style="border: 1px solid #000; vertical-align: middle; font-family: 'Times New Roman'; font-size: 11pt;">${t.note || ''}</td>
                </tr>
            `;
        });

        const html = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head><meta charset="utf-8"></head>
            <body>
                <table style="border-collapse: collapse; font-family: 'Times New Roman';">
                    <tr><th colspan="9" style="font-size: 16pt; font-weight: bold; text-align: center; height: 40px; vertical-align: middle;">BACKUP GIAO DỊCH TOÀN BỘ CÔNG TRÌNH</th></tr>
                    <tr style="background-color: #e6e6e6; height: 30px;">
                        <th style="border: 1px solid #000; width: 50px;">STT</th>
                        <th style="border: 1px solid #000; width: 100px;">Ngày HT</th>
                        <th style="border: 1px solid #000; width: 150px;">Công trình</th>
                        <th style="border: 1px solid #000; width: 80px;">Tài khoản</th>
                        <th style="border: 1px solid #000; width: 80px;">TK đối ứng</th>
                        <th style="border: 1px solid #000; width: 120px;">Phát sinh Nợ</th>
                        <th style="border: 1px solid #000; width: 120px;">Phát sinh Có</th>
                        <th style="border: 1px solid #000; width: 200px;">Đối tượng</th>
                        <th style="border: 1px solid #000; width: 250px;">Diễn giải</th>
                    </tr>
                    ${rowsHtml}
                </table>
            </body>
            </html>
        `;

        const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = fileName + '.xls';
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        showToast('Đã xuất file Backup thành công!');
    };

    const role = currentUser?.role?.toUpperCase();
    const canManageUsers = ['ADMIN', 'GIÁM ĐỐC', 'PHÓ GIÁM ĐỐC', 'PHÓ GĐ'].includes(role);
    const canManageSystem = canManageUsers || ['KẾ TOÁN', 'QS'].includes(role);
    const canViewApprovals = canManageSystem || role === 'THƯ KÝ';
    const canInputData = canManageSystem || role === 'THƯ KÝ';
    const canViewDashboard = ['ADMIN', 'GIÁM ĐỐC', 'PHÓ GIÁM ĐỐC', 'PHÓ GĐ', 'KẾ TOÁN', 'QS', 'THƯ KÝ'].includes(role);
    const canViewReports = currentUser?.canViewFinance !== false;
    const canCreateDNTT = true;

    const assignedProjectNames = useMemo(() => {
        if (!currentUser) return [];
        if (['ADMIN', 'GIÁM ĐỐC', 'PHÓ GIÁM ĐỐC', 'PHÓ GĐ', 'KẾ TOÁN', 'QS', 'THƯ KÝ'].includes(role)) {
            return projects.map(p => p.name);
        }
        return projects.filter(p => {
            const details = projectDetails[p.name] || {};
            const chtName = details.chtName || '';
            if (chtName && currentUser.name) {
                const normCht = chtName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                const normUser = currentUser.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                if (normCht.includes(normUser) || normUser.includes(normCht)) return true;
            }
            if (chtName && currentUser.username) {
                if (chtName.toLowerCase().includes(currentUser.username.toLowerCase())) return true;
            }
            return false;
        }).map(p => p.name);
    }, [currentUser, projects, projectDetails, role]);

    const allowedProjects = useMemo(() => projects.filter(p => assignedProjectNames.includes(p.name)), [projects, assignedProjectNames]);
    const allowedTransactions = useMemo(() => transactions.filter(t => assignedProjectNames.includes(t.project_name)), [transactions, assignedProjectNames]);
    const allowedIncomes = useMemo(() => incomes.filter(i => assignedProjectNames.includes(i.project_name)), [incomes, assignedProjectNames]);
    const allowedDnttList = useMemo(() => dnttList.filter(d => assignedProjectNames.includes(d.project_name)), [dnttList, assignedProjectNames]);

    const allPhases = useMemo(() => Array.from(new Set(allowedIncomes.map(i => i.phase))).sort(), [allowedIncomes]);
    const dashboardData = useMemo(() => {
        return allowedProjects.map(p => {
            const name = p.name;
            const details = projectDetails[name] || { contractValueAfterTax: 0 };
            const exp = allowedTransactions.filter(t => t.project_name === name).reduce((sum, t) => sum + (t.debit || 0) - (t.credit || 0), 0);
            const projIncomes = allowedIncomes.filter(i => i.project_name === name);
            const actInc = projIncomes.filter(i => i.is_paid).reduce((sum, i) => sum + i.amount, 0);
            const calculatedDebtToCollect = projIncomes.filter(i => !i.is_paid).reduce((sum, i) => sum + i.amount, 0);
            
            const phaseData = {};
            allPhases.forEach(phase => {
                const phaseIncs = projIncomes.filter(i => i.phase === phase);
                phaseData[phase] = {
                    total: phaseIncs.reduce((sum, i) => sum + i.amount, 0),
                    paid: phaseIncs.filter(i => i.is_paid).reduce((sum, i) => sum + i.amount, 0)
                };
            });

            return {
                project: name,
                contractValueAfterTax: details.contractValueAfterTax,
                debtToCollect: calculatedDebtToCollect,
                totalExpense: exp,
                totalActualIncome: actInc,
                profit: actInc - exp,
                phases: phaseData
            };
        });
    }, [allowedProjects, projectDetails, allowedTransactions, allowedIncomes, allPhases]);

    const totals = useMemo(() => {
        return dashboardData.reduce((acc, row) => ({
            contractValueAfterTax: acc.contractValueAfterTax + (row.contractValueAfterTax || 0),
            debtToCollect: acc.debtToCollect + (row.debtToCollect || 0),
            totalExpense: acc.totalExpense + row.totalExpense,
            totalActualIncome: acc.totalActualIncome + row.totalActualIncome,
            profit: acc.profit + row.profit
        }), { contractValueAfterTax: 0, debtToCollect: 0, totalExpense: 0, totalActualIncome: 0, profit: 0 });
    }, [dashboardData]);

    if (!currentUser) return <LoginForm onLogin={setCurrentUser} usersList={usersList} />;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-800 relative">
            {toast.show && (
                <div className={`fixed top-4 right-4 z-[9999] px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-in slide-in-from-right font-bold text-white ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
                    {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                    {toast.msg}
                </div>
            )}

            <Sidebar 
                currentUser={currentUser}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                projects={allowedProjects}
                selectedProject={selectedProject}
                setSelectedProject={setSelectedProject}
                handleLogout={() => setCurrentUser(null)}
                canViewDashboard={canViewDashboard}
                canViewReports={canViewReports}
                canInputData={canInputData}
                canCreateDNTT={canCreateDNTT}
                canManageSystem={canManageSystem}
                canManageUsers={canManageUsers}
                canViewApprovals={canViewApprovals}
                dnttList={allowedDnttList}
                STATUSES={STATUSES}
                onDeleteProject={handleDeleteProject}
            />

            <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full max-w-full">
                {isLoading && (
                    <div className="fixed inset-0 bg-white/30 z-[200] flex items-center justify-center backdrop-blur-sm">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                )}

                {activeTab === 'dashboard' && <Dashboard filteredDashboardData={dashboardData} allPhases={allPhases} totals={totals} dashboardProjectFilter={dashboardProjectFilter} setDashboardProjectFilter={setDashboardProjectFilter} handleTogglePhasePaid={handleTogglePhasePaid} handleCopyTable={handleCopyTable} exportTableToExcel={exportTableToExcel} />}
                
                {activeTab === 'expense-summary' && <ExpenseSummary projects={allowedProjects} projectDetails={projectDetails} transactions={allowedTransactions} handleCopyTable={handleCopyTable} exportTableToExcel={exportTableToExcel} onProjectDoubleClick={handleProjectDoubleClick} />}
                
                {activeTab === 'history' && <HistoryTable transactions={allowedTransactions} selectedProject={''} projects={allowedProjects} handleEdit={handleEditTransaction} handleDelete={handleDeleteTransaction} handleDeleteAll={handleDeleteAllTransactions} canDelete={canManageSystem} isAdmin={role === 'ADMIN'} setIsPasting={setIsPasting} handleCopyTable={handleCopyTable} exportTableToExcel={exportTableToExcel} />}
                
                {activeTab === 'input' && <InputForm projects={allowedProjects} onSubmit={handleAddData} isLoading={isLoading} editData={editTransaction} incomes={incomes} onCancel={() => { setActiveTab(previousTab || 'history'); setEditTransaction(null); }} />}
                
                {(activeTab === 'dntt' || activeTab === 'approvals') && (
                    <ApprovalWorkflow 
                        activeTab={activeTab}
                        currentUser={currentUser}
                        projects={allowedProjects}
                        dnttList={allowedDnttList}
                        onAddDNTT={handleAddDNTT}
                        onUpdateStatus={handleUpdateApprovalStatus}
                        onAccountDNTT={handleAccountDNTT}
                        onDeleteApproval={handleDeleteApproval}
                        isLoading={isLoading}
                        STATUSES={STATUSES}
                        ROLES={ROLES}
                    />
                )}

                {activeTab === 'projects' && (
                    <ProjectManager 
                        projects={projects}
                        projectDetails={projectDetails}
                        onUpsertProject={handleUpsertProject}
                        onDeleteProject={handleDeleteProject}
                        isLoading={isLoading}
                        usersList={usersList}
                    />
                )}

                {activeTab === 'material-orders' && (
                    <MaterialOrder 
                        currentUser={currentUser}
                        projects={allowedProjects}
                        showToast={showToast}
                        onCreateAccountingRequest={handleCreateAccountingRequest}
                    />
                )}

                {activeTab === 'manage-material-orders' && (
                    <MaterialOrderManager 
                        currentUser={currentUser}
                        projects={allowedProjects}
                        dnttList={allowedDnttList}
                        showToast={showToast}
                    />
                )}

                {activeTab === 'expected-invoices' && (
                    <ExpectedInvoices 
                        projects={allowedProjects} 
                        projectDetails={projectDetails}
                    />
                )}

                {activeTab === 'project-detail' && (
                    <div className="animate-in fade-in duration-500">
                        <header className="mb-6">
                            <h2 className="text-2xl font-bold text-slate-800">Chi tiết Công trình: {selectedProject}</h2>
                            <p className="text-slate-500 text-sm mt-1">Thông tin chi tiết và các giao dịch liên quan.</p>
                        </header>
                        {currentUser?.canViewFinance !== false && (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                    <div className="bg-blue-600 p-6 rounded-2xl text-white shadow-lg">
                                        <p className="text-xs font-bold uppercase opacity-80">Giá trị Hợp đồng</p>
                                        <p className="text-3xl font-black mt-2">{formatCurrency(projectDetails[selectedProject]?.contractValueAfterTax || 0)}</p>
                                    </div>
                                    <div className="bg-amber-500 p-6 rounded-2xl text-white shadow-lg">
                                        <p className="text-xs font-bold uppercase opacity-80">Đã Tạm ứng</p>
                                        <p className="text-3xl font-black mt-2">{formatCurrency(projectDetails[selectedProject]?.advanceValue || 0)}</p>
                                    </div>
                                    <div className="bg-slate-800 p-6 rounded-2xl text-white shadow-lg">
                                        <p className="text-xs font-bold uppercase opacity-80">Tổng Chi Phí</p>
                                        <p className="text-3xl font-black mt-2">{formatCurrency(allowedTransactions.filter(t => t.project_name === selectedProject).reduce((sum, t) => sum + (t.debit || 0), 0))}</p>
                                    </div>
                                </div>
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
                                    <h3 className="bg-emerald-600 text-white p-4 font-bold uppercase text-sm flex items-center gap-2">Chi tiết Thu</h3>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="bg-slate-50 border-b">
                                                    <th className="p-3 font-bold text-slate-700">Ngày</th>
                                                    <th className="p-3 font-bold text-slate-700">Đợt</th>
                                                    <th className="p-3 font-bold text-slate-700 text-right">Số tiền</th>
                                                    <th className="p-3 font-bold text-slate-700 text-center">Trạng thái</th>
                                                    {(canManageSystem || role === 'ADMIN') && <th className="p-3 font-bold text-slate-700 text-center">Thao tác</th>}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {allowedIncomes.filter(i => i.project_name === selectedProject).length === 0 ? (
                                                    <tr>
                                                        <td colSpan={canManageSystem || role === 'ADMIN' ? 5 : 4} className="p-4 text-center text-slate-500">Chưa có dữ liệu thu</td>
                                                    </tr>
                                                ) : (
                                                    allowedIncomes.filter(i => i.project_name === selectedProject).map(i => (
                                                        <tr key={i.id} className="border-b hover:bg-slate-50">
                                                            <td className="p-3">{formatDateVN(i.date)}</td>
                                                            <td className="p-3 font-bold text-slate-700">{i.phase}</td>
                                                            <td className="p-3 text-right font-black text-emerald-600">{formatCurrency(i.amount)}</td>
                                                            <td className="p-3 text-center">
                                                                <span className={`px-2 py-1 rounded text-xs font-bold ${i.is_paid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                                    {i.is_paid ? 'Đã thu' : 'Chưa thu'}
                                                                </span>
                                                            </td>
                                                            {(canManageSystem || role === 'ADMIN') && (
                                                                <td className="p-3 text-center">
                                                                    <div className="flex items-center justify-center gap-2">
                                                                        <button onClick={() => handleEditTransaction(i)} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded transition" title="Sửa">
                                                                            <Edit3 size={16} />
                                                                        </button>
                                                                        <button onClick={() => {
                                                                            if (window.confirm('Bạn có chắc chắn muốn xóa đợt thu này?')) handleDeleteIncome(i.id);
                                                                        }} className="text-red-500 hover:bg-red-50 p-1.5 rounded transition" title="Xóa">
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            )}
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <h3 className="text-xl font-bold text-slate-800 px-2 border-l-4 border-slate-800">Chi tiết Chi</h3>
                                </div>
                                <HistoryTable transactions={allowedTransactions} selectedProject={selectedProject} projects={allowedProjects} handleEdit={handleEditTransaction} handleDelete={handleDeleteTransaction} handleDeleteAll={handleDeleteAllTransactions} canDelete={canManageSystem} isAdmin={role === 'ADMIN'} setIsPasting={setIsPasting} handleCopyTable={handleCopyTable} exportTableToExcel={exportTableToExcel} />
                            </>
                        )}
                        {currentUser?.canViewFinance === false && (
                            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center text-slate-500">
                                <AlertCircle className="mx-auto text-slate-400 mb-3" size={32} />
                                <p className="font-bold">Bạn không có quyền xem số liệu Thu - Chi của công trình này.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'users' && (
                    <div className="animate-in fade-in duration-500 max-w-4xl mx-auto">
                        <header className="mb-6 flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">Quản lý Nhân viên</h2>
                                <p className="text-slate-500 text-sm mt-1">Thêm hoặc xóa tài khoản truy cập hệ thống.</p>
                            </div>
                            <button onClick={() => setUserModal({ isOpen: true, user: null })} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center gap-2">
                                <Plus size={18} /> Thêm nhân viên
                            </button>
                        </header>
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b">
                                    <tr>
                                        <th className="p-4 font-bold text-slate-700">Tên nhân viên</th>
                                        <th className="p-4 font-bold text-slate-700">Tài khoản</th>
                                        <th className="p-4 font-bold text-slate-700">Số ĐT</th>
                                        <th className="p-4 font-bold text-slate-700">Chức vụ (Role)</th>
                                        <th className="p-4 font-bold text-slate-700">Trạng thái</th>
                                        <th className="p-4 font-bold text-slate-700 text-right">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {usersList.map(u => (
                                        <tr key={u.id} className="border-b hover:bg-slate-50">
                                            <td className="p-4 font-bold text-slate-900">{u.name}</td>
                                            <td className="p-4 font-mono text-blue-600">@{u.username}</td>
                                            <td className="p-4 font-mono text-slate-500">{u.phone || '---'}</td>
                                            <td className="p-4"><span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-bold uppercase">{u.role}</span></td>
                                            <td className="p-4">
                                                <div className="flex flex-col gap-2">
                                                    <span className="flex items-center gap-1 text-green-600 font-bold"><CheckCircle2 size={14}/> Đang hoạt động</span>
                                                    {u.role === 'CHT' && (
                                                        <label className="flex items-center cursor-pointer group">
                                                            <div className="relative">
                                                                <input type="checkbox" className="sr-only" checked={u.canViewFinance !== false} onChange={() => {
                                                                    setUsersList(usersList.map(x => x.id === u.id ? { ...x, canViewFinance: u.canViewFinance === false } : x));
                                                                    showToast('Đã cập nhật quyền xem Thu - Chi!');
                                                                }} />
                                                                <div className={`block w-8 h-5 rounded-full transition ${u.canViewFinance !== false ? 'bg-blue-500' : 'bg-slate-300'}`}></div>
                                                                <div className={`dot absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition ${u.canViewFinance !== false ? 'transform translate-x-3' : ''}`}></div>
                                                            </div>
                                                            <span className="ml-2 text-[10px] font-bold uppercase text-slate-500 group-hover:text-blue-600 transition">Xem Thu-Chi</span>
                                                        </label>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4 text-right flex justify-end gap-1">
                                                <button onClick={() => setUserModal({ isOpen: true, user: u })} className="text-amber-500 hover:text-amber-600 p-2 hover:bg-amber-50 rounded transition" title="Sửa thông tin">
                                                    <Edit3 size={16} />
                                                </button>
                                                <button onClick={() => {
                                                    const newPass = prompt(`Nhập mật khẩu mới cho tài khoản ${u.username}:`);
                                                    if (newPass) {
                                                        setUsersList(usersList.map(x => x.id === u.id ? { ...x, password: newPass } : x));
                                                        showToast('Đã cập nhật mật khẩu!');
                                                    }
                                                }} className="text-indigo-400 hover:text-indigo-600 p-2 hover:bg-indigo-50 rounded transition" title="Đổi mật khẩu">
                                                    <Key size={16} />
                                                </button>
                                                <button onClick={() => {
                                                    if(u.username === 'admin') return alert('Không thể xóa Admin gốc!');
                                                    setConfirmModal({
                                                        isOpen: true,
                                                        message: `Bạn có chắc chắn muốn xóa tài khoản ${u.username}?`,
                                                        onConfirm: () => {
                                                            setUsersList(usersList.filter(x => x.id !== u.id));
                                                            showToast('Đã xóa tài khoản!');
                                                            setConfirmModal({ isOpen: false, message: '', onConfirm: null });
                                                        }
                                                    });
                                                }} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded transition" title="Xóa tài khoản">
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>

            <ExcelImportModal 
                isOpen={isPasting}
                onClose={() => setIsPasting(false)}
                onConfirm={handleConfirmImport}
                projectName={selectedProject}
                parseVietnameseNumber={parseVietnameseNumber}
                parseDateVN={parseDateVN}
            />

            <ConfirmModal 
                isOpen={confirmModal.isOpen} 
                message={confirmModal.message} 
                onConfirm={confirmModal.onConfirm} 
                onCancel={() => setConfirmModal({ isOpen: false, message: '', onConfirm: null })} 
            />

            <UserModal
                isOpen={userModal.isOpen}
                user={userModal.user}
                onClose={() => setUserModal({ isOpen: false, user: null })}
                onSave={(data) => {
                    if (userModal.user) {
                        setUsersList(usersList.map(x => x.id === userModal.user.id ? { ...x, ...data } : x));
                        showToast('Đã cập nhật thông tin nhân viên!');
                    } else {
                        setUsersList([...usersList, { id: 'u' + Date.now(), ...data, isLocked: false }]);
                        showToast('Đã thêm nhân viên mới!');
                    }
                    setUserModal({ isOpen: false, user: null });
                }}
            />
        </div>
    );
}
