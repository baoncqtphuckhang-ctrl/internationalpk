import React, { useState, useEffect, useMemo } from 'react';
import { Download, Printer, Plus, Trash2, Calendar, CheckSquare, List, Save, Archive, X, ChevronDown, ChevronRight, Settings, Banknote, RotateCcw } from 'lucide-react';
import { formatCurrency, getVietnameseHolidays } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

const DEPARTMENTS = ['VĂN PHÒNG', 'KỸ THUẬT', 'KỸ THUẬT GONDOLA', 'Khác...'];

const NumberInput = ({ value, onChange, className, isDecimal = false }) => {
    const displayValue = useMemo(() => {
        if (value === '' || value === null || value === undefined) return '';
        if (isDecimal) return value.toString();
        if (value === '-') return '-';
        return new Intl.NumberFormat('vi-VN').format(value);
    }, [value, isDecimal]);

    const handleChange = (e) => {
        const val = e.target.value;
        if (val === '') {
            onChange('');
            return;
        }
        
        if (isDecimal) {
            const cleaned = val.replace(/[^0-9.]/g, '');
            onChange(cleaned);
            return;
        }

        const isNegative = val.startsWith('-');
        const numericStr = val.replace(/\D/g, '');
        
        if (numericStr === '') {
            onChange(isNegative ? '-' : '');
            return;
        }
        
        let num = parseInt(numericStr, 10);
        if (isNegative) num = -num;
        onChange(num);
    };


    return (
        <input 
            type="text" 
            value={displayValue} 
            onChange={handleChange} 
            className={className} 
        />
    );
};

const getDefaultAttendance = (year, month) => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const att = {};
    for (let i = 1; i <= daysInMonth; i++) {
        const isSunday = new Date(year, month - 1, i).getDay() === 0;
        att[i] = isSunday ? 0 : 1;
    }
    return att;
};

export const INITIAL_DATA = [
    { id: 'dep-1', department: 'VĂN PHÒNG', isDepartment: true, isCustomDept: false },
    { id: '1', name: 'Trần Thiên Chí Bình', basic_salary: 24255000, phone_allowance: 300000, parking_allowance: 0, makeup_allowance: 0, insurance_salary: 5000000, advance: 0, other_deductions: 10000000, other_additions: 0, cash: 0, notes: '(11) TRỪ TIỀN MƯỢN 17/10/2023 LẦN 5', bank_account: '108866666699', bank_account_name: 'TRẦN THIÊN CHÍ BÌNH', bank_name: 'VIETINBANK' },
    { id: '2', name: 'Nguyễn Chí Bảo', basic_salary: 18000000, phone_allowance: 0, parking_allowance: 300000, makeup_allowance: 0, insurance_salary: 5000000, advance: 0, other_deductions: 0, other_additions: 0, cash: 0, notes: '', bank_account: '106881335836', bank_account_name: 'NGUYỄN CHÍ BẢO', bank_name: 'VIETINBANK' },
    { id: '3', name: 'Bùi Thị Tú Hoan', basic_salary: 15000000, phone_allowance: 0, parking_allowance: 250000, makeup_allowance: 250000, insurance_salary: 5000000, advance: 7000000, other_deductions: 0, other_additions: 0, cash: 0, notes: '', bank_account: '0331000451713', bank_account_name: 'BÙI THỊ TÚ HOAN', bank_name: 'VIETCOMBANK' },
    { id: '4', name: 'Hồ Thị Mỹ Hảo', basic_salary: 13500000, phone_allowance: 0, parking_allowance: 350000, makeup_allowance: 350000, insurance_salary: 5000000, advance: 0, other_deductions: 0, other_additions: 0, cash: 0, notes: '', bank_account: '108867160453', bank_account_name: 'HỒ THỊ MỸ HẢO', bank_name: 'VIETINBANK' },
    { id: '5', name: 'Lê Nguyễn Thanh Thảo', basic_salary: 14200000, phone_allowance: 0, parking_allowance: 450000, makeup_allowance: 280002, insurance_salary: 5000000, advance: 0, other_deductions: 0, other_additions: 0, cash: 0, notes: '', bank_account: '100868205522', bank_account_name: 'LÊ NGUYỄN THANH THẢO', bank_name: 'VIETINBANK' },
    { id: '6', name: 'Huỳnh Thị Phương Lan', basic_salary: 8500000, phone_allowance: 0, parking_allowance: 250000, makeup_allowance: 161538, insurance_salary: 5000000, advance: 0, other_deductions: 0, other_additions: 0, cash: 0, notes: '', bank_account: '108873961138', bank_account_name: 'HUỲNH THỊ PHƯƠNG LAN', bank_name: 'VIETINBANK' },
    { id: '7', name: 'Trần Thị Lãnh', basic_salary: 14645000, phone_allowance: 0, parking_allowance: 150000, makeup_allowance: 153846, insurance_salary: 0, advance: 0, other_deductions: 0, other_additions: 0, cash: 0, notes: '', bank_account: '0531002516709', bank_account_name: 'TRẦN THỊ LÃNH', bank_name: 'VIETCOMBANK' },
    
    { id: 'dep-2', department: 'KỸ THUẬT', isDepartment: true, isCustomDept: false },
    { id: '8', name: 'Huỳnh Văn Trung', basic_salary: 15101250, phone_allowance: 200000, parking_allowance: 0, makeup_allowance: 0, insurance_salary: 5000000, advance: 0, other_deductions: 0, other_additions: 0, cash: 0, notes: '(12) phụ cấp đi CT Phú Quốc', bank_account: '108871646178', bank_account_name: 'HUỲNH VĂN TRUNG', bank_name: 'VIETINBANK' },
    { id: '9', name: 'Tăng Trung Hiếu', basic_salary: 18700000, phone_allowance: 0, parking_allowance: 0, makeup_allowance: 0, insurance_salary: 5000000, advance: 0, other_deductions: 0, other_additions: 0, cash: 0, notes: '', bank_account: '100868886488', bank_account_name: 'TĂNG TRUNG HIẾU', bank_name: 'VIETINBANK' },
    { id: '10', name: 'Phan Văn Toàn', basic_salary: 9800000, phone_allowance: 0, parking_allowance: 0, makeup_allowance: 0, insurance_salary: 0, advance: 0, other_deductions: 5000000, other_additions: 1500000, cash: 0, notes: '(11) trừ nợ mượn cty', bank_account: '', bank_account_name: '', bank_name: '' },
    { id: '11', name: 'Nguyễn Văn Xuân', basic_salary: 18150000, phone_allowance: 0, parking_allowance: 0, makeup_allowance: 0, insurance_salary: 5000000, advance: 0, other_deductions: 5000000, other_additions: 0, cash: 0, notes: '(11) trả nợ mượn cty', bank_account: '105871545774', bank_account_name: 'NGUYỄN VĂN XUÂN', bank_name: 'VIETINBANK' },
    { id: '12', name: 'Nguyễn Hoàng Nam', basic_salary: 17650000, phone_allowance: 0, parking_allowance: 0, makeup_allowance: 0, insurance_salary: 5000000, advance: 0, other_deductions: 5000000, other_additions: 0, cash: 0, notes: '(11) trả nợ mượn cty', bank_account: '103868665715', bank_account_name: 'NGUYỄN HOÀNG NAM', bank_name: 'VIETINBANK' },
    { id: '13', name: 'Lê Thị Thanh Kiều', basic_salary: 6400000, phone_allowance: 0, parking_allowance: 0, makeup_allowance: 0, insurance_salary: 0, advance: 0, other_deductions: 0, other_additions: 0, cash: 0, notes: '', bank_account: '100868165954', bank_account_name: 'LÊ THỊ THANH KIỀU', bank_name: 'VIETINBANK' },
    { id: '14', name: 'Nguyễn Thị Thu Loan', basic_salary: 14700000, phone_allowance: 0, parking_allowance: 0, makeup_allowance: 0, insurance_salary: 5000000, advance: 5000000, other_deductions: 2000000, other_additions: 625000, cash: 0, notes: '(11) trả nợ cty', bank_account: '100868102387', bank_account_name: 'NGUYỄN THỊ THU LOAN', bank_name: 'VIETINBANK' },
    { id: '15', name: 'Võ Ngọc Lâm', basic_salary: 10151250, phone_allowance: 200000, parking_allowance: 0, makeup_allowance: 0, insurance_salary: 5000000, advance: 0, other_deductions: 5000000, other_additions: 0, cash: 0, notes: '', bank_account: '101869102257', bank_account_name: 'VÕ NGỌC LÂM', bank_name: 'VIETINBANK' },
    { id: '16', name: 'Lê Thị Ngọc Trúc', basic_salary: 12800000, phone_allowance: 0, parking_allowance: 0, makeup_allowance: 0, insurance_salary: 5000000, advance: 0, other_deductions: 0, other_additions: 0, cash: 0, notes: '', bank_account: '103868218688', bank_account_name: 'LÊ THỊ NGỌC TRÚC', bank_name: 'VIETINBANK' },
    { id: '17', name: 'Trịnh Hữu Nghĩa', basic_salary: 15750000, phone_allowance: 0, parking_allowance: 0, makeup_allowance: 0, insurance_salary: 5000000, advance: 0, other_deductions: 2000000, other_additions: 0, cash: 0, notes: '', bank_account: '105867160656', bank_account_name: 'TRỊNH HỮU NGHĨA', bank_name: 'VIETINBANK' },
    { id: '18', name: 'Ngô Thanh Sơn', basic_salary: 18151250, phone_allowance: 0, parking_allowance: 0, makeup_allowance: 0, insurance_salary: 5000000, advance: 0, other_deductions: 0, other_additions: 0, cash: 0, notes: '', bank_account: '101868102217', bank_account_name: 'NGÔ THANH SƠN', bank_name: 'VIETINBANK' },
    { id: '19', name: 'Trần Tấn Ruội', basic_salary: 14700000, phone_allowance: 0, parking_allowance: 0, makeup_allowance: 0, insurance_salary: 5000000, advance: 0, other_deductions: 0, other_additions: 1050000, cash: 0, notes: '', bank_account: '106867164487', bank_account_name: 'TRẦN TẤN RUỘI', bank_name: 'VIETINBANK' },
    { id: '20', name: 'Nguyễn Minh Nhật', basic_salary: 13000000, phone_allowance: 0, parking_allowance: 0, makeup_allowance: 0, insurance_salary: 0, advance: 0, other_deductions: 0, other_additions: 0, cash: 0, notes: '', bank_account: '0500755948488', bank_account_name: 'NGUYỄN MINH NHẬT', bank_name: 'MB BANK' },
    { id: '21', name: 'Lê Tấn Giang', basic_salary: 13200000, phone_allowance: 0, parking_allowance: 0, makeup_allowance: 0, insurance_salary: 5000000, advance: 0, other_deductions: 0, other_additions: 0, cash: 0, notes: '', bank_account: '107867160427', bank_account_name: 'LÊ TẤN GIANG', bank_name: 'VIETINBANK' },
    { id: '22', name: 'Lã Thị Thanh Phương', basic_salary: 10350000, phone_allowance: 0, parking_allowance: 0, makeup_allowance: 0, insurance_salary: 5000000, advance: 0, other_deductions: 0, other_additions: 2070000, cash: 0, notes: '', bank_account: '0110459279', bank_account_name: 'LÃ THỊ THANH PHƯƠNG', bank_name: 'MB BANK' },
    { id: '23', name: 'Nguyễn Bảo Anh', basic_salary: 12600000, phone_allowance: 0, parking_allowance: 0, makeup_allowance: 0, insurance_salary: 0, advance: 0, other_deductions: 0, other_additions: 0, cash: 0, notes: '', bank_account: '1000676504', bank_account_name: 'NGUYỄN BẢO ANH', bank_name: 'MB BANK' },
    { id: '24', name: 'Nguyễn Văn Tài', basic_salary: 12000000, phone_allowance: 0, parking_allowance: 0, makeup_allowance: 0, insurance_salary: 0, advance: 0, other_deductions: 0, other_additions: 0, cash: 0, notes: '', bank_account: '108002611913', bank_account_name: 'NGUYỄN VĂN TÀI', bank_name: 'VIETINBANK' },
    { id: '25', name: 'Nguyễn Hữu Quốc Thịnh', basic_salary: 12600000, phone_allowance: 0, parking_allowance: 0, makeup_allowance: 0, insurance_salary: 0, advance: 0, other_deductions: 0, other_additions: 0, cash: 0, notes: '', bank_account: '060157070969', bank_account_name: 'NGUYỄN HỮU QUỐC THỊNH', bank_name: 'SACOMBANK' },
    
    { id: 'dep-3', department: 'KỸ THUẬT GONDOLA', isDepartment: true, isCustomDept: false },
    { id: '26', name: 'Nguyễn Bá Quí', basic_salary: 17650000, phone_allowance: 0, parking_allowance: 0, makeup_allowance: 0, insurance_salary: 5000000, advance: 0, other_deductions: 0, other_additions: 0, cash: 0, notes: '', bank_account: '105872658178', bank_account_name: 'NGUYỄN BÁ QUÍ', bank_name: 'VIETINBANK' },
    { id: '27', name: 'Trần Ngọc Phúc', basic_salary: 15600000, phone_allowance: 0, parking_allowance: 0, makeup_allowance: 0, insurance_salary: 5000000, advance: 0, other_deductions: 0, other_additions: 0, cash: 0, notes: '', bank_account: '105869188851', bank_account_name: 'TRẦN NGỌC PHÚC', bank_name: 'VIETINBANK' },
    { id: '28', name: 'Lương Văn Sang', basic_salary: 15600000, phone_allowance: 0, parking_allowance: 0, makeup_allowance: 0, insurance_salary: 5000000, advance: 0, other_deductions: 0, other_additions: 0, cash: 0, notes: '', bank_account: '105821516645', bank_account_name: 'LƯƠNG VĂN SANG', bank_name: 'VIETINBANK' },
    { id: '29', name: 'Nguyễn Khắc Huỳnh', basic_salary: 14333333, phone_allowance: 0, parking_allowance: 0, makeup_allowance: 0, insurance_salary: 5000000, advance: 4000000, other_deductions: 0, other_additions: 4400000, cash: 0, notes: '', bank_account: '105869389545', bank_account_name: 'NGUYỄN KHÁC HUỲNH', bank_name: 'VIETINBANK' },
];

export default function EmployeeSalary({ currentUser, usersList = [], projects = [], refreshData }) {
    const [draftPeriods, setDraftPeriods] = useState([]);
    const [accountedTxs, setAccountedTxs] = useState([]);
    
    useEffect(() => {
        const fetchAccountedTxs = async () => {
            try {
                const { data } = await supabase.from('transactions').select('note').ilike('note', '%[CHI LƯƠNG]%');
                if (data) setAccountedTxs(data.map(d => d.note));
            } catch (e) {}
        };
        fetchAccountedTxs();
    }, []);
    
    const [employees, setEmployees] = useState([]);
    const [activeTab, setActiveTab] = useState('salary'); // 'salary' | 'attendance' | 'history'
    const [historySubTab, setHistorySubTab] = useState('salary'); // 'salary' | 'attendance'
    const [holidays, setHolidays] = useState({});
    const [systemModal, setSystemModal] = useState({ isOpen: false, type: 'info', title: '', message: '', onConfirm: null, onCancel: null, password: '', error: '' });
    const [allocationModal, setAllocationModal] = useState({ isOpen: false, empId: null, name: '', month: '', allocations: [] });
    const [paymentModal, setPaymentModal] = useState({ isOpen: false, empId: null, empName: '', department: '', amount: 0, code: '6421', corresponding_account: '1111', recipient: '', note: '', allocations: [{id: Date.now(), project_name: '', from_date: '', to_date: ''}], monthId: null, globalStandardDays: 26 });
    const [leaveModal, setLeaveModal] = useState({ isOpen: false, empId: null, name: '', currentBalance: 0 });
    const [addEmployeeModal, setAddEmployeeModal] = useState({ isOpen: false });
    const [newEmpData, setNewEmpData] = useState({
        name: '', department: 'VĂN PHÒNG', customDepartment: '', basic_salary: '', phone_allowance: '', parking_allowance: '', makeup_allowance: '', gondola_allowance: '', laptop_allowance: '', insurance_salary: '', leave_balance: ''
    });
    const [historyRecords, setHistoryRecords] = useState({});
    const [historyTransactions, setHistoryTransactions] = useState({});
    const [salaryTxModal, setSalaryTxModal] = useState({ isOpen: false, monthId: null, data: null, selectedProject: '' });
    const [viewingHistoryId, setViewingHistoryId] = useState(null);
    const [createPeriodModal, setCreatePeriodModal] = useState({ isOpen: false, periodName: '' });
    
    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
    const [globalStandardDays, setGlobalStandardDays] = useState(26);
    const [daysInMonthCount, setDaysInMonthCount] = useState(30);
    const [yearMonth, setYearMonth] = useState({ y: today.getFullYear(), m: today.getMonth() + 1 });
    const [isDbStorage, setIsDbStorage] = useState(false);
    const [initialLoaded, setInitialLoaded] = useState(false);

    const getIsHoliday = (day, specificMonth = selectedMonth, historyId = viewingHistoryId) => {
        if (historyId && historyRecords[historyId]) {
            return (historyRecords[historyId].holidays || []).includes(day);
        }
        
        const [yStr, mStr] = specificMonth.split('-');
        const y = parseInt(yStr, 10), m = parseInt(mStr, 10);
        const autoHolidays = getVietnameseHolidays(y, m) || [];
        const manualToggled = holidays[specificMonth] || [];
        
        const isAuto = autoHolidays.includes(day);
        const isManual = manualToggled.includes(day);
        return isAuto ? !isManual : isManual;
    };

    const getUsedLeaves = (emp, month) => {
        let used = 0;
        const monthAtt = emp.attendance?.[month] || {};
        Object.values(monthAtt).forEach(val => {
            if (val === 'P') used += 1;
            else if (val === 'P/2') used += 0.5;
        });
        return used;
    };

    const getRemainingLeaves = (emp, month) => {
        if (emp.leave_balance === 'N/A') return 'Không tính';
        return (Number(emp.leave_balance) || 0) - getUsedLeaves(emp, month);
    };

    const getDraftPeriods = () => {
        const drafts = new Set();
        employees.forEach(emp => {
            if (emp.attendance) {
                Object.keys(emp.attendance).forEach(month => {
                    if (!historyRecords[month]) {
                        drafts.add(month);
                    }
                });
            }
        });
        const arr = Array.from(drafts).sort().reverse();
        if (arr.length === 0 && selectedMonth && !historyRecords[selectedMonth]) {
            arr.push(selectedMonth);
        }
        return arr;
    };

    const handleCreateNewPeriod = () => {
        const p = createPeriodModal.periodName.trim();
        if (!p) return;
        if (!/^\d{4}-\d{2}$/.test(p)) {
            setSystemModal({ isOpen: true, type: 'info', title: 'Lỗi', message: 'Vui lòng nhập định dạng YYYY-MM (ví dụ: 2026-07)' });
            return;
        }
        if (historyRecords[p]) {
            setSystemModal({ isOpen: true, type: 'info', title: 'Lỗi', message: `Kỳ lương ${p} đã được chốt và nằm trong lịch sử. Bạn không thể tạo lại!` });
            return;
        }
        
        // Cập nhật selectedMonth, dữ liệu sẽ tự động trống đối với kỳ này nhờ cấu trúc của attendance
        setSelectedMonth(p);
        setCreatePeriodModal({ isOpen: false, periodName: '' });
    };

    useEffect(() => {
        if (!initialLoaded) return;
        const drafts = getDraftPeriods();
        if (drafts.length > 0 && !drafts.includes(selectedMonth)) {
            setSelectedMonth(drafts[0]);
        }
    }, [historyRecords, employees, initialLoaded]);

    useEffect(() => {
        const fetchBaseData = async () => {
            try {
                const { data, error } = await supabase.from('employees').select('*').order('order_index', { ascending: true });
                if (error) throw error;
                if (data && data.length > 0) {
                    setIsDbStorage(true);
                    setEmployees(data.map(e => ({
                        ...e,
                        isDepartment: e.is_department,
                        isCustomDept: e.is_custom_dept,
                        leave_balance: e.leave_balance === -1 ? 'N/A' : (Number(e.leave_balance) || 0)
                    })));
                } else {
                    throw new Error("Empty DB");
                }
            } catch (err) {
                console.warn('Fallback to LocalStorage for employees');
                setIsDbStorage(false);
                const localData = localStorage.getItem('misa_employees_base');
                if (localData) {
                    try { setEmployees(JSON.parse(localData)); } catch(e) { setEmployees(INITIAL_DATA); }
                } else {
                    setEmployees(INITIAL_DATA);
                }
            }
            setInitialLoaded(true);
        };
        fetchBaseData();

        const localHolidays = localStorage.getItem('misa_holidays');
        if (localHolidays) {
            try { setHolidays(JSON.parse(localHolidays)); } catch(e) {}
        }

        const fetchHistory = async () => {
            try {
                const { data, error } = await supabase.from('salary_history').select('*');
                if (error) throw error;
                if (data && data.length > 0) {
                    const historyMap = {};
                    data.forEach(item => {
                        const emps = item.employees_data || [];
                        const metadata = emps.find(e => e.id === 'metadata_holidays');
                        historyMap[item.month_id] = {
                            timestamp: item.timestamp,
                            globalStandardDays: item.global_standard_days,
                            holidays: metadata ? metadata.holidays : [],
                            employees: emps.filter(e => e.id !== 'metadata_holidays')
                        };
                    });
                    setHistoryRecords(historyMap);
                } else {
                    throw new Error("Empty History DB");
                }
            } catch (err) {
                const savedHistory = localStorage.getItem('misa_salary_history');
                if (savedHistory) {
                    try { setHistoryRecords(JSON.parse(savedHistory)); } catch (e) {}
                }
            }
        };
        fetchHistory();
    }, []);

    useEffect(() => {
        if (!initialLoaded || employees.length === 0) return;
        
        const saveTimer = setTimeout(async () => {
            if (isDbStorage) {
                try {
                    const upsertData = employees.map((e, index) => ({
                        id: e.id,
                        name: e.name || '',
                        department: e.department || '',
                        is_department: !!e.isDepartment,
                        is_custom_dept: !!e.isCustomDept,
                        basic_salary: Number(e.basic_salary) || 0,
                        phone_allowance: Number(e.phone_allowance) || 0,
                        parking_allowance: Number(e.parking_allowance) || 0,
                        makeup_allowance: Number(e.makeup_allowance) || 0,
                        gondola_allowance: Number(e.gondola_allowance) || 0,
                        laptop_allowance: Number(e.laptop_allowance) || 0,
                        insurance_salary: Number(e.insurance_salary) || 0,
                        advance: Number(e.advance) || 0,
                        other_deductions: Number(e.other_deductions) || 0,
                        other_additions: Number(e.other_additions) || 0,
                        cash: Number(e.cash) || 0,
                        notes: e.notes || '',
                        bank_account: e.bank_account || '',
                        bank_account_name: e.bank_account_name || '',
                        bank_name: e.bank_name || '',
                        leave_balance: e.leave_balance === 'N/A' ? -1 : (Number(e.leave_balance) || 0),
                        attendance: e.attendance || {},
                        overtime_hours: Number(e.overtime_hours) || 0,
                        order_index: index
                    }));
                    await supabase.from('employees').upsert(upsertData, { onConflict: 'id' });
                } catch(err) { console.error('Save to Supabase failed', err); }
            }
            localStorage.setItem('misa_employees_base', JSON.stringify(employees));
        }, 1500);

        return () => clearTimeout(saveTimer);
    }, [employees, isDbStorage, initialLoaded]);

    useEffect(() => {
        if (!selectedMonth) return;
        if (viewingHistoryId && selectedMonth !== viewingHistoryId) {
            setViewingHistoryId(null);
        }
        let y, m;
        try {
            if (viewingHistoryId && historyRecords[viewingHistoryId] && historyRecords[viewingHistoryId].base_month) {
                const [year, month] = historyRecords[viewingHistoryId].base_month.split('-');
                y = parseInt(year);
                m = parseInt(month);
            } else if (selectedMonth.includes('-')) {
                const [year, month] = selectedMonth.split('-');
                y = parseInt(year);
                m = parseInt(month);
            }
        } catch (e) { console.error(e); }
        
        if (!y || isNaN(y) || !m || isNaN(m)) {
            const match = selectedMonth.match(/(\d{2})\/(\d{4})/);
            if (match) {
                m = parseInt(match[1]);
                y = parseInt(match[2]);
            } else {
                const today = new Date();
                y = today.getFullYear();
                m = today.getMonth() + 1;
            }
        }
        setYearMonth({ y, m });
        
        const daysInMonth = new Date(y, m, 0).getDate();
        setDaysInMonthCount(daysInMonth || 30);
        
        let sundays = 0;
        for (let i = 1; i <= daysInMonth; i++) {
            if (new Date(y, m - 1, i).getDay() === 0) sundays++;
        }
        setGlobalStandardDays(daysInMonth - sundays);

        setEmployees(prev => {
            let changed = false;
            const newEmployees = prev.map(emp => {
                if (emp.isDepartment) return emp;
                const currentAtt = emp.attendance || {};
                if (!currentAtt[selectedMonth]) {
                    changed = true;
                    return {
                        ...emp,
                        attendance: {
                            ...currentAtt,
                            [selectedMonth]: getDefaultAttendance(y, m)
                        }
                    };
                }
                return emp;
            });
            return changed ? newEmployees : prev;
        });
    }, [selectedMonth]);

    const handleAddEmployeeSubmit = () => {
        if (!newEmpData.name.trim()) return setSystemModal({isOpen: true, type: 'info', title: 'Lỗi', message: 'Vui lòng nhập tên nhân viên'});
        const dept = newEmpData.department === 'Khác...' ? newEmpData.customDepartment.trim().toUpperCase() : newEmpData.department;
        if (!dept) return setSystemModal({isOpen: true, type: 'info', title: 'Lỗi', message: 'Vui lòng nhập phòng ban'});

        const { y, m } = yearMonth;
        const newId = Date.now().toString();
        const empRow = {
            id: newId,
            name: newEmpData.name.trim(),
            basic_salary: Number(newEmpData.basic_salary) || 0,
            phone_allowance: Number(newEmpData.phone_allowance) || 0,
            parking_allowance: Number(newEmpData.parking_allowance) || 0,
            makeup_allowance: Number(newEmpData.makeup_allowance) || 0,
            gondola_allowance: Number(newEmpData.gondola_allowance) || 0,
            laptop_allowance: Number(newEmpData.laptop_allowance) || 0,
            insurance_salary: Number(newEmpData.insurance_salary) || 0,
            leave_balance: Number(newEmpData.leave_balance) || 0,
            advance: 0, other_deductions: 0, other_additions: 0, cash: 0, notes: '', bank_account: '', bank_account_name: '', bank_name: '',
            attendance: { [selectedMonth]: getDefaultAttendance(y, m) },
            isDepartment: false
        };

        const deptExists = employees.some(e => e.isDepartment && e.department === dept);
        let newEmployees = [...employees];
        
        if (!deptExists) {
            newEmployees.push({ id: newId + '_dept', department: dept, isDepartment: true, isCustomDept: !DEPARTMENTS.includes(dept) });
            newEmployees.push(empRow);
        } else {
            let insertIdx = newEmployees.length;
            let foundDept = false;
            for (let i = 0; i < newEmployees.length; i++) {
                if (newEmployees[i].isDepartment) {
                    if (newEmployees[i].department === dept) {
                        foundDept = true;
                    } else if (foundDept) {
                        insertIdx = i;
                        break;
                    }
                }
            }
            newEmployees.splice(insertIdx, 0, empRow);
        }
        
        setEmployees(newEmployees);
        setAddEmployeeModal({ isOpen: false });
        setNewEmpData({ name: '', department: dept, customDepartment: '', basic_salary: '', phone_allowance: '', parking_allowance: '', makeup_allowance: '', gondola_allowance: '', laptop_allowance: '', insurance_salary: '' });
        setTimeout(() => setSystemModal({ isOpen: true, type: 'info', title: 'Thành công', message: 'Đã thêm nhân viên mới thành công!' }), 300);
    };

    const handleDeleteRow = (id) => {
        setSystemModal({
            isOpen: true,
            type: 'password',
            title: 'Xác nhận xóa nhân viên',
            message: 'Vui lòng nhập mật khẩu quản trị để xóa nhân viên này.',
            onConfirm: async (pwd) => {
                if (pwd === currentUser?.password) {
                    setEmployees(employees.filter(e => e.id !== id));
                    if (isDbStorage) {
                        try {
                            await supabase.from('employees').delete().eq('id', id);
                        } catch(e) {}
                    }
                    setTimeout(() => setSystemModal({ isOpen: true, type: 'info', title: 'Thành công', message: 'Đã xóa nhân viên thành công!' }), 300);
                    return true;
                } else {
                    return 'Sai mật khẩu!';
                }
            }
        });
    };

    const handleSaveMonth = () => {
        setSystemModal({
            isOpen: true,
            type: 'warning',
            title: 'Chốt bảng lương',
            message: `Bạn có chắc muốn chốt bảng lương tháng ${selectedMonth} không? Toàn bộ dữ liệu của kỳ này sẽ được lưu vào lịch sử.`,
            onConfirm: async () => {
                const finalPeriodName = selectedMonth;
                
                const [yStr, mStr] = selectedMonth.split('-');
                const y = parseInt(yStr), m = parseInt(mStr);
                const daysInMonth = new Date(y, m, 0).getDate();
                const evaluatedHolidays = [];
                for(let i=1; i<=daysInMonth; i++) {
                    if (getIsHoliday(i, selectedMonth, null)) evaluatedHolidays.push(i);
                }
                const newEmployeesState = employees.map(emp => {
                    if (emp.isDepartment) return emp;
                    let usedLeaves = 0;
                    const monthAtt = emp.attendance?.[selectedMonth] || {};
                    Object.values(monthAtt).forEach(val => {
                        if (val === 'P') usedLeaves += 1;
                        else if (val === 'P/2') usedLeaves += 0.5;
                    });
                    const currentBalance = emp.leave_balance === 'N/A' ? 'N/A' : (Number(emp.leave_balance) || 0);
                    const newBalance = currentBalance === 'N/A' ? 'N/A' : (currentBalance - usedLeaves + 1); // Cộng 1 ngày phép cho tháng sau
                    return { ...emp, leave_balance: newBalance };
                });

                const monthData = {
                    base_month: selectedMonth,
                    timestamp: new Date().toISOString(),
                    globalStandardDays,
                    holidays: evaluatedHolidays,
                    employees: newEmployeesState.map(calculateRow)
                };
                const newHistory = {
                    ...historyRecords,
                    [finalPeriodName]: monthData
                };
                setEmployees(newEmployeesState);
                setHistoryRecords(newHistory);
                localStorage.setItem('misa_salary_history', JSON.stringify(newHistory));
                
                try {
                    await supabase.from('salary_history').upsert([{
                        month_id: finalPeriodName,
                        timestamp: monthData.timestamp,
                        global_standard_days: monthData.globalStandardDays,
                        employees_data: [...monthData.employees, { id: 'metadata_holidays', holidays: monthData.holidays, base_month: selectedMonth }]
                    }], { onConflict: 'month_id' });
                } catch(e) { console.error('History save error', e); }

                setTimeout(() => setSystemModal({ isOpen: true, type: 'info', title: 'Thành công', message: `Đã lưu dữ liệu vào Lịch sử với tên: ${finalPeriodName}!` }), 300);
                return true;
            }
        });
    };
    const handleCreateSalaryTransaction = async () => {
        const { monthId, data, selectedProject } = salaryTxModal;
        if (!selectedProject) return setSystemModal({isOpen: true, type: 'info', title: 'Lỗi', message: 'Vui lòng chọn công trình mặc định'});

        const transactions = [];

        data.employees.forEach(emp => {
            if (emp.isDepartment) return;
            const salary = Number(emp.calculated?.total_actual_salary_8) || 0;
            if (salary <= 0) return;

            const allocs = emp.allocations?.[monthId];
            if (allocs && allocs.length > 0) {
                let sumRatio = 0;
                allocs.forEach(a => {
                    const amount = Math.round(salary * a.ratio / 100);
                    if (amount > 0) {
                        transactions.push({
                            project_name: a.projectName,
                            accounting_date: new Date().toISOString().split('T')[0],
                            code: '6421',
                            debit: amount,
                            note: `[CHI LƯƠNG] ${emp.name} - ${monthId}`,
                            created_by: currentUser.username
                        });
                    }
                    sumRatio += a.ratio;
                });
                if (sumRatio < 100) {
                    const unalloc = Math.round(salary * (100 - sumRatio) / 100);
                    if (unalloc > 0) {
                        transactions.push({
                            project_name: selectedProject,
                            accounting_date: new Date().toISOString().split('T')[0],
                            code: '6421',
                            debit: unalloc,
                            note: `[CHI LƯƠNG] ${emp.name} - ${monthId}`,
                            created_by: currentUser.username
                        });
                    }
                }
            } else {
                transactions.push({
                    project_name: selectedProject,
                    accounting_date: new Date().toISOString().split('T')[0],
                    code: '6421',
                    debit: salary,
                    note: `[CHI LƯƠNG] ${emp.name} - ${monthId}`,
                    created_by: currentUser.username
                });
            }
        });

        if (transactions.length === 0) {
            setSalaryTxModal({ isOpen: false, monthId: null, data: null, selectedProject: '' });
            return setSystemModal({ isOpen: true, type: 'info', title: 'Lỗi', message: 'Không có tiền lương để chi!' });
        }

        try {
            await supabase.from('transactions').insert(transactions);
            setSalaryTxModal({ isOpen: false, monthId: null, data: null, selectedProject: '' });
            setTimeout(() => setSystemModal({ isOpen: true, type: 'info', title: 'Thành công', message: `Đã tạo ${transactions.length} phiếu chi lương thành công!` }), 300);
        } catch (e) {
            setSalaryTxModal({ isOpen: false, monthId: null, data: null, selectedProject: '' });
            setTimeout(() => setSystemModal({ isOpen: true, type: 'info', title: 'Lỗi', message: 'Lỗi khi tạo phiếu chi!' }), 300);
        }
    };

    const handleCreatePaymentTransaction = async () => {
        const { empName, department, amount, code, corresponding_account, recipient, note, allocations, globalStandardDays, monthId } = paymentModal;
        
        const isTechnical = department === 'KỸ THUẬT' || department === 'KỸ THUẬT GONDOLA';
        const stdDays = globalStandardDays || 26;
        
        let txsToInsert = [];
        const baseNote = note || `[CHI LƯƠNG] ${empName} - Kỳ ${monthId}`;
        const finalRecipient = recipient || empName;

        if (isTechnical) {
            // Lọc ra các dòng hợp lệ
            const validAllocs = allocations.filter(a => a.project_name && a.from_date && a.to_date);
            if (validAllocs.length === 0) return setSystemModal({isOpen: true, type: 'info', title: 'Lỗi', message: 'Vui lòng điền đầy đủ ít nhất 1 dòng phân bổ (Công trình, Từ ngày, Đến ngày)!'});
            
            for (const a of validAllocs) {
                const from = new Date(a.from_date);
                const to = new Date(a.to_date);
                if (to < from) return setSystemModal({isOpen: true, type: 'info', title: 'Lỗi', message: 'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu!'});
                
                // Tính số ngày
                const diffTime = Math.abs(to - from);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Bao gồm cả 2 ngày
                
                // Số tiền = (Tổng tiền / Công chuẩn) * Số ngày
                const allocAmount = Math.round((amount / stdDays) * diffDays);
                
                if (allocAmount > 0) {
                    txsToInsert.push({
                        project_name: a.project_name,
                        accounting_date: new Date().toISOString().split('T')[0],
                        code: code,
                        corresponding_account: corresponding_account,
                        recipient: finalRecipient,
                        debit: allocAmount,
                        note: `${baseNote} (${diffDays} ngày)`,
                        created_by: currentUser.username
                    });
                }
            }
        } else {
            // Nhân viên bình thường
            const selectedProject = allocations[0]?.project_name;
            if (!selectedProject) return setSystemModal({isOpen: true, type: 'info', title: 'Lỗi', message: 'Vui lòng chọn công trình!'});
            
            txsToInsert.push({
                project_name: selectedProject,
                accounting_date: new Date().toISOString().split('T')[0],
                code: code,
                corresponding_account: corresponding_account,
                recipient: finalRecipient,
                debit: amount,
                note: baseNote,
                created_by: currentUser.username
            });
        }

        if (txsToInsert.length === 0) return setSystemModal({isOpen: true, type: 'info', title: 'Lỗi', message: 'Không có dữ liệu hợp lệ để tạo phiếu!'});
        
        try {
            await supabase.from('transactions').insert(txsToInsert);
            setAccountedTxs(prev => [...prev, ...txsToInsert.map(t => t.note)]);
            setPaymentModal({ isOpen: false, empId: null, empName: '', department: '', amount: 0, code: '6421', corresponding_account: '1111', recipient: '', note: '', allocations: [{id: Date.now(), project_name: '', from_date: '', to_date: ''}], monthId: null, globalStandardDays: 26 });
            if (refreshData) refreshData();
            
            // Cập nhật local data
            if (monthId) {
                let updatedMonthData = null;
                setHistoryRecords(prev => {
                    const monthData = prev[monthId];
                    if (!monthData) return prev;
                    const newEmps = monthData.employees.map(emp => {
                        if (emp.id === paymentModal.empId) {
                            // Cập nhật số tiền cash (đã chi)
                            const totalAdded = txsToInsert.reduce((sum, t) => sum + t.debit, 0);
                            return { ...emp, cash: (Number(emp.cash) || 0) + totalAdded };
                        }
                        return emp;
                    });
                    updatedMonthData = { ...monthData, employees: newEmps };
                    const newHistory = { ...prev, [monthId]: updatedMonthData };
                    localStorage.setItem('misa_salary_history', JSON.stringify(newHistory));
                    return newHistory;
                });
                
                if (updatedMonthData) {
                    await supabase.from('employees_data').update({ employees: updatedMonthData.employees }).eq('month', monthId);
                }
                
                fetchHistoryTransactions(monthId);
            }
            
            setTimeout(() => setSystemModal({ isOpen: true, type: 'info', title: 'Thành công', message: `Đã tạo ${txsToInsert.length} phiếu chi thành công!` }), 300);
        } catch (e) {
            console.error(e);
            setPaymentModal({ isOpen: false, empId: null, empName: '', department: '', amount: 0, code: '6421', corresponding_account: '1111', recipient: '', note: '', allocations: [{id: Date.now(), project_name: '', from_date: '', to_date: ''}], monthId: null, globalStandardDays: 26 });
            setTimeout(() => setSystemModal({ isOpen: true, type: 'info', title: 'Lỗi', message: 'Lỗi khi tạo phiếu chi!' }), 300);
        }
    };

    const handleRevertHistory = (monthId) => {
        setSystemModal({
            isOpen: true,
            type: 'warning',
            title: 'Hoàn tác kỳ lương',
            message: `Bạn có chắc muốn HOÀN TÁC kỳ lương ${monthId} về trạng thái Nháp không? Dữ liệu lịch sử sẽ bị xóa nhưng bảng tính vẫn giữ nguyên.`,
            onConfirm: async () => {
                const newHistory = { ...historyRecords };
                delete newHistory[monthId];
                setHistoryRecords(newHistory);
                localStorage.setItem('misa_salary_history', JSON.stringify(newHistory));
                
                try {
                    await supabase.from('salary_history').delete().eq('month_id', monthId);
                } catch(e) { console.error('Delete history error', e); }

                setSystemModal({ isOpen: true, type: 'info', title: 'Thành công', message: 'Đã hoàn tác thành công!' });
            }
        });
    };

    const handleDeleteHistory = (monthId) => {
        setSystemModal({
            isOpen: true,
            type: 'password',
            title: 'Xóa vĩnh viễn Lịch sử',
            message: `Vui lòng nhập mật khẩu quản trị để xóa vĩnh viễn bảng lương tháng ${monthId} (Bao gồm cả dữ liệu nháp, không thể khôi phục):`,
            onConfirm: async (pwd) => {
                if (pwd === 'admin') {
                    const newHistory = { ...historyRecords };
                    delete newHistory[monthId];
                    setHistoryRecords(newHistory);
                    localStorage.setItem('misa_salary_history', JSON.stringify(newHistory));
                    
                    const newEmployees = employees.map(emp => {
                        const updatedEmp = { ...emp };
                        if (updatedEmp.attendance) delete updatedEmp.attendance[monthId];
                        if (updatedEmp.allocations) delete updatedEmp.allocations[monthId];
                        return updatedEmp;
                    });
                    setEmployees(newEmployees);

                    try {
                        await supabase.from('salary_history').delete().eq('month_id', monthId);
                    } catch(e) { console.error('Delete history error', e); }

                    setTimeout(() => setSystemModal({ isOpen: true, type: 'info', title: 'Thành công', message: 'Đã xóa thành công!' }), 300);
                    return true;
                } else {
                    return 'Sai mật khẩu!';
                }
            }
        });
    };

    const handleDeleteDraftPeriod = (monthId) => {
        setSystemModal({
            isOpen: true,
            type: 'warning',
            title: 'Xóa kỳ lương nháp',
            message: `Bạn có chắc muốn XÓA VĨNH VIỄN kỳ lương nháp ${monthId} không?`,
            onConfirm: () => {
                const newEmployees = employees.map(emp => {
                    const updatedEmp = { ...emp };
                    if (updatedEmp.attendance) delete updatedEmp.attendance[monthId];
                    if (updatedEmp.allocations) delete updatedEmp.allocations[monthId];
                    return updatedEmp;
                });
                setEmployees(newEmployees);
                if (selectedMonth === monthId) setSelectedMonth('');
                
                // Show success notification
                setSystemModal({ isOpen: true, type: 'info', title: 'Thành công', message: 'Đã xóa kỳ lương nháp thành công!' });
            }
        });
    };
    
    const fetchHistoryTransactions = async (monthId) => {
        if (historyTransactions[monthId]) return;
        try {
            const { data, error } = await supabase.from('transactions')
                .select('*')
                .ilike('note', `%[CHI LƯƠNG]%${monthId}%`)
                .order('created_at', { ascending: false });
            if (!error && data) {
                setHistoryTransactions(prev => ({ ...prev, [monthId]: data }));
            }
        } catch (e) {}
    };

    const handleViewHistory = (monthId) => {
        setViewingHistoryId(monthId);
        setSelectedMonth(monthId);
        fetchHistoryTransactions(monthId);
        setActiveTab('salary');
    };

    const handleChange = (id, field, value) => {
        setEmployees(employees.map(e => e.id === id ? { ...e, [field]: value } : e));
    };

    const handleToggleHoliday = (day) => {
        if (viewingHistoryId) return;
        setHolidays(prev => {
            const monthHolidays = prev[selectedMonth] || [];
            let newHolidays;
            if (monthHolidays.includes(day)) {
                newHolidays = monthHolidays.filter(d => d !== day);
            } else {
                newHolidays = [...monthHolidays, day];
            }
            const updated = { ...prev, [selectedMonth]: newHolidays };
            localStorage.setItem('misa_holidays', JSON.stringify(updated));
            return updated;
        });
    };

    const handleDepartmentChange = (id, value) => {
        if (value === 'Khác...') {
            setEmployees(employees.map(e => e.id === id ? { ...e, isCustomDept: true, department: '' } : e));
        } else {
            setEmployees(employees.map(e => e.id === id ? { ...e, isCustomDept: false, department: value } : e));
        }
    };

    const handleToggleAttendance = (empId, day) => {
        setEmployees(prev => {
            const newEmployees = prev.map(emp => {
                if (emp.id === empId) {
                    const [yStr, mStr] = selectedMonth.split('-');
                    const y = parseInt(yStr), m = parseInt(mStr);
                    const isSunday = new Date(y, m - 1, day).getDay() === 0;
                    const isHoliday = getIsHoliday(day);
                    
                    const defaultAtt = isHoliday || isSunday ? 0 : 1;
                    let currentAtt = emp.attendance?.[selectedMonth]?.[day] ?? defaultAtt;
                    if (isHoliday && currentAtt === 1) currentAtt = 0;
                    
                    let nextAtt = 1;
                    
                    if (isHoliday || isSunday) {
                        if (currentAtt === 1) nextAtt = 1.5;
                        else if (currentAtt === 1.5) nextAtt = 2;
                        else if (currentAtt === 2) nextAtt = 0.5;
                        else if (currentAtt === 0.5) nextAtt = 'P';
                        else if (currentAtt === 'P') nextAtt = 'P/2';
                        else if (currentAtt === 'P/2') nextAtt = 0;
                        else nextAtt = 1;
                    } else {
                        if (currentAtt === 1) nextAtt = 0.5;
                        else if (currentAtt === 0.5) nextAtt = 'P';
                        else if (currentAtt === 'P') nextAtt = 'P/2';
                        else if (currentAtt === 'P/2') nextAtt = 0;
                        else nextAtt = 1;
                    }

                    if (nextAtt === 'P' || nextAtt === 'P/2') {
                        let usedLeaves = 0;
                        const monthAtt = emp.attendance?.[selectedMonth] || {};
                        Object.entries(monthAtt).forEach(([d, val]) => {
                            if (d !== day.toString()) {
                                if (val === 'P') usedLeaves += 1;
                                else if (val === 'P/2') usedLeaves += 0.5;
                            }
                        });
                        
                        const leaveBalance = Number(emp.leave_balance) || 0;
                        
                        if (nextAtt === 'P') {
                            if (usedLeaves + 1 > leaveBalance) {
                                if (usedLeaves + 0.5 > leaveBalance) {
                                    nextAtt = 0;
                                } else {
                                    nextAtt = 'P/2';
                                }
                            }
                        } else if (nextAtt === 'P/2') {
                            if (usedLeaves + 0.5 > leaveBalance) {
                                nextAtt = 0;
                            }
                        }
                    }
                    
                    return {
                        ...emp,
                        attendance: {
                            ...emp.attendance,
                            [selectedMonth]: {
                                ...emp.attendance?.[selectedMonth],
                                [day]: nextAtt
                            }
                        }
                    };
                }
                return emp;
            });
            return newEmployees;
        });
    };

    const calculateRow = (emp) => {
        if (emp.isDepartment) return emp;
        
        const basic = Number(emp.basic_salary) || 0;
        const phone = Number(emp.phone_allowance) || 0;
        const parking = Number(emp.parking_allowance) || 0;
        const makeup = Number(emp.makeup_allowance) || 0;
        const gondola = Number(emp.gondola_allowance) || 0;
        const laptop = Number(emp.laptop_allowance) || 0;
        
        const total_income_5 = basic + phone + parking + makeup + gondola + laptop;
        
        const [yStr, mStr] = selectedMonth.split('-');
        const y = parseInt(yStr), m = parseInt(mStr);
        const daysInMonth = new Date(y, m, 0).getDate();
        let actual = 0;
        for (let i = 1; i <= daysInMonth; i++) {
            const isSunday = new Date(y, m - 1, i).getDay() === 0;
            const isHoliday = getIsHoliday(i);
            const defaultAtt = isHoliday || isSunday ? 0 : 1;
            let attVal = emp.attendance?.[selectedMonth]?.[i] ?? defaultAtt;
            if (isHoliday && attVal === 1) attVal = 0;
            
            // P = 1 ngày phép có lương (nghỉ cả ngày, được trả lương 1 ngày)
            // P/2 = Nửa ngày phép có lương (thường là làm nửa ngày, nghỉ nửa ngày có phép => vẫn hưởng đủ 1 ngày công)
            actual += (attVal === 'P' ? 1 : attVal === 'P/2' ? 1 : (Number(attVal) || 0));
        }
        const overtimeHours = Number(emp.overtime_hours) || 0;
        const overtimeDays = (overtimeHours * 2) / 8; // Tăng ca x2
        actual += overtimeDays;

        const std = globalStandardDays || 1;
        
        const total_actual_salary_8_raw = (total_income_5 / std) * actual;
        const total_actual_salary_8 = Math.ceil(total_actual_salary_8_raw / 1000) * 1000;
        
        const ins_sal = Number(emp.insurance_salary) || 0;
        const dn_bhxh = Math.round(ins_sal * 0.17);
        const dn_bhyt = Math.round(ins_sal * 0.03);
        const dn_tnld = Math.round(ins_sal * 0.005);
        const dn_bhtn = Math.round(ins_sal * 0.01);
        const dn_total = dn_bhxh + dn_bhyt + dn_tnld + dn_bhtn;
        
        const nld_bhxh = Math.round(ins_sal * 0.08);
        const nld_bhyt = Math.round(ins_sal * 0.015);
        const nld_bhtn = Math.round(ins_sal * 0.01);
        const nld_total_9 = nld_bhxh + nld_bhyt + nld_bhtn;
        
        const adv = Number(emp.advance) || 0;
        const ded = Number(emp.other_deductions) || 0;
        const add = Number(emp.other_additions) || 0;
        
        const actual_receive_raw = total_actual_salary_8 - nld_total_9 - adv - ded + add;
        const actual_receive = Math.ceil(actual_receive_raw / 1000) * 1000;
        
        const cash = Number(emp.cash) || 0;
        const remaining = actual_receive - cash;
        
        return {
            ...emp,
            calculated: {
                total_income_5,
                actual_days: actual,
                total_actual_salary_8,
                dn_bhxh, dn_bhyt, dn_tnld, dn_bhtn, dn_total,
                nld_bhxh, nld_bhyt, nld_bhtn, nld_total_9,
                actual_receive,
                remaining
            }
        };
    };

    const displayEmployees = viewingHistoryId && historyRecords[viewingHistoryId] ? historyRecords[viewingHistoryId].employees : employees;
    const calculatedEmployees = viewingHistoryId && historyRecords[viewingHistoryId] ? displayEmployees : displayEmployees.map(calculateRow);

    const totals = calculatedEmployees.reduce((acc, emp) => {
        if (emp.isDepartment) return acc;
        acc.basic_salary += Number(emp.basic_salary) || 0;
        acc.phone_allowance += Number(emp.phone_allowance) || 0;
        acc.parking_allowance += Number(emp.parking_allowance) || 0;
        acc.makeup_allowance += Number(emp.makeup_allowance) || 0;
        acc.gondola_allowance += Number(emp.gondola_allowance) || 0;
        acc.laptop_allowance += Number(emp.laptop_allowance) || 0;
        acc.total_income_5 += emp.calculated.total_income_5 || 0;
        acc.total_actual_salary_8 += emp.calculated.total_actual_salary_8 || 0;
        acc.insurance_salary += Number(emp.insurance_salary) || 0;
        
        acc.dn_bhxh += emp.calculated.dn_bhxh;
        acc.dn_bhyt += emp.calculated.dn_bhyt;
        acc.dn_tnld += emp.calculated.dn_tnld;
        acc.dn_bhtn += emp.calculated.dn_bhtn;
        acc.dn_total += emp.calculated.dn_total;
        
        acc.nld_bhxh += emp.calculated.nld_bhxh;
        acc.nld_bhyt += emp.calculated.nld_bhyt;
        acc.nld_bhtn += emp.calculated.nld_bhtn;
        acc.nld_total_9 += emp.calculated.nld_total_9;
        
        acc.advance += Number(emp.advance) || 0;
        acc.other_deductions += Number(emp.other_deductions) || 0;
        acc.other_additions += Number(emp.other_additions) || 0;
        acc.actual_receive += emp.calculated.actual_receive;
        acc.cash += Number(emp.cash) || 0;
        acc.remaining += emp.calculated.remaining;
        return acc;
    }, {
        basic_salary: 0, phone_allowance: 0, parking_allowance: 0, makeup_allowance: 0, gondola_allowance: 0, laptop_allowance: 0, total_income_5: 0,
        total_actual_salary_8: 0, insurance_salary: 0,
        dn_bhxh: 0, dn_bhyt: 0, dn_tnld: 0, dn_bhtn: 0, dn_total: 0,
        nld_bhxh: 0, nld_bhyt: 0, nld_bhtn: 0, nld_total_9: 0,
        advance: 0, other_deductions: 0, other_additions: 0, actual_receive: 0, cash: 0, remaining: 0
    });

    const fmt = (val) => val ? new Intl.NumberFormat('vi-VN').format(val) : '0';

    const exportExcel = () => {
        let html = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
            <head>
                <meta charset="utf-8">
                <style>
                    table { border-collapse: collapse; font-family: 'Times New Roman', Times, serif; font-size: 12pt; }
                    th, td { border: 1px solid #000; padding: 5px; }
                    th { background-color: #f2f2f2; text-align: center; font-weight: bold; }
                    .text-left { text-align: left; }
                    .text-center { text-align: center; }
                    .text-right { text-align: right; }
                    .department { background-color: #d9d9d9; font-weight: bold; text-align: left; }
                    .total-row { font-weight: bold; background-color: #ffffcc; }
                </style>
            </head>
            <body>
                <table>
                    <thead>
                        <tr>
                            <th rowspan="2">STT</th>
                            <th rowspan="2">HỌ VÀ TÊN</th>
                            <th rowspan="2">LƯƠNG CHÍNH<br/>(1)</th>
                            <th rowspan="2">ĐIỆN THOẠI<br/>(2)</th>
                            <th colspan="4">PHỤ CẤP</th>
                            <th rowspan="2">TỔNG THU NHẬP<br/>(5)=(1)+(2)+(3)+(4)</th>
                            <th rowspan="2">NGÀY CÔNG THỰC TẾ<br/>(6)</th>
                            <th rowspan="2">CÔNG CHUẨN<br/>(7)</th>
                            <th rowspan="2">TĂNG CA<br/>(GIỜ)</th>
                            <th rowspan="2">LƯƠNG TĂNG CA</th>
                            <th rowspan="2">TỔNG LƯƠNG THỰC TẾ<br/>(8)</th>
                            <th rowspan="2">LƯƠNG ĐÓNG BHXH</th>
                            <th colspan="5">CÁC KHOẢN PHÍ TÍNH VÀO CHI PHÍ DN</th>
                            <th colspan="4">CÁC KHOẢN TRÍCH TRỪ VÀO LƯƠNG NLĐ</th>
                            <th rowspan="2">TẠM ỨNG<br/>(10)</th>
                            <th rowspan="2">TRỪ KHÁC<br/>(11)</th>
                            <th rowspan="2">CỘNG KHÁC<br/>(12)</th>
                            <th rowspan="2">THỰC LÃNH<br/>(8)-(9)-(10)-(11)+(12)</th>
                            <th rowspan="2">CHI TIỀN MẶT</th>
                            <th rowspan="2">CÒN LẠI</th>
                            <th rowspan="2">GHI CHÚ</th>
                            <th rowspan="2">STK</th>
                            <th rowspan="2">TÊN CHỦ TK</th>
                            <th rowspan="2">NGÂN HÀNG</th>
                        </tr>
                        <tr>
                            <th>GIỮ XE (3)</th>
                            <th>SON PHẤN (4)</th>
                            <th>GONDOLA</th>
                            <th>LAPTOP</th>
                            <th>BHXH 17%</th>
                            <th>BHYT 3%</th>
                            <th>TNLĐ, BNN 0.5%</th>
                            <th>BHTN 1%</th>
                            <th>CỘNG</th>
                            <th>BHXH 8%</th>
                            <th>BHYT 1.5%</th>
                            <th>BHTN 1%</th>
                            <th>TRỪ VÀO LƯƠNG NLĐ (9)</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        let stt = 0;
        calculatedEmployees.forEach(emp => {
            if (emp.isDepartment) {
                html += `<tr><td colspan="34" class="department">${emp.isCustomDept ? emp.department : emp.department}</td></tr>`;
            } else {
                stt++;
                html += `
                    <tr>
                        <td class="text-center">${stt}</td>
                        <td class="text-left">${emp.name || ''}</td>
                        <td class="text-right">${fmt(emp.basic_salary)}</td>
                        <td class="text-right">${fmt(emp.phone_allowance)}</td>
                        <td class="text-right">${fmt(emp.parking_allowance)}</td>
                        <td class="text-right">${fmt(emp.makeup_allowance)}</td>
                        <td class="text-right">${fmt(emp.gondola_allowance)}</td>
                        <td class="text-right">${fmt(emp.laptop_allowance)}</td>
                        <td class="text-right">${fmt(emp.calculated.total_income_5)}</td>
                        <td class="text-center">${fmt(emp.calculated.actual_days)}</td>
                        <td class="text-center">${fmt(globalStandardDays)}</td>
                        <td class="text-right">${fmt(emp.calculated.total_actual_salary_8)}</td>
                        <td class="text-right">${fmt(emp.insurance_salary)}</td>
                        <td class="text-right">${fmt(emp.calculated.dn_bhxh)}</td>
                        <td class="text-right">${fmt(emp.calculated.dn_bhyt)}</td>
                        <td class="text-right">${fmt(emp.calculated.dn_tnld)}</td>
                        <td class="text-right">${fmt(emp.calculated.dn_bhtn)}</td>
                        <td class="text-right">${fmt(emp.calculated.dn_total)}</td>
                        <td class="text-right">${fmt(emp.calculated.nld_bhxh)}</td>
                        <td class="text-right">${fmt(emp.calculated.nld_bhyt)}</td>
                        <td class="text-right">${fmt(emp.calculated.nld_bhtn)}</td>
                        <td class="text-right">${fmt(emp.calculated.nld_total_9)}</td>
                        <td class="text-right">${fmt(emp.advance)}</td>
                        <td class="text-right">${fmt(emp.other_deductions)}</td>
                        <td class="text-right">${fmt(emp.other_additions)}</td>
                        <td class="text-right">${fmt(emp.calculated.actual_receive)}</td>
                        <td class="text-right">${fmt(emp.cash)}</td>
                        <td class="text-right">${fmt(emp.calculated.remaining)}</td>
                        <td class="text-left">${emp.notes || ''}</td>
                        <td class="text-left" style="mso-number-format:'\\@'">${emp.bank_account || ''}</td>
                        <td class="text-left">${emp.bank_account_name || ''}</td>
                        <td class="text-left">${emp.bank_name || ''}</td>
                    </tr>
                `;
            }
        });

        html += `
            <tr class="total-row">
                <td colspan="2" class="text-center">TỔNG CỘNG</td>
                <td class="text-right">${fmt(totals.basic_salary)}</td>
                <td class="text-right">${fmt(totals.phone_allowance)}</td>
                <td class="text-right">${fmt(totals.parking_allowance)}</td>
                <td class="text-right">${fmt(totals.makeup_allowance)}</td>
                <td class="text-right">${fmt(totals.gondola_allowance)}</td>
                <td class="text-right">${fmt(totals.laptop_allowance)}</td>
                <td class="text-right">${fmt(totals.total_income_5)}</td>
                <td></td>
                <td></td>
                <td></td>
                <td class="text-right">${fmt(totals.overtime_pay)}</td>
                <td class="text-right">${fmt(totals.total_actual_salary_8)}</td>
                <td class="text-right">${fmt(totals.insurance_salary)}</td>
                <td class="text-right">${fmt(totals.dn_bhxh)}</td>
                <td class="text-right">${fmt(totals.dn_bhyt)}</td>
                <td class="text-right">${fmt(totals.dn_tnld)}</td>
                <td class="text-right">${fmt(totals.dn_bhtn)}</td>
                <td class="text-right">${fmt(totals.dn_total)}</td>
                <td class="text-right">${fmt(totals.nld_bhxh)}</td>
                <td class="text-right">${fmt(totals.nld_bhyt)}</td>
                <td class="text-right">${fmt(totals.nld_bhtn)}</td>
                <td class="text-right">${fmt(totals.nld_total_9)}</td>
                <td class="text-right">${fmt(totals.advance)}</td>
                <td class="text-right">${fmt(totals.other_deductions)}</td>
                <td class="text-right">${fmt(totals.other_additions)}</td>
                <td class="text-right">${fmt(totals.actual_receive)}</td>
                <td class="text-right">${fmt(totals.cash)}</td>
                <td class="text-right">${fmt(totals.remaining)}</td>
                <td colspan="4"></td>
            </tr>
        `;

        html += '</tbody></table></body></html>';
        
        const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `Bang_Luong_NV_${selectedMonth}.xls`;
        link.href = url;
        link.click();
    };

    let stt = 0;

    const renderTableContent = (forceTab) => {
        const tabToRender = typeof forceTab === 'string' ? forceTab : activeTab;
        return (
<div className={`overflow-x-auto custom-scrollbar pb-4`} style={{ maxHeight: 'calc(100vh - 200px)' }}>
        {tabToRender === 'salary' ? (
    <table id="salary-table" className={`w-full text-xs border-collapse whitespace-nowrap min-w-max ${viewingHistoryId ? 'pointer-events-none' : ''}`}>
        <thead className="bg-slate-100 sticky top-0 z-30 shadow-sm">
            <tr>
                <th rowSpan="2" className="border border-slate-300 p-1 text-center font-bold text-slate-700 w-10">STT</th>
                <th rowSpan="2" className="border border-slate-300 p-2 text-center font-bold text-slate-700 min-w-[150px] sticky left-0 z-40 bg-slate-100">HỌ VÀ TÊN</th>
                <th rowSpan="2" className="border border-slate-300 p-1 text-center font-bold text-slate-700 w-24">LƯƠNG CHÍNH<br/><span className="text-[10px] text-slate-500">(1)</span></th>
                <th rowSpan="2" className="border border-slate-300 p-1 text-center font-bold text-slate-700 w-20">ĐIỆN THOẠI<br/><span className="text-[10px] text-slate-500">(2)</span></th>
                <th colSpan="4" className="border border-slate-300 p-1 text-center font-bold text-slate-700">PHỤ CẤP</th>
                <th rowSpan="2" className="border border-slate-300 p-1 text-center font-bold text-slate-700 w-24">TỔNG THU NHẬP<br/><span className="text-[10px] text-slate-500">(5)</span></th>
                <th rowSpan="2" className="border border-slate-300 p-1 text-center font-bold text-slate-700 bg-amber-50 w-16">NC<br/>THỰC TẾ<br/><span className="text-[10px] text-slate-500">(6)</span></th>
                <th rowSpan="2" className="border border-slate-300 p-1 text-center font-bold text-slate-700 bg-amber-50 w-16">CÔNG<br/>CHUẨN<br/><span className="text-[10px] text-slate-500">(7)</span></th>
                <th rowSpan="2" className="border border-slate-300 p-1 text-center font-bold text-slate-700 w-24">TỔNG LƯƠNG<br/>THỰC TẾ<br/><span className="text-[10px] text-slate-500">(8)</span></th>
                <th rowSpan="2" className="border border-slate-300 p-1 text-center font-bold text-slate-700 bg-blue-50 w-24">LƯƠNG ĐÓNG<br/>BHXH</th>
                <th colSpan="5" className="border border-slate-300 p-1 text-center font-bold text-slate-700">CÁC KHOẢN PHÍ TÍNH VÀO CHI PHÍ DN</th>
                <th colSpan="4" className="border border-slate-300 p-1 text-center font-bold text-slate-700">CÁC KHOẢN TRÍCH TRỪ VÀO LƯƠNG NLĐ</th>
                <th rowSpan="2" className="border border-slate-300 p-1 text-center font-bold text-slate-700 bg-emerald-50 w-20">TẠM ỨNG<br/><span className="text-[10px] text-slate-500">(10)</span></th>
                <th rowSpan="2" className="border border-slate-300 p-1 text-center font-bold text-slate-700 bg-emerald-50 w-20">TRỪ KHÁC<br/><span className="text-[10px] text-slate-500">(11)</span></th>
                <th rowSpan="2" className="border border-slate-300 p-1 text-center font-bold text-slate-700 bg-emerald-50 w-20">CỘNG KHÁC<br/><span className="text-[10px] text-slate-500">(12)</span></th>
                <th rowSpan="2" className="border border-slate-300 p-1 text-center font-bold text-slate-700 w-24">THỰC LÃNH<br/><span className="text-[10px] text-slate-500">(8)-(9)-(10)-(11)+(12)</span></th>
                <th rowSpan="2" className="border border-slate-300 p-1 text-center font-bold text-slate-700 w-24">CHI TIỀN MẶT</th>
                <th rowSpan="2" className="border border-slate-300 p-1 text-center font-bold text-slate-700 w-24">CÒN LẠI</th>
                <th rowSpan="2" className="border border-slate-300 p-1 text-center font-bold text-slate-700 min-w-[150px]">GHI CHÚ</th>
                <th rowSpan="2" className="border border-slate-300 p-1 text-center font-bold text-slate-700 w-28">STK</th>
                <th rowSpan="2" className="border border-slate-300 p-1 text-center font-bold text-slate-700 w-32">TÊN CHỦ TK</th>
                <th rowSpan="2" className="border border-slate-300 p-1 text-center font-bold text-slate-700 w-24">NGÂN HÀNG</th>
                <th rowSpan="2" className="border border-slate-300 p-1 text-center font-bold text-slate-700 print:hidden w-24">THAO TÁC</th>
            </tr>
            <tr>
                <th className="border border-slate-300 p-1 text-center text-[10px] font-bold text-slate-600 w-16">GIỮ XE (3)</th>
                <th className="border border-slate-300 p-1 text-center text-[10px] font-bold text-slate-600 w-16">SON PHẤN (4)</th>
                <th className="border border-slate-300 p-1 text-center text-[10px] font-bold text-slate-600 w-16">GONDOLA</th>
                <th className="border border-slate-300 p-1 text-center text-[10px] font-bold text-slate-600 w-16">LAPTOP</th>
                
                <th className="border border-slate-300 p-1 text-center text-[10px] font-bold text-slate-600 w-16">BHXH 17%</th>
                <th className="border border-slate-300 p-1 text-center text-[10px] font-bold text-slate-600 w-16">BHYT 3%</th>
                <th className="border border-slate-300 p-1 text-center text-[10px] font-bold text-slate-600 w-16">TNLĐ, BNN 0.5%</th>
                <th className="border border-slate-300 p-1 text-center text-[10px] font-bold text-slate-600 w-16">BHTN 1%</th>
                <th className="border border-slate-300 p-1 text-center text-[10px] font-bold text-slate-600 w-20">CỘNG</th>
                
                <th className="border border-slate-300 p-1 text-center text-[10px] font-bold text-slate-600 w-16">BHXH 8%</th>
                <th className="border border-slate-300 p-1 text-center text-[10px] font-bold text-slate-600 w-16">BHYT 1.5%</th>
                <th className="border border-slate-300 p-1 text-center text-[10px] font-bold text-slate-600 w-16">BHTN 1%</th>
                <th className="border border-slate-300 p-1 text-center text-[10px] font-bold text-slate-600 w-20">TRỪ VÀO LƯƠNG NLĐ (9)</th>
            </tr>
        </thead>
        <tbody>
            {calculatedEmployees.map((emp) => {
                if (emp.isDepartment) {
                    return (
                        <tr key={emp.id} className="bg-slate-200/80 font-bold hover:bg-slate-300 transition-colors">
                            <td className="border border-slate-300 p-1 text-center"></td>
                            <td className="border border-slate-300 p-1 sticky left-[48px] md:left-[48px] z-20 bg-slate-200/80">
                                {emp.isCustomDept ? (
                                    <input 
                                        type="text" 
                                        value={emp.department} 
                                        onChange={(e) => handleChange(emp.id, 'department', e.target.value)}
                                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 outline-none font-bold text-slate-800 uppercase focus:border-blue-500"
                                        placeholder="Nhập tên phòng ban..."
                                        autoFocus
                                    />
                                ) : (
                                    <select 
                                        value={DEPARTMENTS.includes(emp.department) ? emp.department : 'Khác...'} 
                                        onChange={(e) => handleDepartmentChange(emp.id, e.target.value)}
                                        className="w-full bg-transparent outline-none font-bold text-slate-800 uppercase cursor-pointer"
                                    >
                                        {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                )}
                            </td>
                            <td colSpan={26} className="border border-slate-300"></td>
                            <td className="border border-slate-300 p-1 text-center print:hidden pointer-events-auto">
                                {!viewingHistoryId && (
                                    <div className="flex items-center justify-center gap-1">
                                        <button onClick={() => handleDeleteRow(emp.id)} className="text-red-500 hover:bg-red-100 p-1 rounded transition" title="Xóa phòng ban"><Trash2 size={14}/></button>
                                    </div>
                                )}
                            </td>
                        </tr>
                    );
                }

                stt++;

                return (
                    <tr key={emp.id} className="hover:bg-blue-50/50 transition-colors group">
                        <td className="border border-slate-300 p-1 text-center text-slate-500">{stt}</td>
                        <td className="border border-slate-300 p-0 sticky left-0 z-20 bg-white group-hover:bg-blue-50/50">
                            <input type="text" value={emp.name} onChange={(e) => handleChange(emp.id, 'name', e.target.value)} className="w-full h-full p-1 px-2 outline-none bg-transparent" placeholder="Tên nhân viên..." />
                        </td>
                        <td className="border border-slate-300 p-0">
                            <NumberInput value={emp.basic_salary} onChange={(val) => handleChange(emp.id, 'basic_salary', val)} className="w-full h-full p-1 px-2 outline-none bg-transparent text-right" />
                        </td>
                        <td className="border border-slate-300 p-0">
                            <NumberInput value={emp.phone_allowance} onChange={(val) => handleChange(emp.id, 'phone_allowance', val)} className="w-full h-full p-1 px-2 outline-none bg-transparent text-right" />
                        </td>
                        <td className="border border-slate-300 p-0">
                            <NumberInput value={emp.parking_allowance} onChange={(val) => handleChange(emp.id, 'parking_allowance', val)} className="w-full h-full p-1 px-2 outline-none bg-transparent text-right" />
                        </td>
                        <td className="border border-slate-300 p-0">
                            <NumberInput value={emp.makeup_allowance} onChange={(val) => handleChange(emp.id, 'makeup_allowance', val)} className="w-full h-full p-1 px-2 outline-none bg-transparent text-right" />
                        </td>
                        <td className="border border-slate-300 p-0">
                            <NumberInput value={emp.gondola_allowance} onChange={(val) => handleChange(emp.id, 'gondola_allowance', val)} className="w-full h-full p-1 px-2 outline-none bg-transparent text-right" />
                        </td>
                        <td className="border border-slate-300 p-0">
                            <NumberInput value={emp.laptop_allowance} onChange={(val) => handleChange(emp.id, 'laptop_allowance', val)} className="w-full h-full p-1 px-2 outline-none bg-transparent text-right" />
                        </td>
                        
                        <td className="border border-slate-300 p-1 px-2 text-right font-bold bg-slate-50 text-slate-700">{formatCurrency(emp.calculated.total_income_5).replace('₫', '')}</td>
                        
                        <td className="border border-slate-300 p-1 px-2 text-center font-bold text-amber-700 bg-amber-50/50 cursor-pointer hover:bg-amber-100 transition" onClick={() => setActiveTab('attendance')}>
                            {emp.calculated.actual_days}
                        </td>
                        
                        <td className="border border-slate-300 p-1 px-2 text-center font-bold text-amber-700 bg-amber-50/50">
                            {viewingHistoryId && historyRecords[viewingHistoryId] ? historyRecords[viewingHistoryId].globalStandardDays : globalStandardDays}
                        </td>
                        
                        <td className="border border-slate-300 p-1 px-2 text-right font-bold text-slate-700">{formatCurrency(emp.calculated.total_actual_salary_8).replace('₫', '')}</td>
                        
                        <td className="border border-slate-300 p-0 bg-blue-50/50">
                            <NumberInput value={emp.insurance_salary} onChange={(val) => handleChange(emp.id, 'insurance_salary', val)} className="w-full h-full p-1 px-2 outline-none bg-transparent text-right font-bold text-blue-700" />
                        </td>
                        
                        <td className="border border-slate-300 p-1 px-2 text-right text-[10px] text-slate-500">{formatCurrency(emp.calculated.dn_bhxh).replace('₫', '')}</td>
                        <td className="border border-slate-300 p-1 px-2 text-right text-[10px] text-slate-500">{formatCurrency(emp.calculated.dn_bhyt).replace('₫', '')}</td>
                        <td className="border border-slate-300 p-1 px-2 text-right text-[10px] text-slate-500">{formatCurrency(emp.calculated.dn_tnld).replace('₫', '')}</td>
                        <td className="border border-slate-300 p-1 px-2 text-right text-[10px] text-slate-500">{formatCurrency(emp.calculated.dn_bhtn).replace('₫', '')}</td>
                        <td className="border border-slate-300 p-1 px-2 text-right text-[10px] font-bold text-slate-700">{formatCurrency(emp.calculated.dn_total).replace('₫', '')}</td>
                        
                        <td className="border border-slate-300 p-1 px-2 text-right text-[10px] text-slate-500">{formatCurrency(emp.calculated.nld_bhxh).replace('₫', '')}</td>
                        <td className="border border-slate-300 p-1 px-2 text-right text-[10px] text-slate-500">{formatCurrency(emp.calculated.nld_bhyt).replace('₫', '')}</td>
                        <td className="border border-slate-300 p-1 px-2 text-right text-[10px] text-slate-500">{formatCurrency(emp.calculated.nld_bhtn).replace('₫', '')}</td>
                        <td className="border border-slate-300 p-1 px-2 text-right text-[10px] font-bold bg-slate-50 text-slate-700">{formatCurrency(emp.calculated.nld_total_9).replace('₫', '')}</td>
                        
                        <td className="border border-slate-300 p-0 bg-emerald-50/50">
                            <NumberInput value={emp.advance} onChange={(val) => handleChange(emp.id, 'advance', val)} className="w-full h-full p-1 px-2 outline-none bg-transparent text-right text-emerald-700" />
                        </td>
                        <td className="border border-slate-300 p-0 bg-red-50/10">
                            <NumberInput value={emp.other_deductions} onChange={(val) => handleChange(emp.id, 'other_deductions', val)} className="w-full h-full p-1 px-2 outline-none bg-transparent text-right font-bold text-red-600" />
                        </td>
                        <td className="border border-slate-300 p-0 bg-emerald-50/50">
                            <NumberInput value={emp.other_additions} onChange={(val) => handleChange(emp.id, 'other_additions', val)} className="w-full h-full p-1 px-2 outline-none bg-transparent text-right text-emerald-700" />
                        </td>
                        
                        <td className="border border-slate-300 p-1 px-2 text-right font-black text-blue-700 text-sm">{formatCurrency(emp.calculated.actual_receive).replace('₫', '')}</td>
                        
                        <td className="border border-slate-300 p-0">
                            <NumberInput value={emp.cash} onChange={(val) => handleChange(emp.id, 'cash', val)} className="w-full h-full p-1 px-2 outline-none bg-transparent text-right" />
                        </td>
                        
                        <td className="border border-slate-300 p-1 px-2 text-right font-bold text-slate-700">{formatCurrency(emp.calculated.remaining).replace('₫', '')}</td>
                        
                        <td className="border border-slate-300 p-0">
                            <input type="text" value={emp.notes} onChange={(e) => handleChange(emp.id, 'notes', e.target.value)} className="w-full h-full p-1 px-2 outline-none bg-transparent text-[10px]" />
                        </td>
                        <td className="border border-slate-300 p-0">
                            <input type="text" value={emp.bank_account} onChange={(e) => handleChange(emp.id, 'bank_account', e.target.value)} className="w-full h-full p-1 px-2 outline-none bg-transparent text-[10px]" />
                        </td>
                        <td className="border border-slate-300 p-0">
                            <input type="text" value={emp.bank_account_name} onChange={(e) => handleChange(emp.id, 'bank_account_name', e.target.value)} className="w-full h-full p-1 px-2 outline-none bg-transparent text-[10px] uppercase" />
                        </td>
                        <td className="border border-slate-300 p-0">
                            <input type="text" value={emp.bank_name} onChange={(e) => handleChange(emp.id, 'bank_name', e.target.value)} className="w-full h-full p-1 px-2 outline-none bg-transparent text-[10px] uppercase" />
                        </td>
                        <td className="border border-slate-300 p-1 text-center print:hidden pointer-events-auto">
                            <div className="flex items-center justify-center gap-1">
                                {!viewingHistoryId ? (
                                    <button onClick={() => handleDeleteRow(emp.id)} className="text-red-500 hover:bg-red-100 p-1 rounded transition" title="Xóa nhân viên"><Trash2 size={14}/></button>
                                ) : (
                                    emp.calculated?.remaining > 0 ? (
                                        accountedTxs.some(note => note && note.includes(`[CHI LƯƠNG] ${emp.name} - Kỳ ${viewingHistoryId}`)) ? (
                                            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded whitespace-nowrap border border-slate-200 cursor-not-allowed" title="Đã hạch toán">Đã hạch toán</span>
                                        ) : (
                                            <button 
                                                onClick={() => setPaymentModal({ 
                                                    isOpen: true, 
                                                    empId: emp.id, 
                                                    empName: emp.name, 
                                                    department: emp.department, 
                                                    amount: emp.calculated.remaining, 
                                                    code: '6421', 
                                                    corresponding_account: '1111', 
                                                    recipient: emp.name, 
                                                    note: `[CHI LƯƠNG] ${emp.name} - Kỳ ${viewingHistoryId}`, 
                                                    allocations: [{id: Date.now(), project_name: projects?.[0]?.name || '', from_date: '', to_date: ''}], 
                                                    monthId: viewingHistoryId,
                                                    globalStandardDays: historyRecords[viewingHistoryId]?.globalStandardDays || 26 
                                                })}
                                                className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-bold px-2 py-1 rounded text-xs transition whitespace-nowrap"
                                            >
                                                Hạch toán
                                            </button>
                                        )
                                    ) : (
                                        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded whitespace-nowrap border border-slate-200">Đã đủ</span>
                                    )
                                )}
                            </div>
                        </td>
                    </tr>
                );
            })}
        </tbody>
        <tfoot className="bg-slate-800 text-white font-bold sticky bottom-0 z-30 shadow-lg">
            <tr>
                <td colSpan={2} className="border border-slate-700 p-2 text-center sticky left-0 bg-slate-800 z-40 shadow-[2px_0_5px_rgba(0,0,0,0.1)]">TỔNG CỘNG</td>
                <td className="border border-slate-700 p-2 text-right">{formatCurrency(totals.basic_salary).replace('₫', '')}</td>
                <td className="border border-slate-700 p-2 text-right">{formatCurrency(totals.phone_allowance).replace('₫', '')}</td>
                <td className="border border-slate-700 p-2 text-right">{formatCurrency(totals.parking_allowance).replace('₫', '')}</td>
                <td className="border border-slate-700 p-2 text-right">{formatCurrency(totals.makeup_allowance).replace('₫', '')}</td>
                <td className="border border-slate-700 p-2 text-right">{formatCurrency(totals.gondola_allowance).replace('₫', '')}</td>
                <td className="border border-slate-700 p-2 text-right">{formatCurrency(totals.laptop_allowance).replace('₫', '')}</td>
                <td className="border border-slate-700 p-2 text-right text-amber-300">{formatCurrency(totals.total_income_5).replace('₫', '')}</td>
                <td className="border border-slate-700 p-2 text-center">-</td>
                <td className="border border-slate-700 p-2 text-center">-</td>
                <td className="border border-slate-700 p-2 text-right text-emerald-300">{formatCurrency(totals.total_actual_salary_8).replace('₫', '')}</td>
                <td className="border border-slate-700 p-2 text-right text-blue-300">{formatCurrency(totals.insurance_salary).replace('₫', '')}</td>
                <td className="border border-slate-700 p-2 text-right">{formatCurrency(totals.dn_bhxh).replace('₫', '')}</td>
                <td className="border border-slate-700 p-2 text-right">{formatCurrency(totals.dn_bhyt).replace('₫', '')}</td>
                <td className="border border-slate-700 p-2 text-right">{formatCurrency(totals.dn_tnld).replace('₫', '')}</td>
                <td className="border border-slate-700 p-2 text-right">{formatCurrency(totals.dn_bhtn).replace('₫', '')}</td>
                <td className="border border-slate-700 p-2 text-right text-amber-300">{formatCurrency(totals.dn_total).replace('₫', '')}</td>
                <td className="border border-slate-700 p-2 text-right">{formatCurrency(totals.nld_bhxh).replace('₫', '')}</td>
                <td className="border border-slate-700 p-2 text-right">{formatCurrency(totals.nld_bhyt).replace('₫', '')}</td>
                <td className="border border-slate-700 p-2 text-right">{formatCurrency(totals.nld_bhtn).replace('₫', '')}</td>
                <td className="border border-slate-700 p-2 text-right text-amber-300">{formatCurrency(totals.nld_total_9).replace('₫', '')}</td>
                <td className="border border-slate-700 p-2 text-right">{formatCurrency(totals.advance).replace('₫', '')}</td>
                <td className="border border-slate-700 p-2 text-right">{formatCurrency(totals.other_deductions).replace('₫', '')}</td>
                <td className="border border-slate-700 p-2 text-right">{formatCurrency(totals.other_additions).replace('₫', '')}</td>
                <td className="border border-slate-700 p-2 text-right text-blue-300 text-sm">{formatCurrency(totals.actual_receive).replace('₫', '')}</td>
                <td className="border border-slate-700 p-2 text-right">{formatCurrency(totals.cash).replace('₫', '')}</td>
                <td className="border border-slate-700 p-2 text-right text-emerald-300">{formatCurrency(totals.remaining).replace('₫', '')}</td>
                <td colSpan={5} className="border border-slate-700 p-2 text-center print:hidden"></td>
            </tr>
        </tfoot>
    </table>
        ) : (
    <table className={`w-full text-xs border-collapse whitespace-nowrap min-w-max ${viewingHistoryId ? 'pointer-events-none' : ''}`}>
        <thead className="bg-slate-100 sticky top-0 z-30 shadow-sm">
            <tr>
                <th rowSpan="2" className="border border-slate-300 p-2 text-center font-bold text-slate-700 w-12 min-w-[48px] max-w-[48px] sticky left-0 z-40 bg-slate-100">STT</th>
                <th rowSpan="2" className="border border-slate-300 p-2 text-center font-bold text-slate-700 w-[200px] min-w-[200px] max-w-[200px] sticky left-[48px] md:left-[48px] z-40 bg-slate-100">HỌ VÀ TÊN</th>
                <th rowSpan="2" className="border border-slate-300 p-2 text-center font-bold text-slate-700 w-[80px] min-w-[80px] max-w-[80px] bg-slate-100">PHÉP CÓ</th>
                {Array.from({ length: daysInMonthCount }).map((_, i) => {
                    const date = new Date(yearMonth.y, yearMonth.m - 1, i + 1);
                    const dayOfWeek = date.getDay();
                    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
                    const isSunday = dayOfWeek === 0;
                    
                    return (
                        <th key={`dow-${i}`} className={`border border-slate-300 p-1 text-center text-[10px] font-bold ${isSunday ? 'bg-red-100 text-red-600' : 'text-slate-500 bg-slate-50'}`}>
                            {dayNames[dayOfWeek]}
                        </th>
                    );
                })}
                <th rowSpan="2" className="border border-slate-300 p-2 text-center font-bold text-slate-700 w-20 bg-amber-50">TĂNG CA<br/><span className="text-[10px] text-slate-500">(GIỜ)</span></th>
                <th rowSpan="2" className="border border-slate-300 p-2 text-center font-bold text-slate-700 w-16 bg-blue-50">TỔNG CÔNG<br/><span className="text-[10px] text-slate-500">(ĐÃ CỘNG TĂNG CA)</span></th>
            </tr>
            <tr>
                {Array.from({ length: daysInMonthCount }).map((_, i) => {
                    const date = new Date(yearMonth.y, yearMonth.m - 1, i + 1);
                    const isSunday = date.getDay() === 0;
                    const day = i + 1;
                    const isHoliday = getIsHoliday(day);
                    
                    return (
                        <th key={i} 
                            onClick={() => handleToggleHoliday(day)}
                            className={`border border-slate-300 p-1 text-center font-bold w-10 cursor-pointer transition ${isHoliday ? 'bg-blue-600 text-white shadow-inner' : isSunday ? 'bg-red-100 text-red-600' : 'text-slate-700 hover:bg-slate-200'}`}
                            title="Click để đánh dấu/bỏ đánh dấu ngày lễ"
                        >
                            {day}
                        </th>
                    );
                })}
            </tr>
        </thead>
        <tbody>
            {(() => {
                let localStt = 0;
                let currentDept = '';
                return calculatedEmployees.map(emp => {
                    if (emp.isDepartment) {
                        currentDept = emp.department;
                        return (
                            <tr key={emp.id} className="bg-slate-200/80 font-bold">
                                <td className="border border-slate-300 p-2 text-center sticky left-0 z-20 bg-slate-200/80"></td>
                                <td className="border border-slate-300 p-2 sticky left-[48px] md:left-[48px] z-20 bg-slate-200/80 uppercase">{emp.department}</td>
                                <td colSpan={daysInMonthCount + 2} className="border border-slate-300"></td>
                            </tr>
                        );
                    }
                    
                    localStt++;
                    const actualDays = emp.calculated.actual_days;
                    
                    const thisRowDept = currentDept?.trim().toUpperCase();
                    
                    return (
                        <tr key={emp.id} className="hover:bg-blue-50/50 transition-colors">
                            <td className="border border-slate-300 p-2 text-center font-medium text-slate-500 sticky left-0 z-20 bg-white group-hover:bg-blue-50/50">{localStt}</td>
                            <td className="border border-slate-300 p-2 font-medium text-slate-700 sticky left-[48px] md:left-[48px] z-20 bg-white group-hover:bg-blue-50/50 truncate max-w-[200px]">{emp.name || '---'}</td>
                            <td 
                                className={`border border-slate-300 p-2 text-center font-bold text-blue-600 bg-white transition ${!viewingHistoryId ? 'cursor-pointer hover:bg-blue-200 group-hover:bg-blue-100' : 'group-hover:bg-blue-50/50'}`}
                                onClick={() => !viewingHistoryId && setLeaveModal({ isOpen: true, empId: emp.id, name: emp.name, currentBalance: emp.leave_balance === 'N/A' ? 'N/A' : (Number(emp.leave_balance) || 0) })}
                                title={!viewingHistoryId ? "Click để điều chỉnh phép" : ""}
                            >
                                {getRemainingLeaves(emp, selectedMonth)}
                            </td>
                            {Array.from({ length: daysInMonthCount }).map((_, i) => {
                                const day = i + 1;
                                const isSunday = new Date(yearMonth.y, yearMonth.m - 1, day).getDay() === 0;
                                const isHoliday = getIsHoliday(day);
                                const defaultAtt = isHoliday || isSunday ? 0 : 1;
                                let attValue = emp.attendance?.[selectedMonth]?.[day] ?? defaultAtt;
                                if (isHoliday && attValue === 1) attValue = 0;
                                
                                return (
                                    <td key={day} className={`border border-slate-300 p-0 text-center ${isHoliday ? 'bg-blue-200/80 shadow-inner' : (isSunday && attValue === 1 ? 'bg-red-50/30' : '')}`}>
                                        <button 
                                            onClick={() => handleToggleAttendance(emp.id, day)}
                                            className={`w-full h-full min-h-[36px] font-bold transition hover:opacity-80 ${attValue === 1 ? 'text-emerald-600 hover:bg-slate-200' : attValue === 1.5 ? 'bg-purple-500 text-white' : attValue === 2 ? 'bg-indigo-600 text-white' : attValue === 0.5 ? 'bg-orange-500 text-white' : attValue === 'P' ? 'bg-blue-500 text-white' : attValue === 'P/2' ? 'bg-sky-400 text-white' : 'bg-red-500 text-white'}`}
                                        >
                                            {attValue === 1 ? 'X' : attValue === 1.5 ? '1.5' : attValue === 2 ? '2' : attValue === 0.5 ? '/' : attValue === 'P' ? 'P' : attValue === 'P/2' ? 'P/2' : ''}
                                        </button>
                                    </td>
                                );
                            })}
                            <td className="border border-slate-300 p-0 bg-amber-50/50">
                                <NumberInput value={emp.overtime_hours} onChange={(val) => handleChange(emp.id, 'overtime_hours', val)} className="w-full h-full p-2 outline-none bg-transparent text-center font-bold text-amber-700" />
                            </td>
                            <td className="border border-slate-300 p-2 text-center font-bold text-blue-700 bg-blue-50/50">
                                {actualDays}
                            </td>
                        </tr>
                    );
                });
            })()}
        </tbody>
    </table>
        )}
    </div>
        );
    };

    return (
        <>
        {systemModal.isOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 m-4">
                    <div className="p-6 border-b border-slate-100 flex items-start justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">{systemModal.title}</h3>
                            <p className="text-sm text-slate-500 mt-1">{systemModal.message}</p>
                        </div>
                    </div>
                    {(systemModal.type === 'password' || systemModal.type === 'prompt') && (
                        <div className="p-6">
                            <input
                                type={systemModal.type === 'password' ? "password" : "text"}
                                autoFocus
                                placeholder={systemModal.type === 'password' ? "Nhập mật khẩu..." : "Nhập giá trị..."}
                                value={systemModal.password || ''}
                                onChange={(e) => setSystemModal({...systemModal, password: e.target.value, error: ''})}
                                onKeyDown={async (e) => {
                                    if (e.key === 'Enter') {
                                        if (systemModal.onConfirm) {
                                            const res = await systemModal.onConfirm(systemModal.password);
                                            if (res === true) setSystemModal({...systemModal, isOpen: false, password: '', error: ''});
                                            else if (typeof res === 'string') setSystemModal({...systemModal, error: res});
                                        }
                                    }
                                }}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                            />
                            {systemModal.error && <p className="text-red-500 text-sm mt-2 font-medium">{systemModal.error}</p>}
                        </div>
                    )}
                    <div className="p-4 bg-slate-50 flex justify-end gap-3">
                        {systemModal.type !== 'info' && (
                            <button onClick={() => { systemModal.onCancel?.(); setSystemModal({...systemModal, isOpen: false, password: '', error: ''}) }} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition">
                                Hủy bỏ
                            </button>
                        )}
                        <button 
                            onClick={async () => {
                                let res;
                                if (systemModal.onConfirm) {
                                    res = await systemModal.onConfirm(systemModal.password);
                                }
                                if (res === true || systemModal.type === 'info') setSystemModal({...systemModal, isOpen: false, password: '', error: ''});
                                else if (typeof res === 'string') setSystemModal({...systemModal, error: res});
                            }} 
                            className={`px-4 py-2 text-sm font-bold text-white shadow-md rounded-xl transition ${systemModal.type === 'info' || systemModal.type === 'confirm' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' : 'bg-red-600 hover:bg-red-700 shadow-red-200'}`}
                        >
                            {systemModal.type === 'info' ? 'Đóng' : 'Xác nhận'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {leaveModal.isOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200 p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="p-6 border-b border-slate-100">
                        <h3 className="text-xl font-bold text-slate-800">Điều chỉnh số phép</h3>
                        <p className="text-sm text-slate-500 mt-1">Nhân viên: <span className="font-bold text-slate-700">{leaveModal.name}</span></p>
                    </div>
                    <div className="p-6">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Số phép đầu kỳ (Chưa trừ phép đã dùng)</label>
                        <input 
                            type={leaveModal.currentBalance === 'N/A' ? "text" : "number"} 
                            value={leaveModal.currentBalance === 'N/A' ? 'Không tính' : leaveModal.currentBalance}
                            disabled={leaveModal.currentBalance === 'N/A'}
                            onChange={(e) => setLeaveModal({...leaveModal, currentBalance: e.target.value})}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-lg font-bold disabled:opacity-50 disabled:bg-slate-200"
                            autoFocus
                            onFocus={(e) => e.target.select()}
                        />
                        <label className="flex items-center gap-2 mt-4 cursor-pointer w-fit p-2 hover:bg-slate-50 rounded-lg transition">
                            <input 
                                type="checkbox" 
                                checked={leaveModal.currentBalance === 'N/A'}
                                onChange={(e) => setLeaveModal({...leaveModal, currentBalance: e.target.checked ? 'N/A' : 0})}
                                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="font-bold text-slate-700 select-none">Không tính phép</span>
                        </label>
                        {leaveModal.empId && leaveModal.currentBalance !== 'N/A' && (
                            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800 border border-blue-100">
                                Phép đã dùng trong tháng: <b>{getUsedLeaves(employees.find(e => e.id === leaveModal.empId) || {}, selectedMonth)}</b> ngày<br/>
                                Phép còn lại thực tế: <b>{(Number(leaveModal.currentBalance) || 0) - getUsedLeaves(employees.find(e => e.id === leaveModal.empId) || {}, selectedMonth)}</b> ngày
                            </div>
                        )}
                    </div>
                    <div className="p-4 bg-slate-50 flex justify-end gap-3">
                        <button onClick={() => setLeaveModal({ isOpen: false, empId: null, name: '', currentBalance: 0 })} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition">
                            Hủy bỏ
                        </button>
                        <button onClick={() => {
                            handleChange(leaveModal.empId, 'leave_balance', leaveModal.currentBalance);
                            setLeaveModal({ isOpen: false, empId: null, name: '', currentBalance: 0 });
                        }} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200 rounded-xl transition">
                            Cập nhật
                        </button>
                    </div>
                </div>
            </div>
        )}

        {createPeriodModal.isOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200 p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="p-6 border-b border-slate-100">
                        <h3 className="text-xl font-bold text-slate-800">Tạo kỳ lương mới</h3>
                    </div>
                    <div className="p-6">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Nhập tháng (YYYY-MM)</label>
                        <input 
                            type="month" 
                            value={createPeriodModal.periodName}
                            onChange={(e) => setCreatePeriodModal({...createPeriodModal, periodName: e.target.value})}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition font-bold text-slate-800"
                        />
                        <p className="text-xs text-slate-500 mt-2">Dữ liệu nhân sự và mức lương sẽ được kế thừa tự động từ danh sách hiện tại.</p>
                    </div>
                    <div className="p-4 bg-slate-50 flex justify-end gap-3">
                        <button onClick={() => setCreatePeriodModal({ isOpen: false, periodName: '' })} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition">
                            Hủy bỏ
                        </button>
                        <button onClick={handleCreateNewPeriod} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200 rounded-xl transition">
                            Tạo mới
                        </button>
                    </div>
                </div>
            </div>
        )}

        {salaryTxModal.isOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200 p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="p-6 border-b border-slate-100">
                        <h3 className="text-xl font-bold text-slate-800">Tạo Phiếu Chi Lương</h3>
                        <p className="text-sm text-slate-500 mt-1">Kỳ: <span className="font-bold text-slate-700">{salaryTxModal.monthId}</span></p>
                    </div>
                    <div className="p-6">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Chọn công trình mặc định (phần chưa phân bổ) <span className="text-red-500">*</span></label>
                        <select 
                            value={salaryTxModal.selectedProject}
                            onChange={(e) => setSalaryTxModal({...salaryTxModal, selectedProject: e.target.value})}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                        >
                            <option value="">-- Chọn công trình --</option>
                            {projects.map(p => (
                                <option key={p.name} value={p.name}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="p-4 bg-slate-50 flex justify-end gap-3">
                        <button onClick={() => setSalaryTxModal({ isOpen: false, monthId: null, data: null, selectedProject: '' })} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition">
                            Hủy bỏ
                        </button>
                        <button onClick={handleCreateSalaryTransaction} className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-200 rounded-xl transition">
                            Tạo phiếu chi
                        </button>
                    </div>
                </div>
            </div>
        )}

        {addEmployeeModal.isOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200 p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-100 p-2 rounded-xl">
                                <Plus size={20} className="text-blue-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Thêm Nhân Viên Mới</h3>
                                <p className="text-xs text-slate-500 font-medium">Nhập thông tin chi tiết cho nhân viên</p>
                            </div>
                        </div>
                        <button onClick={() => setAddEmployeeModal({ isOpen: false })} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-xl transition"><X size={20}/></button>
                    </div>
                    
                    <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/30">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Cột trái: Thông tin chính */}
                            <div className="space-y-6">
                                <section>
                                    <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">1</span>
                                        Thông tin chung
                                    </h4>
                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-600">HỌ VÀ TÊN <span className="text-red-500">*</span></label>
                                            <input type="text" value={newEmpData.name} onChange={e => setNewEmpData({...newEmpData, name: e.target.value})} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-medium text-slate-800 transition" placeholder="VD: Nguyễn Văn A" autoFocus/>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-600">PHÒNG BAN <span className="text-red-500">*</span></label>
                                            <select value={newEmpData.department} onChange={e => setNewEmpData({...newEmpData, department: e.target.value})} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-medium text-slate-800 transition uppercase">
                                                {[...new Set([...DEPARTMENTS, ...employees.filter(e => e.isDepartment).map(e => e.department)])].map(d => <option key={d} value={d}>{d}</option>)}
                                                <option value="Khác...">Khác (Tự nhập mới)...</option>
                                            </select>
                                            {newEmpData.department === 'Khác...' && (
                                                <input type="text" value={newEmpData.customDepartment} onChange={e => setNewEmpData({...newEmpData, customDepartment: e.target.value})} className="w-full px-4 py-2.5 mt-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-medium text-slate-800 transition uppercase animate-in slide-in-from-top-2" placeholder="Nhập tên phòng ban mới..." />
                                            )}
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs">2</span>
                                        Lương & BHXH
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-600">LƯƠNG CƠ BẢN</label>
                                            <div className="relative">
                                                <NumberInput value={newEmpData.basic_salary} onChange={val => setNewEmpData({...newEmpData, basic_salary: val})} className="w-full pl-4 pr-8 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 font-bold text-slate-800 transition text-left" />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">₫</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-600">LƯƠNG ĐÓNG BHXH</label>
                                            <div className="relative">
                                                <NumberInput value={newEmpData.insurance_salary} onChange={val => setNewEmpData({...newEmpData, insurance_salary: val})} className="w-full pl-4 pr-8 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 font-bold text-blue-700 transition text-left" />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">₫</span>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            {/* Cột phải: Phụ cấp */}
                            <div>
                                <section className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm h-full">
                                    <h4 className="text-sm font-bold text-slate-800 mb-5 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs">3</span>
                                        Các khoản phụ cấp
                                    </h4>
                                    <div className="space-y-4">
                                        {[
                                            { id: 'phone_allowance', label: 'PHỤ CẤP ĐIỆN THOẠI', icon: '📱' },
                                            { id: 'parking_allowance', label: 'PHỤ CẤP GỬI XE', icon: '🛵' },
                                            { id: 'makeup_allowance', label: 'PHỤ CẤP SON PHẤN', icon: '💄' },
                                            { id: 'gondola_allowance', label: 'PHỤ CẤP GONDOLA', icon: '🏗️' },
                                            { id: 'laptop_allowance', label: 'PHỤ CẤP LAPTOP', icon: '💻' },
                                        ].map(item => (
                                            <div key={item.id} className="flex items-center justify-between gap-4 p-2 hover:bg-slate-50 rounded-xl transition">
                                                <label className="text-xs font-bold text-slate-600 flex items-center gap-2 whitespace-nowrap">
                                                    <span className="text-base">{item.icon}</span> {item.label}
                                                </label>
                                                <div className="relative w-40">
                                                    <NumberInput value={newEmpData[item.id]} onChange={val => setNewEmpData({...newEmpData, [item.id]: val})} className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 font-bold text-slate-700 transition text-right" />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">₫</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-4 px-6 bg-white flex justify-end gap-3 border-t border-slate-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
                        <button onClick={handleAddEmployeeSubmit} className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 rounded-xl transition flex items-center gap-2">
                            <Plus size={18}/> Lưu Nhân Viên
                        </button>
                    </div>
                </div>
            </div>
        )}
        
        <div className="animate-in fade-in duration-500 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 uppercase">
                        {activeTab === 'salary' ? 'Bảng Lương Nhân Viên' : activeTab === 'attendance' ? 'Bảng Chấm Công' : 'Lịch Sử Lưu Trữ'}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-slate-500 text-sm">
                            {activeTab !== 'history' && <>Tháng <span className="font-bold text-blue-600">{selectedMonth}</span></>}
                            {activeTab === 'salary' && ` • Công chuẩn:`}
                        </p>
                        {activeTab === 'salary' && (
                            viewingHistoryId && historyRecords[viewingHistoryId] ? (
                                <span className="text-sm font-bold text-slate-700">{historyRecords[viewingHistoryId].globalStandardDays} ngày</span>
                            ) : (
                                <div className="flex items-center gap-1">
                                    <input 
                                        type="number" 
                                        value={globalStandardDays} 
                                        onChange={(e) => setGlobalStandardDays(Number(e.target.value) || 0)} 
                                        className="w-16 px-2 py-0.5 text-sm border border-slate-300 rounded font-bold text-center focus:outline-none focus:border-blue-500 text-amber-700 bg-amber-50"
                                        min="1"
                                        max="31"
                                    />
                                    <span className="text-sm text-slate-500">ngày</span>
                                </div>
                            )
                        )}
                    </div>
                </div>
                
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                    <button 
                        onClick={() => {
                            if (activeTab === 'history') {
                                setActiveTab('salary');
                                setViewingHistoryId(null);
                            }
                        }}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition ${activeTab !== 'history' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <List size={16} /> Bảng Lương
                    </button>
                    <button 
                        onClick={() => setActiveTab('history')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition ${activeTab === 'history' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Archive size={16} /> Lịch Sử
                    </button>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                    {activeTab !== 'history' && !viewingHistoryId ? (
                        <div className="flex items-center gap-2 border border-slate-200 rounded-xl p-1 bg-white shadow-sm">
                            <button 
                                onClick={() => setCreatePeriodModal({ isOpen: true, periodName: '' })}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition flex items-center gap-1 shadow-sm"
                                title="Tạo kỳ lương mới"
                            >
                                <Plus size={16} /> Tạo Kỳ
                            </button>
                        </div>
                    ) : viewingHistoryId ? (
                        <div className="bg-amber-100 text-amber-800 px-4 py-2 rounded-xl font-bold border border-amber-200 flex items-center gap-2 shadow-sm">
                            <Calendar size={18} /> Đang xem kỳ đã chốt: {selectedMonth}
                        </div>
                    ) : null}
                    {activeTab === 'salary' && (
                        <>
                            {!viewingHistoryId && (
                                <button onClick={() => setAddEmployeeModal({ isOpen: true })} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 transition shadow-lg shadow-blue-200">
                                    <Plus size={16} /> Thêm Nhân Viên
                                </button>
                            )}
                            <button onClick={() => window.print()} className="bg-slate-700 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 transition">
                                <Printer size={16} /> In
                            </button>
                            <button onClick={exportExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 transition shadow-lg shadow-emerald-200">
                                <Download size={16} /> Excel
                            </button>
                        </>
                    )}
                </div>
            </div>

            {activeTab === 'history' && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 min-h-[400px]">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Archive size={20} className="text-blue-600"/> Lịch Sử Lương Đã Chốt</h3>
                    {Object.keys(historyRecords).length === 0 ? (
                        <div className="text-center text-slate-500 py-10">Chưa có dữ liệu lịch sử nào được lưu.</div>
                    ) : (
                        <div className="space-y-6">
                            {Object.entries(historyRecords).sort((a,b) => b[0].localeCompare(a[0])).map(([monthId, data]) => {
                                if (!historyTransactions[monthId]) {
                                    fetchHistoryTransactions(monthId);
                                }
                                const isExpanded = viewingHistoryId === monthId;
                                return (
                                <div key={monthId} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div 
                                        className={`flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition ${isExpanded ? 'bg-slate-50 border-b border-slate-200' : 'bg-slate-100'}`}
                                        onClick={() => {
                                            if (isExpanded) {
                                                setViewingHistoryId(null);
                                                const drafts = getDraftPeriods();
                                                setSelectedMonth(drafts.length > 0 ? drafts[0] : '');
                                            } else {
                                                setViewingHistoryId(monthId);
                                                setSelectedMonth(monthId);
                                                fetchHistoryTransactions(monthId);
                                            }
                                        }}
                                    >
                                        <div>
                                            <h4 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                                <Calendar size={20} className="text-blue-600"/> {monthId}
                                            </h4>
                                            <p className="text-sm text-slate-500 mt-1">Lưu lúc: {new Date(data.timestamp).toLocaleString('vi-VN')}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleRevertHistory(monthId); }}
                                                className="bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold px-3 py-1.5 rounded-lg text-sm transition flex items-center justify-center gap-1"
                                                title="Đưa kỳ này về trạng thái nháp"
                                            >
                                                <RotateCcw size={14} /> Hoàn tác
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteHistory(monthId); }}
                                                className="bg-red-50 hover:bg-red-100 text-red-700 font-bold px-3 py-1.5 rounded-lg text-sm transition flex items-center justify-center gap-1"
                                                title="Xóa vĩnh viễn"
                                            >
                                                <Trash2 size={14} /> Xóa
                                            </button>
                                            {isExpanded ? <ChevronDown size={24} className="text-slate-400 ml-2"/> : <ChevronRight size={24} className="text-slate-400 ml-2"/>}
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="bg-white p-0 relative" onClick={(e) => e.stopPropagation()}>
                                            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                                                <div className="flex items-center gap-2 bg-slate-200/50 p-1 rounded-lg">
                                                    <button onClick={() => setHistorySubTab('salary')} className={`flex items-center gap-2 px-4 py-1.5 text-sm font-bold rounded-md transition ${historySubTab === 'salary' ? 'bg-white shadow text-blue-600' : 'text-slate-600 hover:bg-slate-200'}`}><List size={16} /> Bảng Tính Lương</button>
                                                    <button onClick={() => setHistorySubTab('attendance')} className={`flex items-center gap-2 px-4 py-1.5 text-sm font-bold rounded-md transition ${historySubTab === 'attendance' ? 'bg-white shadow text-blue-600' : 'text-slate-600 hover:bg-slate-200'}`}><CheckSquare size={16} /> Bảng Chấm Công</button>
                                                </div>
                                            </div>
                                            <div className="overflow-x-auto custom-scrollbar relative bg-white">
                                                {renderTableContent(historySubTab)}
                                            </div>
                                        </div>
                                    )}

                                    {isExpanded && historyTransactions[monthId] && historyTransactions[monthId].length > 0 && (
                                        <div className="bg-slate-50 p-4 border-t border-slate-200">
                                            <h5 className="font-bold text-slate-700 text-sm mb-2">Các phiếu chi đã xuất:</h5>
                                            <div className="flex flex-wrap gap-2">
                                                {historyTransactions[monthId].map(tx => (
                                                    <div key={tx.id} className="bg-white border border-slate-200 rounded p-2 text-xs flex flex-col gap-1 shadow-sm">
                                                        <span className="font-bold text-slate-700">{tx.note}</span>
                                                        <span className="text-red-600 font-bold">{new Intl.NumberFormat('vi-VN').format(tx.debit)} đ</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {activeTab !== 'history' && (
                <div className="space-y-4">
                    {getDraftPeriods().length === 0 ? (
                        <div className="text-center text-slate-500 py-10 bg-slate-50 rounded-xl border border-slate-200">
                            Chưa có kỳ lương nào. Hãy bấm "Tạo Kỳ" để bắt đầu.
                        </div>
                    ) : (
                        getDraftPeriods().map(period => {
                            const isExpanded = selectedMonth === period;
                            return (
                                <div key={period} className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden transition">
                                    <div 
                                        className={`flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition ${isExpanded ? 'bg-slate-50 border-b border-slate-200' : ''}`}
                                        onClick={() => {
                                            setSelectedMonth(isExpanded ? '' : period);
                                            setViewingHistoryId(null);
                                        }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                                <Calendar size={20} />
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800 text-lg">{period}</div>
                                                <div className="text-xs text-slate-500 mt-1">Bảng lương và chấm công tạm tính</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-400">
                                            {isExpanded && (
                                                <>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteDraftPeriod(period); }} 
                                                        className="bg-red-50 hover:bg-red-100 text-red-500 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 transition shadow-sm mr-2"
                                                    >
                                                        <Trash2 size={16} /> Xóa
                                                    </button>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleSaveMonth(); }} 
                                                        className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 transition shadow-lg shadow-amber-200 mr-2"
                                                    >
                                                        <Save size={16} /> Chốt Tháng
                                                    </button>
                                                </>
                                            )}
                                            {isExpanded ? <ChevronDown size={24}/> : <ChevronRight size={24}/>}
                                        </div>
                                    </div>
                                    {isExpanded && (
                                        <div className="bg-white p-0 relative" onClick={(e) => e.stopPropagation()}>
                                            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                                                <div className="flex items-center gap-2 bg-slate-200/50 p-1 rounded-lg">
                                                    <button onClick={() => setActiveTab('salary')} className={`flex items-center gap-2 px-4 py-1.5 text-sm font-bold rounded-md transition ${activeTab !== 'attendance' ? 'bg-white shadow text-blue-600' : 'text-slate-600 hover:bg-slate-200'}`}><List size={16} /> Bảng Tính Lương</button>
                                                    <button onClick={() => setActiveTab('attendance')} className={`flex items-center gap-2 px-4 py-1.5 text-sm font-bold rounded-md transition ${activeTab === 'attendance' ? 'bg-white shadow text-blue-600' : 'text-slate-600 hover:bg-slate-200'}`}><CheckSquare size={16} /> Bảng Chấm Công</button>
                                                </div>
                                            </div>
                                            {renderTableContent()}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}
            
            {activeTab === 'attendance' && (
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-600 font-medium">
                    <div className="flex items-center gap-1"><span className="text-emerald-600 font-bold">X</span> : Đủ công (1 ngày)</div>
                    <div className="flex items-center gap-1"><span className="w-4 h-4 bg-purple-500 text-white flex items-center justify-center rounded text-[10px] font-bold">1.5</span> : x1.5 (Lễ)</div>
                    <div className="flex items-center gap-1"><span className="w-4 h-4 bg-indigo-600 text-white flex items-center justify-center rounded text-[10px] font-bold">2</span> : x2 (Lễ)</div>
                    <div className="flex items-center gap-1"><span className="w-4 h-4 bg-orange-500 text-white flex items-center justify-center rounded text-xs font-bold">/</span> : Nửa ngày (0.5 ngày)</div>
                    <div className="flex items-center gap-1"><span className="w-4 h-4 bg-blue-500 text-white flex items-center justify-center rounded text-xs font-bold">P</span> : Nghỉ có phép (1 ngày)</div>
                    <div className="flex items-center gap-1"><span className="w-8 h-4 bg-sky-400 text-white flex items-center justify-center rounded text-[10px] font-bold">P/2</span> : Nghỉ nửa ngày phép</div>
                    <div className="flex items-center gap-1"><span className="w-4 h-4 bg-red-500 inline-block rounded"></span> : Nghỉ (0 ngày)</div>
                    <div className="w-full text-blue-600 mt-1">• Click vào tiêu đề ngày (1, 2, 3...) để đổi ngày đó thành Ngày Lễ. Ngày lễ sẽ có nền màu xanh.</div>
                </div>
            )}
        </div>

        {allocationModal.isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">Phân bổ công trình</h3>
                            <p className="text-sm text-slate-500 mt-1">
                                {allocationModal.name} - Kỳ: {allocationModal.month}
                            </p>
                        </div>
                        <button onClick={() => setAllocationModal({ isOpen: false, empId: null, name: '', month: '', allocations: [] })} className="text-slate-400 hover:text-slate-600 bg-white hover:bg-slate-100 rounded-full p-2 transition">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="p-5 max-h-[60vh] overflow-y-auto space-y-4">
                        <div className="bg-blue-50 text-blue-800 p-3 rounded-xl text-sm font-medium">
                            Nhập tỷ lệ % phân bổ lương cho từng công trình. Tổng tỷ lệ nên là 100%.
                        </div>
                        
                        {projects.map(proj => {
                            const currentAlloc = allocationModal.allocations.find(a => a.projectId === proj.id)?.ratio || '';
                            return (
                                <div key={proj.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-xl hover:border-blue-300 transition bg-slate-50/50">
                                    <div className="font-bold text-slate-700">{proj.name}</div>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number"
                                            value={currentAlloc}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setAllocationModal(prev => {
                                                    const newAllocs = [...prev.allocations];
                                                    const idx = newAllocs.findIndex(a => a.projectId === proj.id);
                                                    if (idx >= 0) {
                                                        if (val === '') newAllocs.splice(idx, 1);
                                                        else newAllocs[idx].ratio = Number(val);
                                                    } else if (val !== '') {
                                                        newAllocs.push({ projectId: proj.id, ratio: Number(val), projectName: proj.name });
                                                    }
                                                    return { ...prev, allocations: newAllocs };
                                                });
                                            }}
                                            placeholder="0"
                                            className="w-20 px-3 py-1.5 border border-slate-300 rounded-lg text-right font-bold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                            min="0"
                                            max="100"
                                        />
                                        <span className="text-slate-500 font-bold">%</span>
                                    </div>
                                </div>
                            );
                        })}
                        
                        {projects.length === 0 && (
                            <div className="text-center text-slate-500 py-4">Không có công trình nào.</div>
                        )}
                        
                        <div className="flex justify-between items-center pt-4 border-t border-slate-100 mt-4">
                            <span className="font-bold text-slate-600">Tổng phân bổ:</span>
                            <span className={`font-black text-lg ${allocationModal.allocations.reduce((s,a) => s + a.ratio, 0) === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {allocationModal.allocations.reduce((s,a) => s + a.ratio, 0)}%
                            </span>
                        </div>
                    </div>
                    <div className="p-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
                        <button onClick={() => setAllocationModal({ isOpen: false, empId: null, name: '', month: '', allocations: [] })} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition">
                            Hủy bỏ
                        </button>
                        <button 
                            onClick={() => {
                                setEmployees(prev => prev.map(emp => {
                                    if (emp.id === allocationModal.empId) {
                                        return {
                                            ...emp,
                                            allocations: {
                                                ...(emp.allocations || {}),
                                                [allocationModal.month]: allocationModal.allocations
                                            }
                                        };
                                    }
                                    return emp;
                                }));
                                setAllocationModal({ isOpen: false, empId: null, name: '', month: '', allocations: [] });
                            }} 
                            className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200 rounded-xl transition"
                        >
                            Lưu Phân Bổ
                        </button>
                    </div>
                </div>
            </div>
        )}

        {paymentModal.isOpen && (() => {
            const isTechnical = paymentModal.department === 'KỸ THUẬT' || paymentModal.department === 'KỸ THUẬT GONDOLA';
            return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200 p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] pointer-events-auto">
                    <div className="bg-slate-900 px-6 py-4 flex justify-between items-center shrink-0">
                        <h3 className="text-xl font-bold text-white">Hạch toán Lương</h3>
                        <button onClick={() => setPaymentModal({ isOpen: false, empId: null, empName: '', department: '', amount: 0, code: '6421', corresponding_account: '1111', recipient: '', note: '', allocations: [{id: Date.now(), project_name: '', from_date: '', to_date: ''}], monthId: null, globalStandardDays: 26 })} className="text-slate-400 hover:text-white transition"><X /></button>
                    </div>
                    
                    <div className="p-6 overflow-y-auto custom-scrollbar space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-black text-slate-900 mb-1">Nhân viên</label>
                                <input type="text" value={paymentModal.empName} readOnly className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-600 outline-none cursor-not-allowed" />
                            </div>
                            <div>
                                <label className="block text-sm font-black text-slate-900 mb-1">Số tiền (Tổng cộng)</label>
                                <input type="text" value={formatCurrency(paymentModal.amount)} readOnly className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-2 text-sm font-black text-orange-600 outline-none cursor-not-allowed" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-black text-slate-900 mb-1">Người nhận</label>
                                <input type="text" value={paymentModal.recipient} onChange={(e) => setPaymentModal({...paymentModal, recipient: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 transition" />
                            </div>
                            <div>
                                <label className="block text-sm font-black text-slate-900 mb-1">Ghi chú</label>
                                <input type="text" value={paymentModal.note} onChange={(e) => setPaymentModal({...paymentModal, note: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 transition" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-black text-slate-900 mb-1">Mã chi phí (Nợ)</label>
                                <select value={paymentModal.code} onChange={(e) => setPaymentModal({...paymentModal, code: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 transition appearance-none">
                                    <option value="6421">6421 - Chi phí nhân viên bán hàng</option>
                                    <option value="6422">6422 - Chi phí nhân viên quản lý</option>
                                    <option value="622">622 - Chi phí nhân công trực tiếp</option>
                                    <option value="154">154 - Chi phí SXKD dở dang</option>
                                    <option value="3341">3341 - Phải trả người lao động</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-black text-slate-900 mb-1">Tài khoản đối ứng (Có)</label>
                                <select value={paymentModal.corresponding_account} onChange={(e) => setPaymentModal({...paymentModal, corresponding_account: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 transition appearance-none">
                                    <option value="1111">1111 - Tiền mặt</option>
                                    <option value="1121">1121 - Tiền gửi ngân hàng</option>
                                    <option value="3341">3341 - Phải trả người lao động</option>
                                </select>
                            </div>
                        </div>

                        <div className="pt-2 border-t border-slate-200 mt-2">
                            <h4 className="font-black text-slate-800 mb-2">Hạch toán công trình {isTechnical && <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded ml-2">Bộ phận Kỹ thuật / Gondola</span>}</h4>
                            
                            {!isTechnical ? (
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Chọn công trình duy nhất</label>
                                    <select 
                                        value={paymentModal.allocations[0]?.project_name || ''}
                                        onChange={(e) => {
                                            const newAllocs = [...paymentModal.allocations];
                                            newAllocs[0].project_name = e.target.value;
                                            setPaymentModal({...paymentModal, allocations: newAllocs});
                                        }}
                                        className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 transition"
                                    >
                                        <option value="">-- Chọn công trình --</option>
                                        {projects.map(p => (
                                            <option key={p.name} value={p.name}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {paymentModal.allocations.map((alloc, idx) => (
                                        <div key={alloc.id} className="flex gap-2 items-center bg-slate-50 p-2 border border-slate-200 rounded-lg">
                                            <div className="flex-1">
                                                <select 
                                                    value={alloc.project_name}
                                                    onChange={(e) => {
                                                        const newAllocs = [...paymentModal.allocations];
                                                        newAllocs[idx].project_name = e.target.value;
                                                        setPaymentModal({...paymentModal, allocations: newAllocs});
                                                    }}
                                                    className="w-full px-2 py-1.5 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-500 transition"
                                                >
                                                    <option value="">-- Chọn công trình --</option>
                                                    {projects.map(p => (
                                                        <option key={p.name} value={p.name}>{p.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="w-32">
                                                <input type="date" value={alloc.from_date} onChange={(e) => {
                                                    const newAllocs = [...paymentModal.allocations];
                                                    newAllocs[idx].from_date = e.target.value;
                                                    setPaymentModal({...paymentModal, allocations: newAllocs});
                                                }} className="w-full px-2 py-1.5 text-sm bg-white border border-slate-300 rounded" title="Từ ngày" />
                                            </div>
                                            <div className="w-32">
                                                <input type="date" value={alloc.to_date} onChange={(e) => {
                                                    const newAllocs = [...paymentModal.allocations];
                                                    newAllocs[idx].to_date = e.target.value;
                                                    setPaymentModal({...paymentModal, allocations: newAllocs});
                                                }} className="w-full px-2 py-1.5 text-sm bg-white border border-slate-300 rounded" title="Đến ngày" />
                                            </div>
                                            <button onClick={() => {
                                                const newAllocs = paymentModal.allocations.filter(a => a.id !== alloc.id);
                                                setPaymentModal({...paymentModal, allocations: newAllocs});
                                            }} className="p-1.5 text-red-500 hover:bg-red-100 rounded transition"><Trash2 size={16}/></button>
                                        </div>
                                    ))}
                                    <button 
                                        onClick={() => {
                                            setPaymentModal({...paymentModal, allocations: [...paymentModal.allocations, {id: Date.now(), project_name: projects?.[0]?.name || '', from_date: '', to_date: ''}]});
                                        }}
                                        className="text-sm font-bold text-blue-600 flex items-center gap-1 hover:text-blue-800 transition"
                                    >
                                        <Plus size={16}/> Thêm dòng phân bổ
                                    </button>
                                    
                                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-800 mt-2 leading-relaxed">
                                        <b>Lưu ý (Cách 2):</b> Số tiền hạch toán cho mỗi công trình = (Tổng tiền / {paymentModal.globalStandardDays} ngày công chuẩn) × Số ngày trong khoảng (Từ ngày - Đến ngày).
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="p-4 bg-slate-50 flex justify-end gap-3 shrink-0 border-t border-slate-200">
                        <button onClick={() => setPaymentModal({ isOpen: false, empId: null, empName: '', department: '', amount: 0, code: '6421', corresponding_account: '1111', recipient: '', note: '', allocations: [{id: Date.now(), project_name: '', from_date: '', to_date: ''}], monthId: null, globalStandardDays: 26 })} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition">
                            Hủy bỏ
                        </button>
                        <button onClick={handleCreatePaymentTransaction} className="px-5 py-2.5 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 shadow-md shadow-orange-200 rounded-xl transition">
                            Tạo phiếu chi
                        </button>
                    </div>
                </div>
            </div>
            );
        })()}

        </>
    );
}
