
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bmffexturrzgdvmeofsg.supabase.co', 'sb_publishable_MVhOPjmDJH1hhKOJufcwLQ_9gOODJu3'); 
async function run() {
  const { data: projects } = await supabase.from('projects').select('name');
  const projectNames = projects.map(p => p.name);
  
  const { data: expected } = await supabase.from('expected_invoices').select('id, projectName');
  const orphans = expected.filter(e => e.projectName && !projectNames.includes(e.projectName));
  
  console.log('Orphans:', [...new Set(orphans.map(o => o.projectName))]);
}
run();

