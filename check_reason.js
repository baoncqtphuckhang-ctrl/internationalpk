const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    const { data, error } = await supabase.from('approval_requests').select('id, reason').eq('doc_type', 'Đơn Vật Tư').order('created_at', { ascending: false }).limit(5);
    console.log(data);
}
check();
