import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable() {
    const { data, error } = await supabase.from('material_templates').select('*');
    if (error) {
        console.error('Error fetching material_templates:', error.message);
    } else {
        console.log('Fetched rows from material_templates:', data.length);
        if (data.length > 0) {
            console.log('Project names in DB:', data.map(r => r.project_name));
        }
    }
}
checkTable();
