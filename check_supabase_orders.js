import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase.from('material_orders').select('*');
    if (error) {
        console.log("Error:", error);
    } else {
        console.log(`Found ${data.length} orders.`);
        if (data.length > 0) {
            console.log("First order keys:", Object.keys(data[0]));
            console.log("First order company field:", data[0].company);
            console.log("First order order_company field:", data[0].order_company);
        }
    }
}
check();
