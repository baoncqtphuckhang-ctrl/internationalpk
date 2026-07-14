const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...values] = line.split('=');
    if (key && values.length > 0) {
        env[key.trim()] = values.join('=').trim().replace(/^"|"$/g, '');
    }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
    const { data: allData, error } = await supabase.from('expected_invoices').select('*');
    if (error) {
        console.error('Error fetching invoices:', error);
        return;
    }
    
    // Regular invoices have no teamName
    const invoices = allData.filter(d => !d.teamName);
    console.log('Regular Invoices:', invoices.length);
    
    const recent = invoices.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10);
    console.log('\nTop 10 most recently created regular invoices:');
    recent.forEach(d => {
        console.log(`- ID: ${d.id}, Project: ${d.projectName}, Phase: ${d.phase}, PreTax: ${d.preTaxValue}, Created: ${d.created_at}`);
    });
}

main();
