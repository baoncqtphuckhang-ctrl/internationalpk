import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf-8');
const lines = env.split('\n');
const supabaseUrl = lines.find(l => l.startsWith('NEXT_PUBLIC_SUPABASE_URL=')).split('=')[1].trim();
const supabaseKey = lines.find(l => l.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')).split('=')[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);
supabase.from('projects').update({ plhd2_value: 0 }).eq('id', '0ed826d0-a8f4-4e0b-b810-311f9cdaf1b5').then(r => console.log('Update result:', r));
