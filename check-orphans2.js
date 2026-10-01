
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bmffexturrzgdvmeofsg.supabase.co', 'sb_publishable_MVhOPjmDJH1hhKOJufcwLQ_9gOODJu3'); 
async function run() {
  const { data: projects } = await supabase.from('projects').select('name');
  const projectNames = projects.map(p => p.name);
  
  const { data: expected } = await supabase.from('expected_invoices').select('projectName');
  const uniqueNames = [...new Set(expected.map(e => e.projectName).filter(Boolean))];
  
  const orphans = uniqueNames.filter(name => !projectNames.includes(name));
  
  console.log('Orphans:', orphans);
}
run();

