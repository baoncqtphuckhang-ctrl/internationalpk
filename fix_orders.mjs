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
    const { data: templatesData } = await supabase.from('material_templates').select('*');
    const templates = {};
    templatesData?.forEach(t => { templates[t.project_name] = t.data; });

    const { data: orders } = await supabase.from('material_orders').select('*');
    
    let updatedOrders = 0;
    for (const order of orders) {
        let changed = false;
        let pb = order.items?.[0]?._price_batch;
        if (!pb || pb === 'Không rõ đợt' || pb.includes('Không rõ')) {
            const projTmpl = templates[order.project_name];
            if (projTmpl && projTmpl.versions && projTmpl.versions.length > 0) {
                const oDate = new Date(order.order_date);
                let matchedVer = projTmpl.versions[0];
                for (let i = 0; i < projTmpl.versions.length; i++) {
                    const vDate = new Date(projTmpl.versions[i].date);
                    if (oDate >= vDate) {
                        matchedVer = projTmpl.versions[i];
                    }
                }
                
                if (order.items && order.items.length > 0) {
                    order.items[0]._price_batch = matchedVer.id;
                    changed = true;
                }
            }
        }
        
        if (changed) {
            await supabase.from('material_orders').update({ items: order.items }).eq('id', order.id);
            updatedOrders++;
        }
    }
    console.log('Updated orders:', updatedOrders);
    
    // Refresh orders to get updated price_batch
    const { data: updatedOrdersData } = await supabase.from('material_orders').select('*');

    const { data: wh } = await supabase.from('material_warehouse').select('*').ilike('note', '%Không rõ đợt%');
    let updatedWh = 0;
    if (wh) {
        for (const item of wh) {
            const orderMatch = item.note.match(/Theo Đơn vật tư ([^.]*)/);
            if (orderMatch) {
                const oPhase = orderMatch[1].trim();
                const matchedOrder = updatedOrdersData.find(o => o.project_name === item.project_name && o.order_phase === oPhase);
                if (matchedOrder && matchedOrder.items?.[0]?._price_batch && !matchedOrder.items[0]._price_batch.includes('Không rõ')) {
                    const pb = matchedOrder.items[0]._price_batch;
                    const newNote = item.note.replace(/\[Đợt giá: .*?\]/g, `[Đợt giá: ${pb}]`).replace(/Đợt giá: .*? /g, `[Đợt giá: ${pb}] `);
                    await supabase.from('material_warehouse').update({ note: newNote }).eq('id', item.id);
                    updatedWh++;
                }
            }
        }
    }
    console.log('Updated warehouse items:', updatedWh);
}
run().catch(console.error);
