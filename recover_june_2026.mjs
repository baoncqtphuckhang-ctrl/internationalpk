import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const PERIOD = '2026-06';
const [y, m] = PERIOD.split('-').map(Number);

const getDefaultAttendance = (year, month) => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const att = {};
    for (let i = 1; i <= daysInMonth; i++) {
        const isSunday = new Date(year, month - 1, i).getDay() === 0;
        att[i] = isSunday ? 0 : 1;
    }
    return att;
};

const calcStandardDays = (year, month) => {
    const daysInMonth = new Date(year, month, 0).getDate();
    let sundays = 0;
    for (let i = 1; i <= daysInMonth; i++) {
        if (new Date(year, month - 1, i).getDay() === 0) sundays++;
    }
    return daysInMonth - sundays;
};

async function recover() {
    const { data: emps, error } = await supabase.from('employees').select('*').order('order_index');
    if (error) throw error;
    if (!emps?.length) throw new Error('Bảng employees trống, không thể khôi phục');

    const employeesData = emps.map(e => ({
        ...e,
        isDepartment: e.is_department,
        isCustomDept: e.is_custom_dept,
        leave_balance: e.leave_balance === -1 ? 'N/A' : (Number(e.leave_balance) || 0),
        attendance: { [PERIOD]: getDefaultAttendance(y, m) },
        allocations: {}
    }));

    const stdDays = calcStandardDays(y, m);
    const timestamp = new Date().toISOString();

    const { error: upsertError } = await supabase.from('salary_history').upsert([{
        month_id: `${PERIOD}-DRAFT`,
        timestamp,
        global_standard_days: stdDays,
        employees_data: employeesData
    }], { onConflict: 'month_id' });

    if (upsertError) throw upsertError;

    const realCount = employeesData.filter(e => !e.is_department).length;
    console.log(`✅ Đã khôi phục kỳ ${PERIOD}-DRAFT`);
    console.log(`   - ${realCount} nhân viên (từ bảng employees)`);
    console.log(`   - Công chuẩn: ${stdDays} ngày`);
    console.log(`   - Lưu lúc: ${timestamp}`);
    employeesData.filter(e => !e.is_department).forEach(e => {
        console.log(`   · ${e.name}`);
    });
}

recover().catch(e => {
    console.error('Lỗi khôi phục:', e.message || e);
    process.exit(1);
});
