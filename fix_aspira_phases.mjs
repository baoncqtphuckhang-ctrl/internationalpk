import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim().replace(/^[\"']|[\"']$/g, '');
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
    const projName = "THE ASPIRA (CHUNG CƯ TÂN BÌNH)";
    const { data: wh } = await supabase.from('material_warehouse').select('*').eq('project_name', projName);
    
    let updatedWh = 0;
    if (wh) {
        for (const item of wh) {
            let oPhase = '';
            const orderMatch = item.note.match(/\[Đơn: (.*?)\]/);
            if (orderMatch) {
                oPhase = orderMatch[1].trim();
            } else {
                const orderMatchOld = item.note.match(/Theo Đơn vật tư ([^.]*)/);
                if (orderMatchOld) oPhase = orderMatchOld[1].trim();
            }

            if (!oPhase) continue;

            let targetPricePhaseId = null;
            if (oPhase.includes('ĐỢT 0')) {
                targetPricePhaseId = '1719716000000'; // Đơn giá lần 1
            } else if (['ĐỢT 1', 'ĐỢT 2', 'ĐỢT 3', 'ĐỢT 4', 'ĐỢT 5'].some(p => oPhase.includes(p))) {
                targetPricePhaseId = '1719717000000'; // Đơn giá lần 2
            }

            if (targetPricePhaseId) {
                const pMatch = item.note.match(/\[Đợt giá: (.*?)\]/);
                const currentPricePhase = pMatch ? pMatch[1].trim() : null;
                
                if (currentPricePhase !== targetPricePhaseId) {
                    let newNote = item.note;
                    if (currentPricePhase) {
                        newNote = newNote.replace(/\[Đợt giá: .*?\]/g, `[Đợt giá: ${targetPricePhaseId}]`);
                    } else {
                        newNote = `[Đợt giá: ${targetPricePhaseId}] ` + newNote;
                    }
                    
                    await supabase.from('material_warehouse').update({ note: newNote }).eq('id', item.id);
                    updatedWh++;
                    console.log(`Updated item ${item.id}: from ${currentPricePhase} to ${targetPricePhaseId}`);
                }
            }
        }
    }
    console.log('Total updated warehouse items:', updatedWh);
}
run().catch(console.error);
