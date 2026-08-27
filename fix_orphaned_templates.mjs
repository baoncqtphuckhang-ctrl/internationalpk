import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
const url = urlMatch[1].trim();
const key = keyMatch[1].trim();
const supabase = createClient(url, key);

async function run() {
    const { data: templates } = await supabase.from('material_templates').select('id, project_name');
    const { data: projects } = await supabase.from('projects').select('name');
    
    const pNames = projects.map(x => x.name);
    const orphans = templates.filter(x => !pNames.includes(x.project_name));
    
    console.log(`Found ${orphans.length} orphaned templates.`);
    
    let fixedCount = 0;
    
    for (const orphan of orphans) {
        // Find matching project
        const match = pNames.find(p => p.startsWith(orphan.project_name + ' (') || p.startsWith(orphan.project_name + ' '));
        let targetName = match;
        
        // Manual mapping for tricky ones
        if (!targetName) {
            if (orphan.project_name === 'GEM SKY WORLD 35 CĂN') targetName = 'GEM SKY WORLD 35 + 36 CĂN (ĐN)';
            if (orphan.project_name === 'TROPICAL PHÚ QUỐC') targetName = 'TROPICAL SUN GROUP (PQ)'; // educated guess
        }
        
        if (targetName) {
            console.log(`Fixing: "${orphan.project_name}" -> "${targetName}"`);
            const { error } = await supabase.from('material_templates').update({ project_name: targetName }).eq('id', orphan.id);
            if (error) {
                console.error(`Error fixing ${orphan.project_name}:`, error);
            } else {
                fixedCount++;
            }
        } else {
            console.log(`No match found for: "${orphan.project_name}"`);
        }
    }
    
    console.log(`Successfully fixed ${fixedCount} templates.`);
}

run();
