import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://hidxjxsueyticzaadvpy.supabase.co',
    'sb_publishable_fYIcvEvuEPzEFvCDTBUs6A_WkCyBpbS'
);

async function checkDraft07() {
    const { data, error } = await supabase
        .from('salary_history')
        .select('*')
        .eq('month_id', '2026-07-DRAFT')
        .single();
    
    if (error || !data) {
        console.log('Không tìm thấy 2026-07-DRAFT');
        return;
    }
    
    const emps = (data.employees_data || []).filter(e => e.id !== 'metadata_holidays');
    console.log(`=== 2026-07-DRAFT ===`);
    console.log(`Lưu lúc: ${data.timestamp}`);
    console.log(`Công chuẩn: ${data.global_standard_days}`);
    console.log(`Tổng nhân viên (bao gồm phòng ban): ${emps.length}`);
    console.log('\nDanh sách:');
    emps.forEach(e => {
        if (e.isDepartment || e.is_department) {
            console.log(`  [PHÒNG BAN] ${e.department}`);
        } else {
            console.log(`  - ${e.name} | Lương: ${(e.basic_salary || 0).toLocaleString('vi-VN')}`);
        }
    });

    // Also check employees table
    console.log('\n=== Bảng employees (dữ liệu gốc) ===');
    const { data: empsDb } = await supabase.from('employees').select('id, name, basic_salary, is_department, department').order('order_index');
    if (empsDb) {
        console.log(`Tổng: ${empsDb.length} dòng`);
        empsDb.forEach(e => {
            if (e.is_department) {
                console.log(`  [PHÒNG BAN] ${e.department}`);
            } else {
                console.log(`  - ${e.name} | Lương: ${(e.basic_salary || 0).toLocaleString('vi-VN')}`);
            }
        });
    }
}

checkDraft07().then(() => process.exit(0));
