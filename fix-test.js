
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bmffexturrzgdvmeofsg.supabase.co', 'sb_publishable_MVhOPjmDJH1hhKOJufcwLQ_9gOODJu3'); 
async function run() {
  const { data: updateData, error } = await supabase.from('expected_invoices')
    .update({ projectName: 'xxxxxxxx test' })
    .eq('projectName', 'test');
  console.log('Update error:', error);
}
run();

