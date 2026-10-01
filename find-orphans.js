
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bmffexturrzgdvmeofsg.supabase.co', 'sb_publishable_MVhOPjmDJH1hhKOJufcwLQ_9gOODJu3'); 
async function run() {
  const { data: projects } = await supabase.from('projects').select('name');
  const projectNames = projects.map(p => p.name);
  const { data: txs } = await supabase.from('transactions').select('id, project_name');
  
  const orphans = {};
  txs.forEach(tx => {
    if (!projectNames.includes(tx.project_name)) {
        orphans[tx.project_name] = (orphans[tx.project_name] || 0) + 1;
    }
  });
  console.log('Orphan projects in txs:', orphans);
}
run();

