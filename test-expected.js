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
  const { data, error } = await supabase.from('expected_invoices').insert([{"projectName": "test", "preTaxValue": 0}]).select();
  console.log("preTaxValue:", error);
  const { data: d2, error: e2 } = await supabase.from('expected_invoices').insert([{"projectName": "test", "vatAmount": 0}]).select();
  console.log("vatAmount:", e2);
  const { data: d3, error: e3 } = await supabase.from('expected_invoices').insert([{"projectName": "test", "postTaxValue": 0}]).select();
  console.log("postTaxValue:", e3);
  const { data: d4, error: e4 } = await supabase.from('expected_invoices').insert([{"projectName": "test", "teamValue": 0}]).select();
  console.log("teamValue:", e4);
  const { data: d5, error: e5 } = await supabase.from('expected_invoices').insert([{"projectName": "test", "accumulatedAdvance": 0}]).select();
  console.log("accumulatedAdvance:", e5);
  const { data: d6, error: e6 } = await supabase.from('expected_invoices').insert([{"projectName": "test", "teamName": ""}]).select();
  console.log("teamName:", e6);
  const { data: d7, error: e7 } = await supabase.from('expected_invoices').insert([{"projectName": "test", "phase": ""}]).select();
  console.log("phase:", e7);
  const { data: d8, error: e8 } = await supabase.from('expected_invoices').insert([{"projectName": "test", "note": ""}]).select();
  console.log("note:", e8);
}

check();
