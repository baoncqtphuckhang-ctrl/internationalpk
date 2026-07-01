const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hidxjxsueyticzaadvpy.supabase.co';
const supabaseAnonKey = 'sb_publishable_fYIcvEvuEPzEFvCDTBUs6A_WkCyBpbS';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
    console.log("Upserting dummy DRAFT salary history...");
    const upsertData = [{
        month_id: "2026-07-DRAFT",
        timestamp: new Date().toISOString(),
        global_standard_days: 26,
        employees_data: []
    }];
    
    const { data, error } = await supabase.from('salary_history').upsert(upsertData, { onConflict: 'month_id' });
    
    if (error) {
        console.error("Salary history upsert error:", JSON.stringify(error, null, 2));
    } else {
        console.log("Salary history upsert successful!", data);
    }
}

test();
