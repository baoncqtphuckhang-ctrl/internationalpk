
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bmffexturrzgdvmeofsg.supabase.co', 'sb_publishable_MVhOPjmDJH1hhKOJufcwLQ_9gOODJu3'); 
async function run() {
  const { data: projects } = await supabase.from('projects').select('name').ilike('name', '%DAQUA%');
  console.log('Projects:', projects.map(p => ({ name: p.name, length: p.name.length })));
  const { data: expected } = await supabase.from('expected_invoices').select('projectName').ilike('projectName', '%DAQUA%');
  const uniqueNames = [...new Set(expected.map(e => e.projectName))];
  console.log('Expected:', uniqueNames.map(n => ({ name: n, length: n.length })));
}
run();

