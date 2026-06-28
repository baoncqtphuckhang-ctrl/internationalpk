import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        env[match[1].trim()] = match[2].trim();
    }
});

const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['NEXT_PUBLIC_SUPABASE_ANON_KEY']);

async function run() {
    const { data: aaTestConfig, error: fetchErr } = await supabase
        .from('material_price_configs')
        .select('*')
        .eq('project_name', 'AA TEST')
        .single();
        
    if (fetchErr || !aaTestConfig) {
        console.error("Failed to fetch AA TEST config", fetchErr);
        return;
    }

    console.log("Found AA TEST config. Syncing to BB TEST...");
    
    // Check if BB TEST exists
    const { data: bbTestConfig, error: bbErr } = await supabase
        .from('material_price_configs')
        .select('*')
        .eq('project_name', 'BB TEST')
        .single();
        
    const newPayload = {
        project_name: 'BB TEST',
        config_data: aaTestConfig.config_data
    };
    
    if (bbTestConfig) {
        console.log("Updating BB TEST config...");
        await supabase.from('material_price_configs').update(newPayload).eq('id', bbTestConfig.id);
    } else {
        console.log("Inserting BB TEST config...");
        await supabase.from('material_price_configs').insert([newPayload]);
    }
    
    console.log("Done!");
}

run();
