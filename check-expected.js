
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bmffexturrzgdvmeofsg.supabase.co', 'sb_publishable_MVhOPjmDJH1hhKOJufcwLQ_9gOODJu3'); 
async function run() {
  const { data: invs, error } = await supabase.from('expected_invoices').select('*').limit(1);
  if (error) console.error('Error:', error);
  console.log('Sample:', invs);
}
run();

