
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bmffexturrzgdvmeofsg.supabase.co', 'sb_publishable_MVhOPjmDJH1hhKOJufcwLQ_9gOODJu3'); 
async function run() {
  const { data: txs } = await supabase.from('transactions').select('id, project_name').eq('project_name', 'xxxxxxxx test');
  console.log('Txs for xxxxxxxx test:', txs.length);
  const { data: incomes } = await supabase.from('incomes').select('id, project_name').eq('project_name', 'xxxxxxxx test');
  console.log('Incomes for xxxxxxxx test:', incomes.length);
  const { data: approvals } = await supabase.from('approval_requests').select('id, project_name').eq('project_name', 'xxxxxxxx test');
  console.log('Approvals for xxxxxxxx test:', approvals.length);
}
run();

