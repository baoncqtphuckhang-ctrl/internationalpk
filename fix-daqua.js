
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bmffexturrzgdvmeofsg.supabase.co', 'sb_publishable_MVhOPjmDJH1hhKOJufcwLQ_9gOODJu3'); 
async function run() {
  const { data, error } = await supabase.from('expected_invoices')
    .update({ projectName: 'DAQUA SN' })
    .eq('projectName', 'DAQUA SN (Q8)');
  console.log('Update error:', error);
}
run();

