const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);
async function run() {
    const { data, error } = await supabase.rpc('execute_sql', { sql_query: 'ALTER TABLE material_orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT \'Chờ xử lý\';' });
    if(error) console.log('RPC failed:', error.message);
    else console.log('Success!', data);
}
run();
