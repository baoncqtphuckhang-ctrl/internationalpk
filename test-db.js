const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data: trans, error: transErr } = await supabase.from('transactions').select('project_name').limit(10);
  console.log("Transactions sample:", trans);

  const { data: proj, error: projErr } = await supabase.from('projects').select('*');
  console.log("All projects in DB:", proj);
}

check();
