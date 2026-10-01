
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bmffexturrzgdvmeofsg.supabase.co', 'sb_publishable_MVhOPjmDJH1hhKOJufcwLQ_9gOODJu3'); // Assuming public anon key works for read
async function run() {
  const { data: txs } = await supabase.from('transactions').select('id, project_name').limit(10);
  console.log(txs);
}
run();

