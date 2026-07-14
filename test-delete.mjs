import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Fetching salary_history...');
    const { data, error } = await supabase.from('salary_history').select('month_id, timestamp');
    if (error) {
        console.error('Fetch error:', error);
        return;
    }
    console.log('Current months in DB:', data);

    console.log('Attempting to delete 2026-07-DRAFT...');
    const deleteResult = await supabase.from('salary_history').delete().eq('month_id', '2026-07-DRAFT');
    console.log('Delete result:', deleteResult);

    console.log('Fetching salary_history again...');
    const { data: data2, error: error2 } = await supabase.from('salary_history').select('month_id, timestamp');
    console.log('After delete months in DB:', data2);
}

run();
