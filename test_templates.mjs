import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^"|"$/g, '');
    }
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

async function check() {
    const res = await fetch(`${supabaseUrl}/rest/v1/material_templates?select=*`, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });
    
    if (!res.ok) {
        console.error('Error:', await res.text());
        return;
    }
    
    const data = await res.json();
    console.log(`Found ${data.length} rows in material_templates.`);
    if (data.length > 0) {
        console.log('Projects in DB:', data.map(d => d.project_name));
    } else {
        console.log('Table is completely empty!');
    }
}

check();
